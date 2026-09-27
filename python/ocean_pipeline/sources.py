"""Bounded OBIS occurrence staging; Bio-ORACLE remains a future step."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import date, datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

OBIS_URL = "https://api.obis.org/v3/occurrence"
MAX_RECORDS = 10_000
PAGE_SIZE = 200


@dataclass(frozen=True)
class SourcePlan:
    taxon_id: str  # resolved WoRMS AphiaID
    bounds: tuple[float, float, float, float]  # west, south, east, north (WGS84)
    start_date: str
    end_date: str
    max_records: int
    scenario: str = "SSP2-4.5"
    target_year: int = 2050
    dataset_id: str | None = None  # optional OBIS source dataset UUID

    def __post_init__(self) -> None:
        if not isinstance(self.taxon_id, str) or not re.fullmatch(r"[1-9][0-9]*", self.taxon_id):
            raise ValueError("A positive numeric WoRMS AphiaID is required")
        if len(self.bounds) != 4 or any(
            isinstance(v, bool) or not isinstance(v, (float, int)) or not math.isfinite(v)
            for v in self.bounds
        ):
            raise ValueError("Bounds must contain four finite WGS84 numbers")
        west, south, east, north = self.bounds
        if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
            raise ValueError("Bounds must be ordered and must not wrap the antimeridian")
        try:
            start, end = date.fromisoformat(self.start_date), date.fromisoformat(self.end_date)
            if start.isoformat() != self.start_date or end.isoformat() != self.end_date:
                raise ValueError
        except (TypeError, ValueError) as exc:
            raise ValueError("Dates must be valid YYYY-MM-DD values") from exc
        if start > end:
            raise ValueError("Start date must not exceed end date")
        if isinstance(self.max_records, bool) or not isinstance(self.max_records, int) or not 1 <= self.max_records <= MAX_RECORDS:
            raise ValueError(f"max_records must be between 1 and {MAX_RECORDS}")
        if self.scenario != "SSP2-4.5" or self.target_year != 2050:
            raise ValueError("The initial pipeline supports only SSP2-4.5 for 2050")
        if self.dataset_id is not None and not re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", self.dataset_id):
            raise ValueError("dataset_id must be a lowercase UUID")


def _geometry(bounds: tuple[float, float, float, float]) -> str:
    west, south, east, north = bounds
    return f"POLYGON(({west:g} {south:g},{east:g} {south:g},{east:g} {north:g},{west:g} {north:g},{west:g} {south:g}))"


def _page_url(plan: SourcePlan, offset: int, size: int, after: str | None = None) -> str:
    params = {
        "taxonid": plan.taxon_id, "geometry": _geometry(plan.bounds),
        "startdate": plan.start_date, "enddate": plan.end_date,
        "size": size,
    }
    # OBIS currently ignores offset for occurrence queries; use its stable id cursor.
    if after is not None:
        params["after"] = after
    if plan.dataset_id:
        params["datasetid"] = plan.dataset_id
    return OBIS_URL + "?" + urlencode(params)


def _fetch_page(url: str) -> tuple[dict, dict[str, str]]:
    try:
        with urlopen(Request(url, headers={"Accept": "application/json", "User-Agent": "ocean-in-motion/0.1"}), timeout=30) as response:
            payload = json.load(response)
            headers = {key: response.headers[key] for key in ("ETag", "Last-Modified") if response.headers.get(key)}
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
        raise RuntimeError(f"OBIS request failed for {url}: {exc}") from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
        raise RuntimeError("OBIS returned an unexpected occurrence response")
    return payload, headers


def _valid_position(row: dict, bounds: tuple[float, float, float, float]) -> bool:
    lon, lat = row.get("decimalLongitude"), row.get("decimalLatitude")
    return (
        isinstance(lon, (int, float)) and not isinstance(lon, bool) and math.isfinite(lon)
        and isinstance(lat, (int, float)) and not isinstance(lat, bool) and math.isfinite(lat)
        and -180 <= lon <= 180 and -90 <= lat <= 90
        and bounds[0] <= lon <= bounds[2] and bounds[1] <= lat <= bounds[3]
    )


def _identities(row: dict) -> set[tuple[str, ...]]:
    # OBIS id is globally unique; provider occurrenceID is scoped to a dataset.
    keys = set()
    if row.get("id"):
        keys.add(("obis", str(row["id"])))
    if row.get("dataset_id") and row.get("occurrenceID"):
        keys.add(("provider", str(row["dataset_id"]), str(row["occurrenceID"])))
    return keys  # Co-located observations are not necessarily duplicates.


def stage_obis_occurrences(plan: SourcePlan, extract_path: Path, manifest_path: Path) -> dict:
    """Stage at most max_records API rows before QC, without overwriting files."""
    extract_path, manifest_path = Path(extract_path), Path(manifest_path)
    if extract_path == manifest_path or extract_path.exists() or manifest_path.exists():
        raise FileExistsError("Choose distinct, unused extract and manifest paths")
    rows: list[dict] = []
    pages: list[dict] = []
    headers: list[dict[str, str]] = []
    total: int | None = None
    after: str | None = None
    while len(rows) < plan.max_records:
        offset, size = len(rows), min(PAGE_SIZE, plan.max_records - len(rows))
        url = _page_url(plan, offset, size, after)
        payload, response_headers = _fetch_page(url)
        page = payload["results"]
        if len(page) > size or any(not isinstance(row, dict) for row in page):
            raise RuntimeError("OBIS returned too many results or an invalid row")
        reported = payload.get("total")
        if reported is not None:
            if isinstance(reported, bool) or not isinstance(reported, int) or reported < 0:
                raise RuntimeError("OBIS returned an invalid total")
            if total is not None and reported != total:
                raise RuntimeError("OBIS total changed during pagination")
            total = reported
        rows.extend(page)
        pages.append({"offset": offset, "after": after, "size": size, "received": len(page), "url": url})
        headers.append(response_headers)
        if total is not None and len(rows) > total:
            raise RuntimeError("OBIS returned more than its reported total")
        if len(page) < size or (total is not None and len(rows) == total):
            if total is not None and len(rows) != total:
                raise RuntimeError("OBIS page ended before its reported total")
            break
        cursor = page[-1].get("id")
        if not isinstance(cursor, str) or not cursor or cursor == after:
            raise RuntimeError("OBIS pagination requires a progressing occurrence id cursor")
        after = cursor

    kept: list[dict] = []
    seen: set[tuple[str, ...]] = set()
    invalid = duplicates = unkeyed = 0
    for row in rows:
        if not _valid_position(row, plan.bounds):
            invalid += 1
            continue
        keys = _identities(row)
        if not keys:
            unkeyed += 1
        elif keys & seen:
            duplicates += 1
            continue
        else:
            seen.update(keys)
        kept.append(row)

    datasets: dict[str, dict] = {}
    for row in kept:
        dataset_id = row.get("dataset_id")
        if dataset_id is None:
            continue
        entry = datasets.setdefault(str(dataset_id), {"dataset_id": str(dataset_id), "records": 0})
        entry["records"] += 1
        for field in ("datasetName", "license", "rightsHolder", "bibliographicCitation", "modified"):
            value = row.get(field)
            if value is not None:
                entry.setdefault(field, [])
                if value not in entry[field]:
                    entry[field].append(value)
    accessed = datetime.now(timezone.utc).isoformat()
    manifest = {
        "schema_version": 1,
        "source": {"name": "Ocean Biodiversity Information System (OBIS)", "api": OBIS_URL,
                   "api_version": "v3", "response_headers": headers,
                   "record_modified_values": sorted({str(row["modified"]) for row in kept if row.get("modified")})},
        "accessed_at_utc": accessed,
        "query": {"taxonid": plan.taxon_id, "bounds_wgs84": list(plan.bounds), "geometry": _geometry(plan.bounds),
                  "datasetid": plan.dataset_id,
                  "startdate": plan.start_date, "enddate": plan.end_date, "max_records": plan.max_records,
                  "page_size": PAGE_SIZE, "pagination": "after occurrence id", "pages": pages},
        "counts": {"api_total_reported": total, "raw_fetched": len(rows),
                   "invalid_coordinates_or_outside_bounds": invalid, "after_coordinate_qc": len(rows) - invalid,
                   "duplicate_identifiers": duplicates, "without_duplicate_identifier": unkeyed, "written": len(kept)},
        "truncated_by_cap": len(rows) == plan.max_records and (total is None or total > len(rows)),
        "attribution": {
            "obis": f"OBIS ({accessed[:4]}) Ocean Biodiversity Information System. Intergovernmental Oceanographic Commission of UNESCO. https://obis.org. Accessed: {accessed[:10]}",
            "datasets": [datasets[key] for key in sorted(datasets)],
            "note": "Review each contributing dataset's citation and license before reuse; missing fields are not a grant of rights.",
        },
        "extract": str(extract_path),
        "qc_rule": "Reject missing, non-finite, out-of-range or outside-box coordinates; de-duplicate on repeated OBIS id or dataset_id + occurrenceID. Do not collapse equal positions.",
    }
    extract_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_created = False
    try:
        digest = hashlib.sha256()
        with extract_path.open("x", encoding="utf-8") as output:
            for row in kept:
                line = json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n"
                output.write(line)
                digest.update(line.encode("utf-8"))
        manifest["extract_sha256"] = digest.hexdigest()
        with manifest_path.open("x", encoding="utf-8") as output:
            manifest_created = True
            json.dump(manifest, output, indent=2, ensure_ascii=False, sort_keys=True)
            output.write("\n")
    except Exception:
        extract_path.unlink(missing_ok=True)
        if manifest_created:
            manifest_path.unlink(missing_ok=True)
        raise
    return manifest


def stage_bio_oracle_environment(plan: SourcePlan, destination: Path) -> None:
    """TODO: select compatible Bio-ORACLE layers, periods, depth and scenario."""
    raise NotImplementedError("Bio-ORACLE integration awaits predictor selection")


def main() -> None:
    parser = argparse.ArgumentParser(description="Stage a small, explicitly bounded OBIS occurrence extract")
    parser.add_argument("--taxon-id", required=True, help="resolved WoRMS AphiaID")
    parser.add_argument("--bounds", required=True, nargs=4, type=float, metavar=("WEST", "SOUTH", "EAST", "NORTH"))
    parser.add_argument("--start-date", required=True)
    parser.add_argument("--end-date", required=True)
    parser.add_argument("--max-records", required=True, type=int)
    parser.add_argument("--dataset-id", help="optional OBIS source dataset UUID")
    parser.add_argument("--extract", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    args = parser.parse_args()
    plan = SourcePlan(args.taxon_id, tuple(args.bounds), args.start_date, args.end_date, args.max_records, dataset_id=args.dataset_id)
    stage_obis_occurrences(plan, args.extract, args.manifest)


if __name__ == "__main__":
    main()
