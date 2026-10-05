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
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path
from urllib.request import urlopen

import numpy as np
from netCDF4 import Dataset
from shapely.geometry import shape
from shapely import contains_xy

from ocean_pipeline.sea_area_catalog import AREAS
from ocean_pipeline.temperature_fill import complete_dataset

BASE_URL = "https://www.ncei.noaa.gov/data/sea-surface-temperature-extended-reconstructed/v6/access"


def fetch_month(year: int, month: int) -> tuple[int, int, bytes]:
    url = f"{BASE_URL}/ersst.v6.{year}{month:02d}.nc"
    with urlopen(url, timeout=90) as response:
        return year, month, response.read()


def build(areas_path: Path, start: int, end: int, output: Path) -> None:
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
    with ThreadPoolExecutor(max_workers=16) as pool:
        tasks = {pool.submit(fetch_month, year, month): (year, month) for year, month in months}
        for task in as_completed(tasks):
            year, month, payload = task.result()
            # netCDF/HDF5 reads stay on the main thread; concurrent reads can
            # crash on installations built without thread-safe HDF5 support.
            with Dataset("monthly", memory=payload) as dataset:
                sea = np.ma.filled(dataset.variables["sst"][0, 0, :, :], np.nan).astype("float64")
                lat = np.asarray(dataset.variables["lat"][:])
                lon = np.asarray(dataset.variables["lon"][:])
            if lat_grid is None:
                lon_grid, lat_grid = np.meshgrid(((lon + 180) % 360) - 180, lat)
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
    for year in range(start, end + 1):
        if len(completed[year]) != 12:
            raise ValueError(f"Incomplete year {year}")
        full_days = 366 if calendar.isleap(year) else 365
        for item in features:
            ident = item["properties"]["id"]
            valid = masks[ident] & (counts[year] == full_days)
            cells = int(valid.sum())
            if cells < 2:
                # At 2° resolution this sea cannot be represented responsibly.
                continue
            mean = float(np.sum(sums[year][valid] / full_days * weights[valid]) / np.sum(weights[valid]))
            records.append({"year": year, "areaId": ident, "celsius": round(mean, 2), "cells": cells})
    annual = {
        "source": "NOAA ERSSTv6", "startYear": start, "endYear": end,
        "accessed": date.today().isoformat(), "gridDegrees": 2,
        "records": records,
    }
    areas, annual = complete_dataset(source, annual)
    output.mkdir(parents=True, exist_ok=True)
    (output / "seaAreas.geojson").write_text(json.dumps(areas, ensure_ascii=False, separators=(",", ":")))
    (output / "seaTemperatures.json").write_text(json.dumps(annual, ensure_ascii=False, separators=(",", ":")))
    print(f"Published {len(annual['records'])} annual area values in {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--areas", type=Path, default=Path("data/geography/iho-sea-areas-simplified.geojson"))
    parser.add_argument("--start", type=int, default=1982)
    parser.add_argument("--end", type=int, default=2025)
    parser.add_argument("--output", type=Path, default=Path("src/data"))
    args = parser.parse_args()
    build(args.areas, args.start, args.end, args.output)
