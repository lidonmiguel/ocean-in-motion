"""Artifact tests run without ML dependencies; causal tests require [forecast]."""
import csv
import importlib.util
import json
import math
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ML_AVAILABLE = all(importlib.util.find_spec(name) for name in ('sklearn', 'pyproj', 'shapely', 'numpy'))


class ForecastArtifactTests(unittest.TestCase):
    def test_forecasts_only_cover_noaa_zones_and_future_years(self):
        forecast = json.loads((ROOT/'src/data/temperatureForecasts.json').read_text())
        report = json.loads((ROOT/'reports/temperature/metrics.json').read_text())
        self.assertEqual(forecast['runId'], report['runId'])
        self.assertEqual(forecast['model'], report['selectedModel']['id'])
        expected = {(area, year) for area in report['trainingAreas'] for year in range(2026, 2031)}
        self.assertEqual({(r['areaId'], r['year']) for r in forecast['records']}, expected)
        self.assertEqual(len(forecast['records']), len(expected))
        self.assertTrue(set(report['trainingAreas']).isdisjoint(report['excludedEstimatedAreas']))
        for row in forecast['records']:
            self.assertLessEqual(row['lower'], row['celsius'])
            self.assertLessEqual(row['celsius'], row['upper'])
            self.assertTrue(all(math.isfinite(row[k]) for k in ('lower', 'upper', 'celsius')))
            self.assertEqual(row['horizon'], row['year']-forecast['trainedThrough'])

    def test_selection_calibration_and_test_targets_do_not_overlap(self):
        with (ROOT/'reports/temperature/backtests.csv').open() as stream:
            rows = list(csv.DictReader(stream))
        development = [int(r['year']) for r in rows if r['split'] == 'development']
        calibration = [int(r['year']) for r in rows if r['split'] == 'calibration']
        test = [int(r['year']) for r in rows if r['split'] == 'test']
        self.assertLess(max(development), min(calibration))
        self.assertLess(max(calibration), min(test))
        self.assertEqual(sorted(set(test)), list(range(2021, 2026)))
        self.assertTrue(all(int(r['origin']) < int(r['year']) for r in rows))


@unittest.skipUnless(ML_AVAILABLE, 'Install python[forecast] for causal model tests')
class ForecastCausalityTests(unittest.TestCase):
    def test_future_temperatures_cannot_change_past_features_or_training_labels(self):
        from ocean_pipeline.forecast import Panel
        import numpy as np
        panel = Panel()
        before_x, before_y = panel.training(2015, 5, True)
        before_features = panel.vector('med-west', 2015, True)
        for area in panel.ids:
            for year in range(2016, 2026):
                panel.table[area][year] += 1000
        panel.cache.clear()
        after_x, after_y = panel.training(2015, 5, True)
        np.testing.assert_array_equal(before_x, after_x)
        np.testing.assert_array_equal(before_y, after_y)
        self.assertEqual(before_features, panel.vector('med-west', 2015, True))
        self.assertLessEqual(after_x[:, 10].max()+1982+5, 2015)

    def test_estimated_zones_and_caspian_do_not_enter_marine_neighbors(self):
        from ocean_pipeline.forecast import Panel
        panel = Panel()
        self.assertEqual(panel.neighbors['caspian'], [])
        for neighbors in panel.neighbors.values():
            self.assertNotIn('caspian', [area for area, _ in neighbors])
            self.assertTrue(all(area in panel.ids and area not in panel.excluded for area, _ in neighbors))
