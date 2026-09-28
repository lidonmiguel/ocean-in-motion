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
# intellectualrights on 2026-09-27 and 2026-09-28. A refresh needs a renewed rights review.
INAT_DATASET = "eaea291a-1e1d-4382-b86f-ac3cc15b8d5a"
INAT_CITATION = ("iNaturalist contributors, iNaturalist (2026). iNaturalist Research-grade "
                 "Observations Marine Subset. Version 2.0. Marine Biological Association. "
                 "https://doi.org/10.17031/0bbcjx")

STUDIES = {
    "tuna-west-med": dict(species="Thunnus thynnus", taxon=127029,
        dataset="eaea291a-1e1d-4382-b86f-ac3cc15b8d5a", bounds=[-6,35,14,44],
        start="2014-01-01", end="2024-12-31", region="Mediterráneo occidental",
        citation="iNaturalist contributors, iNaturalist (2026). iNaturalist Research-grade Observations Marine Subset. Version 2.0. Marine Biological Association. https://doi.org/10.17031/0bbcjx",
        license="CC BY-NC 4.0"),
    "tuna-ny-bight": dict(species="Thunnus thynnus", taxon=127029,
        dataset="ca78b5b9-d4e4-4ab0-bbe1-9f75659769e2", bounds=[-75,38,-69,43],
        start="2014-01-01", end="2024-12-31", period="2017–2018", uncertainty_decimals=3,
        region="Atlántico noroccidental · plataforma frente a Nueva York",
        citation="Vukovich, M. (2022). Digital Aerial Baseline Survey of Marine Wildlife in Support of Offshore Wind Energy - OPA 2017. Version 1.3.0. OBIS-SEAMAP. https://doi.org/10.82144/2972b82d",
        license="CC BY 4.0"),
    "tuna-biscay": dict(species="Thunnus thynnus", taxon=127029,
        dataset="924c4d25-6358-44a3-8f4d-24086256ad3e", bounds=[-12,42,-1,50],
        start="2014-01-01", end="2024-12-31", period="2015–2021", region="Golfo de Vizcaya · campañas PELAGIS",
        citation="Doremus, G. and H. Peltier (2025). Observatoire Pelagis boat surveys 2003-2021. Version 2.1.0. OBIS-SEAMAP. https://doi.org/10.82144/c7d01c61",
        license="CC BY-NC 4.0"),
    "tuna-hatteras": dict(species="Thunnus thynnus", taxon=127029,
        dataset="5055f146-1a0a-41be-a747-24968c2cf584", bounds=[-82,30,-74,39],
        start="2014-01-01", end="2024-12-31", period="2018", cluster_diameter_km=500,
        region="Atlántico noroccidental · costa de Carolina del Norte",
        citation="Vukovich, M. (2022). Ecological Baseline Studies of the U.S. Outer Continental Shelf Option Year 1. Version 1.4.0. OBIS-SEAMAP. https://doi.org/10.82144/47a6c4f3",
        license="CC BY 4.0"),
    "tuna-ionian": dict(species="Thunnus thynnus", taxon=127029,
        dataset="b14abb47-b481-4272-a8d6-d4e2b612dce9", bounds=[12,34,20,40],
        start="2014-01-01", end="2024-12-31", period="2015–2019", cluster_diameter_km=500,
        region="Mar Jónico · costa de Sicilia",
        citation="Monaco, C., Garofalo, D., Raffa, A., MareCamp Association, Cavallè, M. and LIFE platform (2020). Observation of marine vulnerable mobile species in Sicilian waters, Ionian Sea (surveys 2015-2019). https://obis.org/dataset/b14abb47-b481-4272-a8d6-d4e2b612dce9",
        license="CC BY 4.0"),
    "tuna-east-med": dict(species="Thunnus thynnus", taxon=127029,
        dataset="eaea291a-1e1d-4382-b86f-ac3cc15b8d5a", bounds=[23,30,37,42],
        start="2014-01-01", end="2024-12-31", period="2014–2020", cluster_diameter_km=500,
        region="Mediterráneo oriental · Egeo y costa de Anatolia",
        citation="iNaturalist contributors, iNaturalist (2026). iNaturalist Research-grade Observations Marine Subset. Version 2.0. Marine Biological Association. https://doi.org/10.17031/0bbcjx",
        license="CC BY-NC 4.0"),
    "tuna-north-sea": dict(species="Thunnus thynnus", taxon=127029,
        dataset="eaea291a-1e1d-4382-b86f-ac3cc15b8d5a", bounds=[-5,50,14,63],
        start="2014-01-01", end="2024-12-31", period="2019–2024", cluster_diameter_km=500,
        region="Mar del Norte y aguas adyacentes",
        citation="iNaturalist contributors, iNaturalist (2026). iNaturalist Research-grade Observations Marine Subset. Version 2.0. Marine Biological Association. https://doi.org/10.17031/0bbcjx",
        license="CC BY-NC 4.0"),
    "tuna-nova-scotia": dict(species="Thunnus thynnus", taxon=127029,
        dataset="eaea291a-1e1d-4382-b86f-ac3cc15b8d5a", bounds=[-63,42,-42,55],
        start="2014-01-01", end="2024-12-31", period="2020–2024", cluster_diameter_km=500,
        region="Atlántico canadiense · Nueva Escocia y Terranova",
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

# The additional regional extracts share one bounded baseline but have their
# own exact taxon, source dataset and WGS84 search area. The published date
# labels below reflect the accepted records, not an assumed survey period.
ADDITIONAL_REGIONS = {
    "whale-shark-gulf-cal": ("Rhincodon typus", 105847, INAT_DATASET, [-114,18,-99,31], "Golfo de California", INAT_CITATION, "CC BY-NC 4.0"),
    "whale-shark-philippines": ("Rhincodon typus", 105847, INAT_DATASET, [114,0,131,22], "Filipinas y mar de Célebes", INAT_CITATION, "CC BY-NC 4.0"),
    "whale-shark-ningaloo": ("Rhincodon typus", 105847, INAT_DATASET, [111,-26,117,-17], "Ningaloo · Australia occidental", INAT_CITATION, "CC BY-NC 4.0"),
    "whale-shark-mozambique": ("Rhincodon typus", 105847, INAT_DATASET, [34,-28,45,-10], "Costa de Mozambique", INAT_CITATION, "CC BY-NC 4.0"),
    "whale-shark-maldives": ("Rhincodon typus", 105847, INAT_DATASET, [70,-2,76,9], "Maldivas", INAT_CITATION, "CC BY-NC 4.0"),
    "swordfish-east-med": ("Xiphias gladius", 127094, INAT_DATASET, [14,30,37,43], "Mediterráneo oriental", INAT_CITATION, "CC BY-NC 4.0"),
    "swordfish-us-east": ("Xiphias gladius", 127094, INAT_DATASET, [-82,25,-66,44], "Atlántico occidental · costa de EE. UU.", INAT_CITATION, "CC BY-NC 4.0"),
    "swordfish-california": ("Xiphias gladius", 127094, INAT_DATASET, [-126,28,-114,44], "Pacífico oriental · California", INAT_CITATION, "CC BY-NC 4.0"),
    "swordfish-iberian": ("Xiphias gladius", 127094, INAT_DATASET, [-15,32,-6.1,46], "Atlántico ibérico", INAT_CITATION, "CC BY-NC 4.0"),
    "humpback-hawaii": ("Megaptera novaeangliae", 137092, "9fc29d00-9998-4059-b0bd-f28cfa63a793", [-162,18,-153,24], "Hawái · prospección en embarcación", "Ampela, K. and C. Bacon (2023). CRC HRC PMRF Small Vessel-Based Monitoring Surveys February 2015. Version 1.0.0. OBIS-SEAMAP. https://doi.org/10.82144/1210f715", "CC BY 4.0"),
    "humpback-alaska": ("Megaptera novaeangliae", 137092, "1dc828ac-d522-4ebf-97c3-e5a521b4509c", [-160,52,-130,64], "Alaska · campaña CLAWS", "Moore, J. and D. Weller (2021). SWFSC Marine Mammal Survey, CLAWS 2015, Cruise 1648. Version 1.0.0. OBIS-SEAMAP. https://doi.org/10.82144/a997e4fc", "CC0 1.0"),
    "humpback-australia": ("Megaptera novaeangliae", 137092, "3f424661-13b8-4008-8600-091bf43037ad", [145,-40,158,-12], "Mar de Tasmania · campaña RV Investigator", "Slip, D. (2025). RV Investigator Voyage IN2017_V04 Cetacean and Seabird Observations, Tasman Sea, Australia (2017). Version 1.7. CSIRO. https://www.marine.csiro.au/ipt/resource?r=in2017_v04_wov&v=1.7", "CC BY-NC 4.0"),
    "humpback-south-africa": ("Megaptera novaeangliae", 137092, INAT_DATASET, [13,-38,39,-22], "Sudáfrica y Mozambique", INAT_CITATION, "CC BY-NC 4.0"),
    "humpback-iceland": ("Megaptera novaeangliae", 137092, INAT_DATASET, [-28,62,-12,68], "Islandia", INAT_CITATION, "CC BY-NC 4.0"),
    "bottlenose-gulf-mexico": ("Tursiops truncatus", 137111, "717041c4-dd72-4457-8963-4e63e8e35710", [-98,18,-80,32], "Golfo de México · prospección aérea", "Rappucci, G. and L. Garrison (2019). SEFSC GoMMAPPS 2018 Winter Aerial Survey. Version 1.0.0. OBIS-SEAMAP. https://doi.org/10.82144/dbf0d8a9", "CC0 1.0"),
    "bottlenose-california": ("Tursiops truncatus", 137111, "86ffd903-47fc-435e-a42e-f3aec79c2d03", [-127,29,-115,44], "California · Happywhale", "Happywhale (2026). Happywhale - Common bottlenose dolphin in North Pacific Ocean. Version 1.28.0. OBIS-SEAMAP. https://doi.org/10.82144/4b1f9bc3", "CC BY-NC 4.0"),
    "bottlenose-australia": ("Tursiops truncatus", 137111, INAT_DATASET, [145,-40,158,-11], "Australia oriental", INAT_CITATION, "CC BY-NC 4.0"),
    "bottlenose-caribbean": ("Tursiops truncatus", 137111, INAT_DATASET, [-73,8,-59,24], "Caribe oriental", INAT_CITATION, "CC BY-NC 4.0"),
    "bottlenose-south-africa": ("Tursiops truncatus", 137111, INAT_DATASET, [28,-36,47,-10], "Costa sudafricana del Índico", INAT_CITATION, "CC BY-NC 4.0"),
    "green-turtle-hawaii": ("Chelonia mydas", 137206, "57fc04f0-c9f9-4d2f-9030-bf7281afda92", [-162,18,-153,24], "Hawái · observación desde la costa", "Ampela, K. and C. Bacon (2019). CRC HRC Shore-based Surveys KB11 2013-2015. Version 1.0.1. OBIS-SEAMAP. https://doi.org/10.82144/0b3df86e", "CC BY 4.0"),
    "green-turtle-australia": ("Chelonia mydas", 137206, "0ae49e4e-ad4c-4b89-be2e-b6003c0038ec", [141,-30,155,-10], "Nueva Gales del Sur · BioNet", "BioNet Species Sightings occurrence data held by the NSW Office of Environment and Heritage (OEH). The BioNet repository holds data from a number of sources and custodians. Accessed through OBIS Data Portal. https://obis.org/dataset/0ae49e4e-ad4c-4b89-be2e-b6003c0038ec", "CC BY 4.0"),
    "green-turtle-red-sea": ("Chelonia mydas", 137206, INAT_DATASET, [32,12,44,30], "Mar Rojo", INAT_CITATION, "CC BY-NC 4.0"),
    "green-turtle-seychelles": ("Chelonia mydas", 137206, INAT_DATASET, [45,-12,61,0], "Seychelles", INAT_CITATION, "CC BY-NC 4.0"),
    "green-turtle-galapagos": ("Chelonia mydas", 137206, INAT_DATASET, [-92,-3,-89,2], "Galápagos", INAT_CITATION, "CC BY-NC 4.0"),
    "loggerhead-florida": ("Caretta caretta", 137205, "eeb7f0c5-dfe8-4a07-b273-6dc4a634cc14", [-85,23,-74,35], "Florida · prospección aérea", "Dias, L. and L. Garrison (2019). AMAPPS Southeast Aerial Cruise Spring 2019. Version 1.0.0. OBIS-SEAMAP. https://doi.org/10.82144/00cc08bb", "CC0 1.0"),
    "loggerhead-east-med": ("Caretta caretta", 137205, "7225dc7b-dd9a-4bec-b689-f084a49d13eb", [14,30,37,43], "Mediterráneo oriental · prospección aérea", "Panigada, S., J. Ozog and N. Pierantonio (2025). Tethys Research Institute aerial survey sightings 2021. Version 1.0.0. OBIS-SEAMAP. https://doi.org/10.82144/bc0219f8", "CC BY-NC 4.0"),
    "loggerhead-japan": ("Caretta caretta", 137205, INAT_DATASET, [125,24,148,46], "Japón", INAT_CITATION, "CC BY-NC 4.0"),
    "loggerhead-australia": ("Caretta caretta", 137205, INAT_DATASET, [145,-40,158,-14], "Australia oriental", INAT_CITATION, "CC BY-NC 4.0"),
    "loggerhead-south-africa": ("Caretta caretta", 137205, INAT_DATASET, [16,-38,37,-25], "Sudáfrica", INAT_CITATION, "CC BY-NC 4.0"),
}

for slug, (species, taxon, dataset, bounds, region, citation, license) in ADDITIONAL_REGIONS.items():
    STUDIES[slug] = dict(species=species, taxon=taxon, dataset=dataset,
                         bounds=bounds, start="2014-01-01", end="2024-12-31",
                         region=region, citation=citation, license=license,
                         cluster_diameter_km=500)

# Distinct, nonoverlapping marine queries verified from complete OBIS responses.
# The iNaturalist Marine dataset carries CC BY-NC 4.0 rights; these observations
# are sightings, not tracks or systematic absence/presence surveys.
NEW_SPECIES_REGIONS = {
    "orca-pacific-nw": ("Orcinus orca", 137102, [-155, 45, -120, 65], "Pacífico nororiental · Alaska y costa noroeste"),
    "orca-north-atlantic": ("Orcinus orca", 137102, [-30, 56, 25, 72], "Atlántico norte · Islandia y Noruega"),
    "orca-new-zealand": ("Orcinus orca", 137102, [165, -49, 180, -30], "Pacífico suroccidental · Nueva Zelanda"),
    "orca-patagonia": ("Orcinus orca", 137102, [-78, -58, -52, -38], "Atlántico sudoccidental · Patagonia"),
    "white-shark-california": ("Carcharodon carcharias", 105838, [-130, 25, -114, 45], "Pacífico oriental · California"),
    "white-shark-south-africa": ("Carcharodon carcharias", 105838, [15, -40, 37, -22], "Atlántico e Índico · Sudáfrica"),
    "white-shark-east-australia": ("Carcharodon carcharias", 105838, [145, -42, 160, -22], "Mar de Tasmania · Australia oriental"),
    "white-shark-us-atlantic": ("Carcharodon carcharias", 105838, [-82, 30, -66, 47], "Atlántico noroccidental · costa de EE. UU."),
    "leatherback-us-atlantic": ("Dermochelys coriacea", 137209, [-82, 25, -60, 50], "Atlántico noroccidental · costa de EE. UU."),
    "leatherback-caribbean": ("Dermochelys coriacea", 137209, [-90, 5, -60, 24.9], "Caribe"),
    "leatherback-australia": ("Dermochelys coriacea", 137209, [110, -43, 155, -10], "Índico y Pacífico · Australia"),
}

for slug, (species, taxon, bounds, region) in NEW_SPECIES_REGIONS.items():
    STUDIES[slug] = dict(species=species, taxon=taxon, dataset=INAT_DATASET,
                         bounds=bounds, start="2014-01-01", end="2024-12-31",
                         region=region, citation=INAT_CITATION, license="CC BY-NC 4.0",
                         cluster_diameter_km=500)


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
        # Species-level OBIS queries can include subordinate, unaccepted
        # names. Validate their source, position and date, then count their
        # exclusion explicitly instead of assigning them to the exact taxon.
        subordinate = (isinstance(flags, list) and "NO_ACCEPTED_NAME" in flags
                       and row.get("speciesid") == study["taxon"]
                       and row.get("aphiaID") != study["taxon"])
        if (row.get("dataset_id") != study["dataset"] or (row.get("aphiaID") != study["taxon"] and not subordinate)
                or row.get("speciesid") != study["taxon"] or row.get("marine") is not True
                or row.get("absence") is not False or row.get("dropped") is not False
                or row.get("occurrenceStatus") not in ("present", f"urn:lsid:marinespecies.org:taxname:{row.get('aphiaID')}")
                or not isinstance(flags, list) or set(flags) - {"NO_DEPTH", "ON_LAND", "NO_ACCEPTED_NAME"}
                or ("NO_ACCEPTED_NAME" in flags and not subordinate)
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
        if subordinate:
            excluded["no_accepted_name"] += 1
            continue
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
    observed_years = sorted({record["eventDate"][:4] for record in records})
    observed_period = (observed_years[0] if len(observed_years) == 1
                       else f"{observed_years[0]}–{observed_years[-1]}")
    return {
        "schemaVersion": 1, "species": study["species"], "aphiaID": study["taxon"],
        "region": study["region"], "period": study.get("period", observed_period if slug in ADDITIONAL_REGIONS or slug in NEW_SPECIES_REGIONS
            else f'{study["start"][:4]}–{study["end"][:4]}'),
        **({"clusterDiameterKm": study["cluster_diameter_km"]} if "cluster_diameter_km" in study else {}),
        "boundsWgs84": study["bounds"],
        "source": {"name": "Ocean Biodiversity Information System (OBIS)",
                   "datasetId": study["dataset"], "url": f'https://obis.org/dataset/{study["dataset"]}',
                   "citation": study["citation"], "license": study["license"],
                   "accessedAtUtc": manifest["accessed_at_utc"], "extractSha256": manifest["extract_sha256"]},
        "summary": {"count": len(records), "byYear": dict(sorted(Counter(r["eventDate"][:4] for r in records).items())),
                    "excluded": dict(excluded),
                    "unknownCoordinateUncertainty": len(records) - len(uncertainties),
                    "uncertaintyKmRange": [round(min(uncertainties) / 1000, study.get("uncertainty_decimals", 0)),
                                           round(max(uncertainties) / 1000, study.get("uncertainty_decimals", 0))] if uncertainties else None},
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
