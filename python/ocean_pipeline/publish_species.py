"""Verify scoped OBIS extracts and publish compact, cited observation snapshots."""

from __future__ import annotations

from collections import Counter
from datetime import date, datetime
import gzip
import hashlib
import json
import math
from pathlib import Path

# Dataset citations and licenses were checked against OBIS /v3/dataset/{id}
# intellectualrights on 2026-09-27. A refresh needs a renewed rights review.
STUDIES = {
    "tuna-west-med": dict(species="Thunnus thynnus", taxon=127029,
        dataset="eaea291a-1e1d-4382-b86f-ac3cc15b8d5a", bounds=[-6,35,14,44],
        start="2014-01-01", end="2024-12-31", region="Mediterráneo occidental",
        citation="iNaturalist contributors, iNaturalist (2026). iNaturalist Research-grade Observations Marine Subset. Version 2.0. Marine Biological Association. https://doi.org/10.17031/0bbcjx",
        license="CC BY-NC 4.0"),
    "whale-shark-gulf": dict(species="Rhincodon typus", taxon=105847,
        dataset="eaea291a-1e1d-4382-b86f-ac3cc15b8d5a", bounds=[-92,17,-84,26],
        start="2014-01-01", end="2024-12-31", region="Golfo de México",
        citation="iNaturalist contributors, iNaturalist (2026). iNaturalist Research-grade Observations Marine Subset. Version 2.0. Marine Biological Association. https://doi.org/10.17031/0bbcjx",
        license="CC BY-NC 4.0"),
    "swordfish-west-med": dict(species="Xiphias gladius", taxon=127094,
        dataset="da5982a8-e9a1-46af-ab1b-8293edb79c5d", bounds=[-6,35,14,44],
        start="2014-01-01", end="2024-12-31", region="Mediterráneo sudoccidental · costa de España",
        citation="Murcia Abellán J L, Morata A (2026). ANSE Marine megafauna visual surveys in Southeastern Spanish Mediterranean. Version 1.3. ANSE. https://ipt.vliz.be/eurobis/resource?r=anse_mmvs_2014-onwards",
        license="CC BY-NC 4.0"),
    "humpback-gulf-maine": dict(species="Megaptera novaeangliae", taxon=137092,
        dataset="c7d259da-370a-4504-9445-29de96d9223a", bounds=[-72,39,-59,48],
        start="2022-01-01", end="2022-12-31", region="Golfo de Maine · Atlántico noroccidental",
        citation="Cole, T., C. Khan and A. Ogilvie (2025). NEFSC Right Whale Aerial Survey in 2022. Version 1.0.0. OBIS-SEAMAP. https://doi.org/10.82144/9f540955",
        license="CC0 1.0"),
    "bottlenose-west-med": dict(species="Tursiops truncatus", taxon=137111,
        dataset="d5847ecb-6f9b-4599-888a-461cb26f8018", bounds=[-2,37,12,44],
        start="2014-01-01", end="2018-12-31", region="Mediterráneo occidental · transecto Barcelona–Civitavecchia",
        citation="Arcangeli, A., Campana, I., Paraboschi, M.; ISPRA (2018). Presence of cetacean species collected through Fixed-Line-Transect monitoring across the Western Mediterranean Sea (Civitavecchia-Barcelona route) between 2014 and 2018. https://doi.org/10.14284/533",
        license="CC BY 4.0"),
    "green-turtle-caribbean": dict(species="Chelonia mydas", taxon=137206,
        dataset="eaea291a-1e1d-4382-b86f-ac3cc15b8d5a", bounds=[-86,16,-74,27],
        start="2014-01-01", end="2024-12-31", region="Caribe noroccidental",
        citation="iNaturalist contributors, iNaturalist (2026). iNaturalist Research-grade Observations Marine Subset. Version 2.0. Marine Biological Association. https://doi.org/10.17031/0bbcjx",
        license="CC BY-NC 4.0"),
}


