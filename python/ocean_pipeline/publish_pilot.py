"""Build the small, explicitly sourced loggerhead observation layer from OBIS staging."""

from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime
import gzip
import hashlib
import json
import math
from pathlib import Path

TAXON_ID = "137205"
DATASET_ID = "b9bfb219-1d5c-450e-9b26-fd377aee8561"
BOUNDS = [1.0, 39.0, 14.0, 44.0]
START_DATE = "2013-01-01"
END_DATE = "2017-12-31"
DATASET_URL = f"https://obis.org/dataset/{DATASET_ID}"
CITATION = (
    "Arcangeli, A.; Campana, I.; Paraboschi, M.; ISPRA (2018). "
    "Presence of sea turtles collected through Fixed-Line-Transect monitoring "
    "across the Western Mediterranean Sea (Civitavecchia-Barcelona route) "
    "between 2013 and 2017. https://doi.org/10.14284/532"
)


def build_pilot(extract_path: Path, manifest_path: Path) -> dict:
    raw = gzip.decompress(extract_path.read_bytes()) if extract_path.suffix == ".gz" else extract_path.read_bytes()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if hashlib.sha256(raw).hexdigest() != manifest["extract_sha256"]:
        raise ValueError("Extract checksum does not match the OBIS manifest")
    query = manifest["query"]
    if (str(query["taxonid"]), query["datasetid"], query["bounds_wgs84"],
            query["startdate"], query["enddate"]) != (
            TAXON_ID, DATASET_ID, BOUNDS, START_DATE, END_DATE):
        raise ValueError("Pilot extract has an unexpected taxon, dataset, place or date window")
    if manifest["truncated_by_cap"]:
        raise ValueError("Cannot publish a capped sample")

    records = []
    for line in raw.splitlines():
        row = json.loads(line)
        lon, lat = row.get("decimalLongitude"), row.get("decimalLatitude")
        uncertainty = row.get("coordinateUncertaintyInMeters")
        event = row.get("eventDate")
        if (row.get("dataset_id") != DATASET_ID or row.get("aphiaID") != 137205
                or row.get("speciesid") != 137205 or row.get("marine") is not True
                or row.get("absence") is not False or row.get("dropped") is not False
                or row.get("flags") != [] or row.get("occurrenceStatus") != "present"
                or not isinstance(row.get("id"), str)
                or not all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)
                           for v in (lon, lat, uncertainty))
                or uncertainty < 0 or not isinstance(event, str)):
            raise ValueError("Pilot extract contains an unexpected or unreviewed occurrence")
        try:
            recorded = datetime.fromisoformat(event)
        except ValueError as exc:
            raise ValueError("Occurrence has an invalid event date") from exc
        if not START_DATE <= recorded.date().isoformat() <= END_DATE:
            raise ValueError("Occurrence is outside the study period")
        if not BOUNDS[0] <= lon <= BOUNDS[2] or not BOUNDS[1] <= lat <= BOUNDS[3]:
            raise ValueError("Occurrence is outside the study box")
        records.append({
            "id": row["id"], "longitude": lon, "latitude": lat,
            "eventDate": event, "coordinateUncertaintyInMeters": uncertainty,
        })
    if not records or len(records) != manifest["counts"]["written"]:
        raise ValueError("Pilot extract is empty or differs from the OBIS manifest")
    if len({row["id"] for row in records}) != len(records):
        raise ValueError("Pilot extract contains duplicate OBIS identifiers")
    records.sort(key=lambda row: row["id"])
    years = Counter(row["eventDate"][:4] for row in records)
    return {
        "schemaVersion": 1,
        "species": "Caretta caretta", "aphiaID": 137205,
        "region": "Mediterráneo occidental · transecto Barcelona–Civitavecchia",
        "period": "2013–2017", "boundsWgs84": BOUNDS,
        "source": {
            "name": "Ocean Biodiversity Information System (OBIS)",
            "datasetId": DATASET_ID, "url": DATASET_URL,
            "citation": CITATION, "license": "CC BY 4.0",
            "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
            "accessedAtUtc": manifest["accessed_at_utc"],
            "extractSha256": manifest["extract_sha256"],
        },
        "summary": {
            "count": len(records), "byYear": dict(sorted(years.items())),
            "uncertaintyKmRange": [
                round(min(r["coordinateUncertaintyInMeters"] for r in records) / 1000),
                round(max(r["coordinateUncertaintyInMeters"] for r in records) / 1000),
            ],
        },
        "observations": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate and publish the scoped OBIS pilot")
    parser.add_argument("--extract", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    pilot = build_pilot(args.extract, args.manifest)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(pilot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
