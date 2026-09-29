"""Complete the IHO map using nearby observed-area means when NOAA cells are unavailable.

This offline step also upgrades the older 21-area snapshot. Estimates are
identified in every record; they must never be presented as local NOAA values.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from shapely.affinity import translate
from shapely.geometry import shape

from .sea_area_catalog import AREAS

ROOT = Path(__file__).resolve().parents[2]


def nearby_observed_ids(target, observed_geometries: dict[str, object]) -> list[str]:
    """Select touching or nearby observed polygons, including at ±180°."""
    point = target.representative_point()
    ranked = []
    for ident, geometry in observed_geometries.items():
        copies = (geometry, translate(geometry, xoff=-360), translate(geometry, xoff=360))
        ranked.append((min(target.distance(copy) for copy in copies),
                       min(point.distance(copy) for copy in copies), ident))
    ranked.sort()
    nearest = ranked[0][0]
    return [ident for distance, _, ident in ranked[:2]
            if distance <= nearest + 3]


def latitude_reference(latitude: float) -> float:
    """Broad, capped latitude curve used only to adjust neighboring means."""
    return max(-1.8, 28 - 0.008 * latitude ** 2)


def complete_dataset(source: dict, annual: dict) -> tuple[dict, dict]:
    names = [item["properties"]["NAME"] for item in source["features"]]
    if len(names) != len(set(names)) or set(names) != set(AREAS):
        raise ValueError("IHO source areas differ from the reviewed area catalog")

    features = [
        {"type": "Feature", "properties": {"id": AREAS[name][0], "name": AREAS[name][1]},
         "geometry": item["geometry"]}
        for item in source["features"]
        for name in [item["properties"]["NAME"]]
    ]
    geometries = {item["properties"]["id"]: shape(item["geometry"]) for item in features}
    observed = {
        (row["year"], row["areaId"]): row
        for row in annual["records"] if row.get("method") != "estimated"
    }
    years = range(annual["startYear"], annual["endYear"] + 1)
    records = []
    donors_cache: dict[tuple[str, tuple[str, ...]], list[str]] = {}
    for year in years:
        available = {ident: geom for ident, geom in geometries.items()
                     if (year, ident) in observed}
        available_ids = tuple(sorted(available))
        if len(available) < 2:
            raise ValueError(f"{year}: at least two observed areas are required")
        for feature in features:
            ident = feature["properties"]["id"]
            row = observed.get((year, ident))
            if row:
                if row["cells"] < 2:
                    raise ValueError(f"{year} {ident}: observed value lacks grid coverage")
                records.append(row)
                continue
            cache_key = (ident, available_ids)
            if cache_key not in donors_cache:
                donors_cache[cache_key] = nearby_observed_ids(geometries[ident], available)
            donors = donors_cache[cache_key]
            target_lat = abs(geometries[ident].centroid.y)
            adjusted = [
                observed[(year, donor)]["celsius"] +
                latitude_reference(target_lat) -
                latitude_reference(abs(geometries[donor].centroid.y))
                for donor in donors
            ]
            estimate = max(-1.8, min(32, sum(adjusted) / len(adjusted)))
            records.append({"year": year, "areaId": ident, "celsius": round(estimate, 1),
                            "cells": 0, "method": "estimated", "estimatedFrom": donors})

    completed = {**annual, "records": records,
                 "estimation": "Mean of one or two nearby observed IHO areas adjusted by a broad latitude curve; approximate regional value, not local NOAA grid data"}
    return {"type": "FeatureCollection", "features": features}, completed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--areas", type=Path, default=ROOT / "data/geography/iho-sea-areas-simplified.geojson")
    parser.add_argument("--temperatures", type=Path, default=ROOT / "src/data/seaTemperatures.json")
    parser.add_argument("--output", type=Path, default=ROOT / "src/data")
    args = parser.parse_args()
    areas, annual = complete_dataset(
        json.loads(args.areas.read_text(encoding="utf-8")),
        json.loads(args.temperatures.read_text(encoding="utf-8")),
    )
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "seaAreas.geojson").write_text(
        json.dumps(areas, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (args.output / "seaTemperatures.json").write_text(
        json.dumps(annual, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Published {len(areas['features'])} areas and {len(annual['records'])} annual values")


if __name__ == "__main__":
    main()
