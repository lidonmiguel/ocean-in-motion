"""Build deterministic, species-level files for the website from checked OBIS stages.

The input JSONL is the existing coordinate-checked staging output, not an
unfiltered copy of every API response. Its manifest retains upstream reject
counts. The record-level rejection ledger covers the later publication gate.
"""

from __future__ import annotations

import argparse
from collections import Counter
import gzip
import json
from pathlib import Path

from .publish_pilot import build_pilot
from .publish_species import STUDIES, build_snapshot

ROOT = Path(__file__).resolve().parents[2]
PILOT_SLUG = "loggerhead-west-med"
PILOT_INPUT = "loggerhead-west-med-2013-2017"
PIPELINE_VERSION = 1


def _raw_lines(path: Path) -> list[dict]:
    data = gzip.decompress(path.read_bytes()) if path.suffix == ".gz" else path.read_bytes()
    return [json.loads(line) for line in data.splitlines()]


def build_curated(input_dir: Path, metadata_path: Path) -> tuple[dict[str, dict], list[dict]]:
    """Validate every source before returning any publishable output."""
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if not isinstance(metadata, list) or len({item["id"] for item in metadata}) != len(metadata):
        raise ValueError("Species metadata must contain distinct IDs")
    scopes: dict[str, list[tuple[str, dict, dict, list[dict]]]] = {item["id"]: [] for item in metadata}
    rejection_ledger: list[dict] = []

    for slug in [PILOT_SLUG, *STUDIES]:
        input_name = PILOT_INPUT if slug == PILOT_SLUG else slug
        extract = input_dir / f"{input_name}.jsonl.gz"
        if not extract.exists():
            extract = input_dir / f"{input_name}.jsonl"
        manifest_path = input_dir / f"{input_name}.manifest.json"
        snapshot = (build_pilot(extract, manifest_path) if slug == PILOT_SLUG
                    else build_snapshot(slug, extract, manifest_path))
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        raw_rows = _raw_lines(extract)
        accepted_ids = {row["id"] for row in snapshot["observations"]}
        if len(accepted_ids) != snapshot["summary"]["count"]:
            raise ValueError(f"{slug}: duplicate accepted identifier")
        by_id = {row["id"]: row for row in raw_rows}
        if len(by_id) != len(raw_rows) or not accepted_ids <= by_id.keys():
            raise ValueError(f"{slug}: staged identifiers are inconsistent")

        rejected = Counter()
        for row in raw_rows:
            if row["id"] in accepted_ids:
                continue
            flags = row.get("flags", [])
            if ("NO_ACCEPTED_NAME" in flags and row.get("aphiaID") != snapshot["aphiaID"]):
                reason = "no_accepted_name"
            elif "ON_LAND" in flags:
                reason = "obis_on_land"
            elif (row.get("coordinateUncertaintyInMeters") or 0) > 300_000:
                reason = "uncertainty_over_300_km"
            else:
                raise ValueError(f"{slug}: unexplained rejected record {row['id']}")
            rejected[reason] += 1
            rejection_ledger.append({"scopeId": slug, "obisId": row["id"], "reason": reason})
        if rejected != snapshot["summary"].get("excluded", {}):
            raise ValueError(f"{slug}: rejection ledger differs from quality summary")
        if manifest["counts"]["written"] != len(raw_rows):
            raise ValueError(f"{slug}: staged count differs from extract")

        matches = [item for item in metadata if item["scientificName"] == snapshot["species"]]
        if len(matches) != 1 or matches[0]["group"] not in {"fish", "cetacean", "reptile"}:
            raise ValueError(f"{slug}: unknown species or group")
        scopes[matches[0]["id"]].append((slug, snapshot, manifest, raw_rows))

    curated = {}
    all_ids: set[str] = set()
    for item in metadata:
        sources, observations = [], []
        for slug, snapshot, manifest, raw_rows in scopes[item["id"]]:
            by_id = {row["id"]: row for row in raw_rows}
            source = snapshot["source"]
            query = manifest["query"]
            upstream = {
                "invalidCoordinatesOrOutsideBounds": manifest["counts"]["invalid_coordinates_or_outside_bounds"],
                "duplicateIdentifiers": manifest["counts"]["duplicate_identifiers"],
            }
            if (manifest["counts"]["raw_fetched"] - sum(upstream.values()) != manifest["counts"]["written"]):
                raise ValueError(f"{slug}: upstream QC accounting is inconsistent")
            sources.append({
                "id": slug, "region": snapshot["region"], "period": snapshot["period"],
                "boundsWgs84": snapshot["boundsWgs84"],
                **({"clusterDiameterKm": snapshot["clusterDiameterKm"]} if "clusterDiameterKm" in snapshot else {}),
                "query": {"startDate": query["startdate"], "endDate": query["enddate"]},
                "dataset": {key: source[key] for key in ("datasetId", "url", "citation", "license", "accessedAtUtc", "extractSha256")},
                "quality": {"rawFetched": manifest["counts"]["raw_fetched"],
                            "staged": manifest["counts"]["written"],
                            "accepted": snapshot["summary"]["count"],
                            "upstreamRejected": upstream,
                            "rejectedByReason": snapshot["summary"].get("excluded", {}),
                            "unknownCoordinateUncertainty": snapshot["summary"].get("unknownCoordinateUncertainty", 0),
                            "uncertaintyKmRange": snapshot["summary"]["uncertaintyKmRange"]},
            })
            for record in snapshot["observations"]:
                raw = by_id[record["id"]]
                if raw.get("basisOfRecord") not in {"HumanObservation", "Occurrence"}:
                    raise ValueError(f"{slug}: unreviewed basis of record")
                if any(value is not None and not isinstance(value, str)
                       for value in (raw.get("samplingProtocol"), raw.get("occurrenceID"))):
                    raise ValueError(f"{slug}: unreviewed source metadata type")
                observations.append({
                    "obisId": record["id"], "scopeId": slug,
                    "eventDate": record["eventDate"], "longitude": record["longitude"],
                    "latitude": record["latitude"],
                    "coordinateUncertaintyInMeters": record["coordinateUncertaintyInMeters"],
                    "basisOfRecord": raw.get("basisOfRecord"),
                    "samplingProtocol": raw.get("samplingProtocol"),
                    "providerOccurrenceId": raw.get("occurrenceID"),
                })
        if not sources:
            raise ValueError(f"No source scopes for {item['id']}")
        if len({row["obisId"] for row in observations}) != len(observations):
            raise ValueError(f"Duplicate OBIS occurrence between regions for {item['id']}")
        if all_ids & {row["obisId"] for row in observations}:
            raise ValueError(f"An OBIS occurrence appears under multiple species: {item['id']}")
        all_ids.update(row["obisId"] for row in observations)
        quality = {
            "rawFetched": sum(scope["quality"]["rawFetched"] for scope in sources),
            "staged": sum(scope["quality"]["staged"] for scope in sources),
            "accepted": len(observations),
            "upstreamRejected": dict(sorted(sum((Counter(scope["quality"]["upstreamRejected"]) for scope in sources), Counter()).items())),
            "rejectedByReason": dict(sorted(sum((Counter(scope["quality"]["rejectedByReason"]) for scope in sources), Counter()).items())),
        }
        if quality["staged"] != quality["accepted"] + sum(quality["rejectedByReason"].values()):
            raise ValueError(f"Unaccounted staged records for {item['id']}")
        curated[item["id"]] = {
            "schemaVersion": 1, "pipelineVersion": PIPELINE_VERSION,
            "species": {key: item[key] for key in ("id", "scientificName", "commonNameEs", "group")}
                       | {"aphiaID": scopes[item["id"]][0][1]["aphiaID"]},
            "sourceScopes": sources, "quality": quality, "observations": observations,
        }
    return curated, sorted(rejection_ledger, key=lambda row: (row["scopeId"], row["obisId"]))


def outputs(input_dir: Path = ROOT / "data/obis", metadata_path: Path = ROOT / "src/data/speciesMetadata.json") -> dict[Path, bytes]:
    curated, rejected = build_curated(input_dir, metadata_path)
    result = {Path("src/data/curated") / f"{slug}.json":
              (json.dumps(dataset, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
              for slug, dataset in curated.items()}
    result[Path("data/curated/rejected-records.jsonl")] = ("".join(
        json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rejected)).encode("utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Curate checked OBIS extracts into seven web datasets and an audit ledger")
    parser.add_argument("--input-dir", type=Path, default=ROOT / "data/obis")
    parser.add_argument("--metadata", type=Path, default=ROOT / "src/data/speciesMetadata.json")
    parser.add_argument("--output-root", type=Path, default=ROOT)
    parser.add_argument("--check", action="store_true", help="Fail if the committed output differs from the input extracts")
    args = parser.parse_args()
    built = outputs(args.input_dir, args.metadata)
    for relative, contents in built.items():
        path = args.output_root / relative
        if args.check:
            if not path.exists() or path.read_bytes() != contents:
                raise SystemExit(f"Outdated curated output: {relative}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(contents)
        print(relative, len(contents), "bytes")


if __name__ == "__main__":
    main()
