"""Build the Caspian's annual NOAA ERSSTv6 means without changing IHO seas.

Geometry is the Caspian hole in the versioned Natural Earth temperature land
cover. Only cells inside that outline and valid for all 12 months are used.
"""
import calendar
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

import numpy as np
from netCDF4 import Dataset
from shapely import contains_xy
from shapely.geometry import shape

from .temperature import fetch_month

ROOT = Path(__file__).resolve().parents[2]


def build():
    geometry_path = ROOT / 'src/data/caspian.geojson'
    geometry = shape(json.loads(geometry_path.read_text())['geometry'])
    records, inputs = [], []
    with ThreadPoolExecutor(max_workers=12) as pool:
        for year in range(1982, 2026):
            total = count = mask = weights = None
            for _, month, payload in pool.map(lambda month: fetch_month(year, month), range(1, 13)):
                inputs.append({'year': year, 'month': month, 'sha256': hashlib.sha256(payload).hexdigest()})
                with Dataset('monthly', memory=payload) as dataset:
                    lat = np.asarray(dataset['lat'][:])
                    lon = np.asarray(dataset['lon'][:])
                    lon = np.where(lon > 180, lon - 360, lon)
                    lon_grid, lat_grid = np.meshgrid(lon, lat)
                    values = np.ma.filled(dataset['sst'][0, 0, :, :], np.nan).astype(float)
                if mask is None:
                    mask = contains_xy(geometry, lon_grid, lat_grid)
                    weights = np.cos(np.deg2rad(lat_grid))
                    total = np.zeros_like(values)
                    count = np.zeros_like(values)
                valid = mask & np.isfinite(values)
                days = calendar.monthrange(year, month)[1]
                total[valid] += values[valid] * days
                count[valid] += days
            days = 366 if calendar.isleap(year) else 365
            valid = mask & (count == days)
            cells = int(valid.sum())
            if cells < 2:
                raise ValueError(f'{year}: insufficient complete Caspian cells')
            mean = float(np.sum(total[valid] / days * weights[valid]) / weights[valid].sum())
            records.append({'year': year, 'areaId': 'caspian', 'celsius': round(mean, 2), 'cells': cells})
            print(year, round(mean, 2), cells, flush=True)
    snapshot = {'source': 'NOAA ERSSTv6', 'accessed': date.today().isoformat(),
                'gridDegrees': 2, 'records': records}
    (ROOT / 'src/data/caspianTemperatures.json').write_text(json.dumps(snapshot, separators=(',', ':')))
    manifest = {'sourceUrlPattern': 'https://www.ncei.noaa.gov/data/sea-surface-temperature-extended-reconstructed/v6/access/ersst.v6.YYYYMM.nc',
                'accessed': snapshot['accessed'], 'geometrySha256': hashlib.sha256(geometry_path.read_bytes()).hexdigest(),
                'method': 'Annual day-weighted monthly SST, cosine-latitude cell weights; at least two cells valid all twelve months',
                'inputs': inputs}
    (ROOT / 'data/geography/caspian-temperature.manifest.json').write_text(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    build()
