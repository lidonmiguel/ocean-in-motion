"""Offline, direct 1–5 year regional SST forecasting experiment.

Run PYTHONPATH=python python -m ocean_pipeline.forecast [--check].
No estimated temperatures enter training, evaluation or neighbor features.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import platform
from pathlib import Path

import numpy as np
import sklearn
from pyproj import Geod
from shapely.geometry import shape
from shapely.geometry.polygon import orient
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / 'experiments/temperature/config.json'
INPUTS = ['src/data/seaTemperatures.json', 'src/data/caspianTemperatures.json',
          'src/data/seaAreas.geojson', 'src/data/caspian.geojson']
FEATURES = ['temperature_t', 'temperature_t_minus_1', 'temperature_t_minus_2',
            'mean_5y', 'trend_5y_c_per_year', 'std_5y', 'latitude',
            'longitude_sin', 'longitude_cos', 'log_area_km2', 'origin_since_1982']
NEIGHBOR_FEATURES = ['neighbor_temperature_t', 'neighbor_trend_5y', 'neighbor_available']


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def distance(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, [a[1], a[0], b[1], b[0]])
    value = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 6371 * 2 * math.asin(min(1, math.sqrt(value)))


class Panel:
    def __init__(self, root: Path = ROOT):
        self.root = root
        self.table = {}
        self.excluded = set()
        for filename in INPUTS[:2]:
            for row in json.loads((root / filename).read_text())['records']:
                if row.get('method') == 'estimated' or row['cells'] < 2:
                    self.excluded.add(row['areaId'])
                    continue
                values = self.table.setdefault(row['areaId'], {})
                if row['year'] in values or not math.isfinite(row['celsius']):
                    raise ValueError('Duplicate or non-finite source temperature')
                values[row['year']] = float(row['celsius'])
        self.ids = sorted(self.table)
        self.years = sorted(self.table[self.ids[0]])
        if self.years != list(range(1982, 2026)):
            raise ValueError('Expected the reviewed 1982–2025 snapshot')
        if any(sorted(self.table[area]) != self.years for area in self.ids):
            raise ValueError('All training zones must have complete histories')
        features = json.loads((root / INPUTS[2]).read_text())['features']
        features.append(json.loads((root / INPUTS[3]).read_text()))
        self.geometry = {f['properties']['id']: f for f in features}
        geod = Geod(ellps='WGS84')
        self.static = {}
        for area in self.ids:
            geometry = shape(self.geometry[area]['geometry'])
            point = geometry.representative_point()
            parts = [geometry] if geometry.geom_type == 'Polygon' else list(geometry.geoms)
            surface = sum(abs(geod.geometry_area_perimeter(orient(part))[0]) for part in parts) / 1e6
            self.static[area] = {'name': self.geometry[area]['properties']['name'],
                                 'lon': point.x, 'lat': point.y, 'areaKm2': surface}
        self.neighbors = {}
        for area in self.ids:
            position = (self.static[area]['lon'], self.static[area]['lat'])
            nearby = sorted((distance(position, (self.static[other]['lon'], self.static[other]['lat'])), other)
                            for other in self.ids if other not in (area, 'caspian'))
            self.neighbors[area] = [] if area == 'caspian' else [(other, 1/max(km, 50)) for km, other in nearby[:3] if km <= 5000]
        self.cache = {}

    def core(self, area, origin):
        history = np.array([self.table[area][year] for year in range(origin-4, origin+1)])
        slope = float(np.dot(np.arange(-2, 3), history) / 10)
        geo = self.static[area]
        return [float(history[-1]), float(history[-2]), float(history[-3]),
                float(history.mean()), slope, float(history.std()), geo['lat'],
                math.sin(math.radians(geo['lon'])), math.cos(math.radians(geo['lon'])),
                math.log1p(geo['areaKm2']), origin-1982]

    def vector(self, area, origin, neighbors):
        core = self.core(area, origin)
        if neighbors:
            near = self.neighbors[area]
            weights = sum(weight for _, weight in near)
            temperature = sum(self.table[other][origin]*weight for other, weight in near)/weights if weights else 0
            trend = sum(self.core(other, origin)[4]*weight for other, weight in near)/weights if weights else 0
            core += [temperature, trend, int(bool(near))]
        return core + [int(other == area) for other in self.ids]

    def training(self, cutoff, horizon, neighbors):
        key = (cutoff, horizon, neighbors)
        if key not in self.cache:
            rows = [(area, origin) for origin in range(1986, cutoff-horizon+1) for area in self.ids]
            x = np.array([self.vector(area, origin, neighbors) for area, origin in rows])
            y = np.array([self.table[area][origin+horizon]-self.table[area][origin] for area, origin in rows])
            self.cache[key] = (x, y)
        return self.cache[key]


def predict(panel, candidate, origin, horizon, seed=42):
    family = candidate['family']
    base = np.array([panel.table[area][origin] for area in panel.ids])
    if family == 'persistence':
        return base
    if family == 'trend':
        return base + horizon*np.array([panel.core(area, origin)[4] for area in panel.ids])
    neighbors = candidate['neighbors']
    train_x, train_y = panel.training(origin, horizon, neighbors)
    test_x = np.array([panel.vector(area, origin, neighbors) for area in panel.ids])
    if family == 'ridge':
        model = make_pipeline(StandardScaler(), Ridge(alpha=candidate['alpha']))
    elif family == 'boosting':
        model = HistGradientBoostingRegressor(max_iter=candidate['maxIter'],
                    max_leaf_nodes=candidate['maxLeafNodes'], min_samples_leaf=candidate['minSamplesLeaf'],
                    l2_regularization=candidate['l2'], learning_rate=candidate['learningRate'],
                    early_stopping=False, random_state=seed)
    else:
        raise ValueError(f'Unknown family {family}')
    model.fit(train_x, train_y)
    return base + model.predict(test_x)


def backtest(panel, candidate, origins, horizons, last_target=2025, seed=42):
    result = []
    for origin in origins:
        for horizon in horizons:
            if origin+horizon > last_target:
                continue
            predictions = predict(panel, candidate, origin, horizon, seed)
            for area, prediction in zip(panel.ids, predictions):
                actual = panel.table[area][origin+horizon]
                result.append({'model': candidate['id'], 'areaId': area, 'origin': origin,
                               'horizon': horizon, 'year': origin+horizon,
                               'actual': actual, 'prediction': float(prediction),
                               'error': float(prediction)-actual})
    return result


def metrics(rows):
    errors = np.array([row['error'] for row in rows])
    return {'mae': float(np.abs(errors).mean()), 'rmse': float(np.sqrt((errors**2).mean())),
            'bias': float(errors.mean()), 'n': len(rows)}


def interval_radius(errors, level):
    errors = sorted(abs(error) for error in errors)
    # Conservative finite-sample empirical order statistic. Temporal/spatial
    # dependence prevents an exchangeability-based coverage guarantee.
    rank = min(len(errors), math.ceil((len(errors)+1)*level))
    return errors[rank-1]


def rounded(value):
    if isinstance(value, dict):
        return {key: rounded(item) for key, item in value.items()}
    if isinstance(value, list):
        return [rounded(item) for item in value]
    if isinstance(value, float):
        return round(value, 6)
    return value


def csv_text(rows):
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(rows[0]), lineterminator='\n')
    writer.writeheader()
    writer.writerows(rounded(rows))
    return buffer.getvalue()


def project_estimated_forecasts(panel, direct, cutoff):
    """Transfer donor changes to the existing estimated baseline.

    These zones do not enter training or evaluation. Bounds transfer donor
    intervals only; no local coverage or imputation uncertainty is established.
    """
    source = json.loads((panel.root / INPUTS[0]).read_text())['records']
    baselines = [r for r in source if r['year'] == cutoff and r.get('method') == 'estimated']
    lookup = {(r['areaId'], r['horizon']): r for r in direct}
    horizons = sorted({r['horizon'] for r in direct})
    result = []
    for baseline in baselines:
        donors = baseline['estimatedFrom']
        if (not donors or any(d not in panel.ids for d in donors)
                or baseline['areaId'] in panel.ids or not math.isfinite(baseline['celsius'])):
            raise ValueError('Estimated forecast requires reviewed NOAA donor histories')
        for horizon in horizons:
            def transfer(field):
                return baseline['celsius'] + sum(
                    lookup[(donor, horizon)][field] - panel.table[donor][cutoff]
                    for donor in donors) / len(donors)
            result.append({'areaId': baseline['areaId'], 'year': cutoff+horizon,
                           'horizon': horizon, 'celsius': transfer('celsius'),
                           'lower': transfer('lower'), 'upper': transfer('upper'),
                           'forecastBasis': 'estimated-history',
                           'intervalKind': 'donor-derived-range', 'estimatedFrom': donors})
    return result


def build(root=ROOT):
    config = json.loads((root / 'experiments/temperature/config.json').read_text())
    if max(config['developmentOrigins'])+max(config['horizons']) >= min(config['calibrationOrigins'])+1:
        raise ValueError('Development targets must precede calibration targets')
    panel = Panel(root)
    horizons = config['horizons']
    development, rankings = {}, []
    with threadpool_limits(limits=1):
        for candidate in config['candidates']:
            rows = backtest(panel, candidate, config['developmentOrigins'], horizons, seed=config['seed'])
            development[candidate['id']] = rows
            rankings.append({'id': candidate['id'], **metrics(rows),
                             'byHorizon': {str(h): metrics([r for r in rows if r['horizon'] == h]) for h in horizons}})
            print(candidate['id'], 'development MAE', round(rankings[-1]['mae'], 4), flush=True)
        winner = min(rankings, key=lambda row: (row['mae'], row['id']))['id']
        selected = next(c for c in config['candidates'] if c['id'] == winner)
        calibration = backtest(panel, selected, config['calibrationOrigins'], horizons,
                               config['calibrationLastTarget'], config['seed'])
        radii = {h: interval_radius([r['error'] for r in calibration if r['horizon'] == h], config['intervalLevel']) for h in horizons}
        holdout = backtest(panel, selected, [config['testOrigin']], horizons, seed=config['seed'])
        baselines = {c['id']: metrics(backtest(panel, c, [config['testOrigin']], horizons))
                     for c in config['candidates'] if c['family'] in ('persistence', 'trend')}
        forecast = []
        for horizon in horizons:
            predictions = predict(panel, selected, config['cutoffYear'], horizon, config['seed'])
            for area, prediction in zip(panel.ids, predictions):
                forecast.append({'areaId': area, 'year': config['cutoffYear']+horizon, 'horizon': horizon,
                                 'celsius': float(prediction), 'lower': float(prediction)-radii[horizon],
                                 'upper': float(prediction)+radii[horizon],
                                 'forecastBasis': 'noaa-history', 'intervalKind': 'calibrated',
                                 'estimatedFrom': []})
    forecast += project_estimated_forecasts(panel, forecast, config['cutoffYear'])
    expected = {(area, config['cutoffYear']+h) for area in panel.geometry for h in horizons}
    if {(r['areaId'], r['year']) for r in forecast} != expected or len(forecast) != len(expected):
        raise ValueError('Forecast must cover every historical region once per horizon')
    forecast.sort(key=lambda r: (r['year'], r['areaId']))
    def assessment(rows):
        return {**metrics(rows), 'coverage': float(np.mean([abs(r['error']) <= radii[r['horizon']] for r in rows])),
                'meanIntervalWidth': float(np.mean([2*radii[r['horizon']] for r in rows]))}
    by_horizon = {str(h): {**assessment([r for r in holdout if r['horizon'] == h]),
                            'calibrationN': sum(r['horizon'] == h for r in calibration), 'radius': radii[h]}
                  for h in horizons}
    by_area = {area: {'name': panel.static[area]['name'],
                      **assessment([r for r in holdout if r['areaId'] == area])} for area in panel.ids}
    provenance = {'inputs': {path: sha(root/path) for path in INPUTS},
                  'configSha256': sha(root/'experiments/temperature/config.json'),
                  'codeSha256': sha(root/'python/ocean_pipeline/forecast.py')}
    run_id = hashlib.sha256(json.dumps(provenance, sort_keys=True).encode()).hexdigest()[:16]
    summary = {'schemaVersion': 2, 'runId': run_id, 'selectedModel': selected,
               'trainingThrough': config['cutoffYear'], 'historicalYears': [1982, 2025],
               'trainingAreas': panel.ids, 'excludedEstimatedAreas': sorted(panel.excluded),
               'derivedForecastAreas': sorted(panel.excluded), 'forecastRows': len(forecast),
               'sourceRows': len(panel.ids)*len(panel.years), 'intervalLevel': config['intervalLevel'],
               'developmentOrigins': config['developmentOrigins'], 'calibrationOrigins': config['calibrationOrigins'],
               'calibrationLastTarget': config['calibrationLastTarget'], 'testOrigin': config['testOrigin'],
               'testYears': [config['testOrigin']+1, config['testOrigin']+5],
               'developmentRanking': sorted(rankings, key=lambda r: r['mae']),
               'holdout': assessment(holdout), 'baselineHoldout': baselines,
               'byHorizon': by_horizon, 'byArea': by_area, 'provenance': provenance,
               'environment': {'python': platform.python_version(), 'numpy': np.__version__, 'sklearn': sklearn.__version__},
               'features': FEATURES, 'neighborFeatures': NEIGHBOR_FEATURES,
               'neighbors': {area: [other for other, _ in panel.neighbors[area]] for area in panel.ids},
               'limitations': ['Only 22 existing NOAA-derived regional series enter training and evaluation.',
                              '80 estimated regions receive donor-derived forecasts; local error and range coverage are unvalidated.',
                              'Intervals pool past errors across correlated regions; nominal 90% is not a guarantee.',
                              'No climate scenarios or physical transport model; statistical experiment only.',
                              'Static geographic proximity is a heuristic; Caspian has no marine neighbors.',
                              'A single five-year final test window cannot establish future reliability.']}
    static = [{'areaId': area, **panel.static[area], 'neighbors': panel.neighbors[area]} for area in panel.ids]
    features = [{'areaId': area, 'origin': origin,
                 **dict(zip(FEATURES, panel.core(area, origin)))}
                for origin in range(1986, 2026) for area in panel.ids]
    all_rows = [{**row, 'split': split} for split, rows in [('development', [r for rows in development.values() for r in rows]),
                                                         ('calibration', calibration), ('test', holdout)] for row in rows]
    artifacts = {
        'src/data/temperatureForecasts.json': json.dumps(rounded({'schemaVersion': 2, 'runId': run_id,
            'model': winner, 'trainedThrough': 2025, 'intervalLevel': config['intervalLevel'],
            'records': forecast, 'testByHorizon': by_horizon, 'testByArea': by_area}), indent=2)+'\n',
        'reports/temperature/metrics.json': json.dumps(rounded(summary), indent=2)+'\n',
        'reports/temperature/backtests.csv': csv_text(all_rows),
        'reports/temperature/features.csv': csv_text(features),
        'reports/temperature/geography.json': json.dumps(rounded(static), indent=2)+'\n',
        'reports/temperature/forecast.csv': csv_text([{**r, 'estimatedFrom': ';'.join(r['estimatedFrom'])} for r in forecast]),
    }
    report = ['# Annual regional SST forecasting: 2026–2030', '',
              f"Run `{run_id}`. Selected on development data: **{winner}**.", '',
              'NOAA ERSSTv6 reconstructions, not direct local measurements. Five direct horizon models; learned models predict change from the origin temperature.', '',
              '## Development comparison (selection only)', '', '| Model | MAE °C | RMSE °C |', '| --- | ---: | ---: |']
    report += [f"| {r['id']} | {r['mae']:.3f} | {r['rmse']:.3f} |" for r in sorted(rankings, key=lambda r: r['mae'])]
    report += ['', '## Untouched final test: origin 2020 → 2021–2025', '',
               f"Selected model MAE: **{summary['holdout']['mae']:.3f} °C**. Persistence: **{baselines['persistence']['mae']:.3f} °C**. Trend: **{baselines['trend5']['mae']:.3f} °C**.", '',
               '| Horizon | MAE °C | Bias °C | Interval width °C | Test coverage | Calibration rows |', '| --- | ---: | ---: | ---: | ---: | ---: |']
    report += [f"| {h} | {v['mae']:.3f} | {v['bias']:.3f} | {v['meanIntervalWidth']:.3f} | {v['coverage']:.0%} | {v['calibrationN']} |" for h, v in by_horizon.items()]
    report += ['', '## Protocol and limits', '',
               'Development origins 2000–2009 (latest target 2014); fixed-model interval calibration origins 2014–2018, only targets 2015–2019; final origin 2020. Labels in training must be at or before the forecast origin. All regions share year cutoffs. Final fits use data available through 2025.', '',
               'Nominal 90% symmetric intervals use a conservative empirical absolute-error order statistic separately by horizon. Correlated regions and years violate exchangeability; test coverage above is empirical, not a guarantee. The 5-year calibration has only one origin (22 regional errors). Intervals do not include all upstream reconstruction uncertainty.', '',
               'See metrics.json for regional errors, provenance and neighbor ablations; backtests.csv for every prediction, actual and split; features.csv and geography.json for input diagnostics.', '']
    report += ['## Coverage of the published timeline', '',
               '510 forecasts cover all 102 historical regions. The 22 NOAA-derived regions use the selected model directly. For each of the other 80 regions, the published 2025 estimated value is shifted by the mean forecast change of its existing NOAA donors. This preserves the historical latitude adjustment and baseline; estimated histories never enter training or evaluation.', '',
               'Bounds for these 80 regions transfer the donors\' bounds by the same formula. They are donor-derived ranges, not locally calibrated 90% prediction intervals. Local errors, imputation uncertainty and coverage are unknown. No regional test MAE is assigned to them. The historical/future boundary remains labeled in the single 1982–2030 timeline.', '']
    report += ['- '+item for item in summary['limitations']]
    artifacts['reports/temperature/REPORT.md'] = '\n'.join(report)+'\n'
    return artifacts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Rebuild offline and compare versioned numeric artifacts')
    args = parser.parse_args()
    for path, content in build().items():
        destination = ROOT/path
        if args.check:
            existing = destination.read_text()
            if path.endswith('metrics.json'):
                # Runtime patch versions may differ; numerics and provenance may not.
                left, right = json.loads(existing), json.loads(content)
                left.pop('environment'); right.pop('environment')
                equal = left == right
            else:
                equal = existing == content
            if not equal:
                raise SystemExit(f'Forecast artifact drift: {path}')
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(content)
    print('Forecast artifacts verified' if args.check else 'Forecast artifacts published')


if __name__ == '__main__':
    main()
