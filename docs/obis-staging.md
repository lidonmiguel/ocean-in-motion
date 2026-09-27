# Bounded OBIS occurrence staging

The Python source stage writes raw OBIS occurrence rows as JSON Lines and
a JSON manifest. It does not update the published map automatically. Supply a
resolved **WoRMS AphiaID**, a non-wrapping WGS84 box (west south east north),
an inclusive baseline date window, and a raw-record cap. For example, replace
every bracketed value with a chosen study scope:

```bash
PYTHONPATH=python python -m ocean_pipeline.sources \
  --taxon-id <APHIA_ID> \
  --bounds <WEST> <SOUTH> <EAST> <NORTH> \
  --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD> \
  --max-records 50 \
  --dataset-id <OPTIONAL_DATASET_UUID> \
  --extract output/occurrences.jsonl \
  --manifest output/occurrences.manifest.json
```

Run from the repository root, or first install
`python -m pip install -e ./python` and omit `PYTHONPATH=python`.
Both output paths are configurable,
must differ, and must not exist. No taxon, area or baseline is selected by
the generic command. The seven displayed layers use documented datasets;
see the README. If the box crosses the antimeridian, choose separate bounded
runs. The hard cap is 10,000 raw API records; pages request at most 200.
The cap applies before quality control and the manifest says when a reported
total exceeds it. An exact-cap response with no reported total is marked
possibly truncated. Do not interpret the first N API rows as an unbiased
sample.

The request uses the OBIS [v3 occurrence API](https://api.obis.org/)
parameters documented by the OBIS project's
[Python client](https://iobis.github.io/pyobis/occurrences.html):
`taxonid`, optional `datasetid`, WKT `geometry`, `startdate`, `enddate`, `size` and `after`.
In live queries on 2026-09-27, OBIS repeated the first page when given
`offset` for extracts larger than 200 rows. Staging now advances with the last
occurrence `id`, validates the reported total and rejects repeated pages.
OBIS's [data access guidance](https://portal.obis.org/data/access/) recommends
the API for smaller subsets and points large analyses to bulk data.
The [OBIS manual](https://manual.obis.org/access) describes its occurrence
filters and default exclusion of absence and dropped records. We rely on OBIS
to apply the taxon and date filters; we check coordinates locally as a
defensive measure. The manifest records every page URL, raw count, response
ETag/Last-Modified when present, API v3, record `modified` values, access
time in UTC, provider dataset IDs, and any license, citation or rights-holder
fields supplied in the occurrence rows, plus a SHA-256 digest of the extract.
These fields may be absent or vary
by provider; the API response does not promise a frozen database snapshot.
Keep the extract and manifest together to repeat the query and compare it
with later OBIS updates.

Quality control rejects missing, nonnumeric, nonfinite, out-of-range or
outside-box coordinates. It removes repeated **OBIS `id`** values or
repeated `dataset_id` + `occurrenceID` pairs when those identifiers exist.
OBIS describes `id` as a globally unique identifier, and the
[occurrence table guidance](https://manual.obis.org/format_occurrence.html)
calls for a unique occurrenceID. Equal coordinates alone are retained:
independent observations can share a place. The manifest counts raw rows,
coordinate rejects, rows after coordinates, identifier duplicates, rows
without usable identifiers, and written rows. All pages must succeed before
files are written; HTTP or malformed responses fail the run. Existing outputs
are not overwritten.

`python/ocean_pipeline/publish_species.py` additionally checks the exact
species, dataset, dates, marine presence, flags and uncertainty for the six
new snapshots. It retains `NO_DEPTH`, excludes `ON_LAND` and stated location
uncertainty above 300 km, and reports these exclusions. Missing uncertainty
remains unknown. Source rights are reviewed on each OBIS dataset metadata page.

These checks cannot verify a taxonomic identification, event date precision,
georeferencing uncertainty, depth, effort, independence of observations,
completeness, or whether two differently identified records describe the
same event. A box and time window do not correct **sampling bias** from
uneven surveys, access, reporting or taxonomic effort. Inspect OBIS flags,
temporal and spatial coverage, dataset methods, citations and each license
before analysis. The [OBIS citation guidance](https://manual.obis.org/citing.html)
asks users to cite contributing datasets and review their terms. This stage
does not supply environmental predictors, absences, a fitted model, a 2050
habitat prediction or scientific review.
