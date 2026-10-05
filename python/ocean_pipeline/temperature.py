"""Build annual, area-weighted SST snapshots for the map from NOAA ERSSTv6.

Run from the repository root after installing the temperature extra:
    python -m ocean_pipeline.temperature --start 1982 --end 2025

The source geometry is IHO Sea Areas v3, simplified by alvinometric (CC BY 4.0).
Only complete calendar years are published. Downloaded monthly files are not
committed; areas with fewer than two complete NOAA cells are explicitly
estimated from neighboring areas.
"""

from __future__ import annotations

import argparse
import calendar
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path
from urllib.request import urlopen

import numpy as np
from shapely.geometry import shape
from shapely import contains_xy

from ocean_pipeline.sea_area_catalog import AREAS
from ocean_pipeline.temperature_fill import complete_dataset

BASE_URL = "https://www.ncei.noaa.gov/data/sea-surface-temperature-extended-reconstructed/v6/access"


def fetch_month(year: int, month: int, cache_dir: Path | None = None) -> tuple[int, int, bytes]:
    url = f"{BASE_URL}/ersst.v6.{year}{month:02d}.nc"
    cached = cache_dir / f"ersst.v6.{year}{month:02d}.nc" if cache_dir else None
    if cached and cached.exists():
        return year, month, cached.read_bytes()
    with urlopen(url, timeout=90) as response:
        payload = response.read()
    if cached:
        cached.parent.mkdir(parents=True, exist_ok=True)
        temporary = cached.with_suffix('.download')
        temporary.write_bytes(payload)
        temporary.replace(cached)
    return year, month, payload


def regional_record(year, ident, mask, sums, counts, weights):
    """Require two cells valid in every month; never turn a partial year into NOAA history."""
    full_days = 366 if calendar.isleap(year) else 365
    valid = mask & (counts == full_days)
    cells = int(valid.sum())
    if cells < 2:
        return None, cells
    mean = float(np.sum(sums[valid] / full_days * weights[valid]) / np.sum(weights[valid]))
    return {"year": year, "areaId": ident, "celsius": round(mean, 2), "cells": cells}, cells


def build(areas_path: Path, start: int, end: int, output: Path,
          cache_dir: Path | None = None, manifest_path: Path | None = None) -> None:
    from netCDF4 import Dataset
    if start > end:
        raise ValueError("Start year must be at or before end year")
    source = json.loads(areas_path.read_text())
    features = []
    for item in source["features"]:
        name = item["properties"]["NAME"]
        if name in AREAS:
            ident, display_name = AREAS[name]
            features.append({"type": "Feature", "properties": {"id": ident, "name": display_name}, "geometry": item["geometry"]})
    if len(features) != len(AREAS):
        raise ValueError("Missing IHO sea area in source GeoJSON")

    # A full year must have exactly twelve NOAA files; fail instead of silently
    # presenting a partial year's seasonal average as an annual temperature.
    months = [(year, month) for year in range(start, end + 1) for month in range(1, 13)]
    sums: dict[int, np.ndarray] = {}
    counts: dict[int, np.ndarray] = {}
    completed: dict[int, set[int]] = {year: set() for year in range(start, end + 1)}
    lat_grid = lon_grid = None
    input_files = []
    source_lat = source_lon = None
    with ThreadPoolExecutor(max_workers=16) as pool:
        tasks = {pool.submit(fetch_month, year, month, cache_dir): (year, month) for year, month in months}
        for task in as_completed(tasks):
            year, month, payload = task.result()
            input_files.append({"year": year, "month": month,
                                "sha256": hashlib.sha256(payload).hexdigest()})
            # netCDF/HDF5 reads stay on the main thread; concurrent reads can
            # crash on installations built without thread-safe HDF5 support.
            with Dataset("monthly", memory=payload) as dataset:
                sea = np.ma.filled(dataset.variables["sst"][0, 0, :, :], np.nan).astype("float64")
                lat = np.asarray(dataset.variables["lat"][:])
                lon = np.asarray(dataset.variables["lon"][:])
            if lat_grid is None:
                source_lat, source_lon = lat.copy(), lon.copy()
                lon_grid, lat_grid = np.meshgrid(((lon + 180) % 360) - 180, lat)
            elif not np.array_equal(lat, source_lat) or not np.array_equal(lon, source_lon):
                raise ValueError(f"NOAA grid changed in {year}-{month:02d}")
            days = calendar.monthrange(year, month)[1]
            sums.setdefault(year, np.zeros_like(sea))
            counts.setdefault(year, np.zeros_like(sea))
            good = np.isfinite(sea) & (sea > -5) & (sea < 45)
            sums[year][good] += sea[good] * days
            counts[year][good] += days
            completed[year].add(month)
            if len(completed[year]) == 12:
                print(f"{year}: 12/12 months", flush=True)

    assert lat_grid is not None and lon_grid is not None
    weights = np.cos(np.deg2rad(lat_grid))
    masks = {item["properties"]["id"]: contains_xy(shape(item["geometry"]), lon_grid, lat_grid)
             for item in features}
    records = []
    coverage = {item['properties']['id']: [] for item in features}
    for year in range(start, end + 1):
        if len(completed[year]) != 12:
            raise ValueError(f"Incomplete year {year}")
        for item in features:
            ident = item["properties"]["id"]
            row, cells = regional_record(year, ident, masks[ident], sums[year], counts[year], weights)
            coverage[ident].append({"year": year, "completeCells": cells})
            if row is not None:
                records.append(row)
    annual = {
        "source": "NOAA ERSSTv6", "startYear": start, "endYear": end,
        "accessed": date.today().isoformat(), "gridDegrees": 2,
        "records": records,
    }
    areas, annual = complete_dataset(source, annual)
    output.mkdir(parents=True, exist_ok=True)
    (output / "seaAreas.geojson").write_text(json.dumps(areas, ensure_ascii=False, separators=(",", ":")))
    (output / "seaTemperatures.json").write_text(json.dumps(annual, ensure_ascii=False, separators=(",", ":")))
    if manifest_path:
        manifest = {
            "source": "NOAA ERSSTv6", "accessed": annual['accessed'],
            "sourceUrlPattern": f"{BASE_URL}/ersst.v6.YYYYMM.nc",
            "startYear": start, "endYear": end, "minimumCompleteCells": 2,
            "method": "All twelve months per cell; day-weighted months and cosine-latitude cell weights; polygon cell centers only",
            "geometrySha256": hashlib.sha256(areas_path.read_bytes()).hexdigest(),
            "snapshotSha256": hashlib.sha256((output/'seaTemperatures.json').read_bytes()).hexdigest(),
            "codeSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "inputs": sorted(input_files, key=lambda item: (item['year'], item['month'])),
            "coverage": [{"areaId": item['properties']['id'], "name": item['properties']['name'],
                          "years": coverage[item['properties']['id']]} for item in features],
        }
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    print(f"Published {len(annual['records'])} annual area values in {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--areas", type=Path, default=Path("data/geography/iho-sea-areas-simplified.geojson"))
    parser.add_argument("--start", type=int, default=1982)
    parser.add_argument("--end", type=int, default=2025)
    parser.add_argument("--output", type=Path, default=Path("src/data"))
    parser.add_argument("--cache-dir", type=Path, help="Reuse reviewed monthly inputs; remove cache to fetch a new NOAA vintage")
    parser.add_argument("--manifest", type=Path, default=Path("data/geography/marine-temperature.manifest.json"))
    args = parser.parse_args()
    build(args.areas, args.start, args.end, args.output, args.cache_dir, args.manifest)