def build_snapshot(slug: str, extract_path: Path, manifest_path: Path) -> dict:
    study = STUDIES[slug]
    raw = gzip.decompress(extract_path.read_bytes()) if extract_path.suffix == ".gz" else extract_path.read_bytes()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if hashlib.sha256(raw).hexdigest() != manifest["extract_sha256"]:
        raise ValueError("Extract checksum differs from manifest")
    query = manifest["query"]
    expected = (str(study["taxon"]), study["dataset"], study["bounds"], study["start"], study["end"])
    if (str(query["taxonid"]), query["datasetid"], query["bounds_wgs84"], query["startdate"], query["enddate"]) != expected:
        raise ValueError("Unexpected taxon, dataset, region or date range")
    if manifest["truncated_by_cap"]:
        raise ValueError("Incomplete extract")
    records, excluded = [], Counter()
    lines = raw.splitlines()
    if len(lines) != manifest["counts"]["written"] or len(lines) != manifest["counts"]["api_total_reported"]:
        raise ValueError("Extract count does not match complete API result")
    for line in lines:
        row = json.loads(line)
        lon, lat = row.get("decimalLongitude"), row.get("decimalLatitude")
        event, uncertainty = row.get("eventDate"), row.get("coordinateUncertaintyInMeters")
        flags = row.get("flags")
        if (row.get("dataset_id") != study["dataset"] or row.get("aphiaID") != study["taxon"]
                or row.get("speciesid") != study["taxon"] or row.get("marine") is not True
                or row.get("absence") is not False or row.get("dropped") is not False
                or row.get("occurrenceStatus") not in ("present", f"urn:lsid:marinespecies.org:taxname:{study['taxon']}")
                or not isinstance(flags, list) or set(flags) - {"NO_DEPTH", "ON_LAND"}
                or not isinstance(row.get("id"), str) or not row["id"]
                or not all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in (lon, lat))
                or (uncertainty is not None and (not isinstance(uncertainty, (int, float)) or not math.isfinite(uncertainty) or uncertainty < 0))
                or not isinstance(event, str)):
            raise ValueError("Unreviewed or invalid occurrence in extract")
        try:
            observed = datetime.fromisoformat(event).date()
        except ValueError as exc:
            raise ValueError("Invalid event date") from exc
        if not date.fromisoformat(study["start"]) <= observed <= date.fromisoformat(study["end"]):
            raise ValueError("Occurrence outside study period")
        if not study["bounds"][0] <= lon <= study["bounds"][2] or not study["bounds"][1] <= lat <= study["bounds"][3]:
            raise ValueError("Occurrence outside study region")
        if "ON_LAND" in flags:
            excluded["obis_on_land"] += 1
            continue
        # A position with a >300 km stated radius can pull one regional square
        # far from the sampled waters. Record the exclusion explicitly.
        if uncertainty is not None and uncertainty > 300_000:
            excluded["uncertainty_over_300_km"] += 1
            continue
        records.append({"id": row["id"], "longitude": lon, "latitude": lat,
                        "eventDate": event, "coordinateUncertaintyInMeters": uncertainty})
    if not records or len({record["id"] for record in records}) != len(records):
        raise ValueError("Empty or duplicate reviewed observations")
    records.sort(key=lambda record: record["id"])
    uncertainties = [r["coordinateUncertaintyInMeters"] for r in records if r["coordinateUncertaintyInMeters"] is not None]
    return {
        "schemaVersion": 1, "species": study["species"], "aphiaID": study["taxon"],
        "region": study["region"], "period": f'{study["start"][:4]}–{study["end"][:4]}',
        "boundsWgs84": study["bounds"],
        "source": {"name": "Ocean Biodiversity Information System (OBIS)",
                   "datasetId": study["dataset"], "url": f'https://obis.org/dataset/{study["dataset"]}',
                   "citation": study["citation"], "license": study["license"],
                   "accessedAtUtc": manifest["accessed_at_utc"], "extractSha256": manifest["extract_sha256"]},
        "summary": {"count": len(records), "byYear": dict(sorted(Counter(r["eventDate"][:4] for r in records).items())),
                    "excluded": dict(excluded),
                    "unknownCoordinateUncertainty": len(records) - len(uncertainties),
                    "uncertaintyKmRange": [round(min(uncertainties) / 1000), round(max(uncertainties) / 1000)] if uncertainties else None},
        "observations": records,
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("slug", choices=STUDIES)
    parser.add_argument("--extract", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    snapshot = build_snapshot(arguments.slug, arguments.extract, arguments.manifest)
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
