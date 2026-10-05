# Temperature data and geography

This guide preserves the data preparation, source attribution and geographic
limitations behind the explorer. Run the commands below from the repository
root. See the [project overview](../README.md), [forecast methodology](temperature-forecast.md)
and [comparison definitions](temperature-comparison.md) for analytical context.

## Source-refresh prerequisites

Install the temperature dependencies before running the source preparation
commands below. NOAA downloads require network access.

```bash
npm ci
python -m pip install -e './python[temperature]'
```

## Sea temperatures and provenance

Choose a calendar year and select a sea or ocean on the map, in the list or by
name search. History and predictions share the same slider, chart and table;
the year, marker and line style identify the prediction period.

The checked-in values are **annual sea-surface temperatures in °C**, not
anomalies or forecasts. The snapshot covers **1982–2025**. All 81 eligible marine
areas were computed from all twelve monthly [NOAA ERSSTv6](https://www.ncei.noaa.gov/products/extended-reconstructed-sst)
files per year. Only ocean grid-cell centers within each polygon are used;
all twelve months must be present. Months are weighted by days and cells by
cosine of latitude. NOAA's 2° reconstruction smooths local changes. Ice-covered
areas use NOAA's ice/SST proxy, which matters especially in the Arctic.

The other **20 areas in the checked-in snapshot are estimates**, marked `≈`
throughout the map, detail panel, history, and CSV. For each year, the pipeline
takes the closest one or two areas with NOAA-derived values by IHO polygon
distance, averages their temperatures after an approximate latitude correction,
and rounds to 0.1 °C. The correction uses a capped broad latitude curve
(`max(-1.8, 28 - 0.008 × latitude²)` in °C). These estimates do **not** represent
local NOAA grid cells, and their `cells` count is zero. The record lists its
`estimatedFrom` donors and `method: "estimated"`. They are coarse visual
approximations; exclude them from model training that requires observations.
The coverage audit replaces 60 previously estimated histories with NOAA means.
The [region-by-region audit](../reports/temperature/SOURCE_COVERAGE.md) lists every
replacement and the 20 areas still below the two-cell threshold.
`data/geography/marine-temperature.manifest.json` records all 528 input SHA-256
hashes, complete-cell counts for each region/year, and source/output/code hashes.
The annual data are in `src/data/seaTemperatures.json`. This is a regional
overview, not a coastal or harbor reading.

The **Caspian Sea** is included as a separate inland water area with
NOAA-derived annual values throughout 1982–2025. Its Natural Earth outline
is separate from the 101 IHO marine areas. Ten complete 2° NOAA cells are
used each year, with the same day and cosine-latitude weighting as the
marine means. These are reconstructed regional values, not direct local
measurements. Its 44 annual values are in `src/data/caspianTemperatures.json`;
`data/geography/caspian-temperature.manifest.json` records the SHA-256 of all
528 monthly inputs and the outline. The CSV includes the Caspian series.
Use the sea-name search to find it or any other area; accents are optional.
Regenerate the additional series without replacing the IHO snapshot:

```bash
python -m ocean_pipeline.caspian_temperature
```

The temperature map uses a separate, more detailed Natural Earth 1:10m land
cover so small islands receive the same gray fill as continents in both
WebGL and SVG views. Its topology-preserving 0.01° simplification is for
display, not local shoreline analysis. Regenerate it with:

```bash
python python/ocean_pipeline/prepare_land.py --resolution 10m --tolerance 0.01 --output src/data/temperatureLand.geojson
```

This requires the temperature Python extra and `npm ci`. The land cover remains
split at the map seams to prevent the North Atlantic fill artifact.

The boundaries are a simplified copy of **Flanders Marine Institute (2018),
IHO Sea Areas v3**, [doi:10.14284/323](https://doi.org/10.14284/323),
licensed CC BY 4.0 and distributed as GeoJSON by
[alvinometric/oceans-seas.geojson](https://github.com/alvinometric/oceans-seas.geojson).
The upstream geography is kept in `data/geography/`; all 101 polygons
used by the app are in `src/data/seaAreas.geojson`. Larger ocean and smaller sea
names refer to the source's distinct areas; no extra ocean-wide total is
inferred by adding them together.

To reproduce the offline extension of the existing NOAA snapshot:

```bash
python -m pip install -e './python[temperature]'
python -m ocean_pipeline.temperature_fill
```

To regenerate the snapshot directly from NOAA for complete years:

```bash
python -m pip install -e './python[temperature]'
python -m ocean_pipeline.temperature --start 1982 --end 2025 --cache-dir /tmp/ocean-noaa-monthly
```

The second script downloads monthly files from NOAA, refuses missing months,
and computes NOAA-derived means for **all 101 polygons** where at least two
complete 2° cells are available. Only areas without sufficient NOAA cells are
estimated from neighboring areas. It replaces the two derived files in
`src/data/` and needs network access; the deployed website uses reviewed local assets. The optional cache
reuses the exact downloaded monthly files. Remove it to request a new NOAA
vintage, and review the resulting hashes before replacing the snapshot.

## Validation and publication

Use Node.js 24 and Python 3.12, matching CI. Install the Python temperature
extra for source refreshes; the forecast and analysis extras provide the offline
experiment, geometry checks and notebook dependencies.

```bash
npm ci
npm run check
python -m pip install -e './python[forecast,analysis]'
PYTHONPATH=python python -m unittest discover -s python/tests -v
PYTHONPATH=python python -m ocean_pipeline.forecast --check
PYTHONPATH=python python -m ocean_pipeline.temperature_routes --check
```

When changing temperature snapshots or geography, regenerate the dependent
forecast artifacts, analysis and notebook before running the checks. Geometry
changes also require regeneration of the cooling-route artifact; its verification
checks source hashes, water boundaries and route endpoints.

```bash
PYTHONPATH=python python -m ocean_pipeline.forecast
PYTHONPATH=python python -m ocean_pipeline.forecast_analysis
PYTHONPATH=python python -m ocean_pipeline.execute_notebook
# Required when the route geometry inputs change:
PYTHONPATH=python python -m ocean_pipeline.temperature_routes
```

The application serves reviewed snapshots and geography from its own deployment.
Geometries and cooling routes are emitted as separate, fingerprinted files;
the initial JavaScript contains only regional names and temperature values.
The map code is loaded separately; its routes are fetched only once the map is
ready and paths are enabled. The comparison component loads when its section
approaches the viewport. Successful data requests are cached for the session;
failed requests can be retried. Serve the deployment over HTTP rather than
opening index.html through file://. It needs no map-tile
account or data API at runtime. NOAA refreshes require network access; forecast
reproduction and route validation run offline from the checked-in inputs.

GitHub Actions checks the application, Python tests, forecast reproducibility,
executed analysis and ocean route geometry. Pushes to `main` publish the same
application to GitHub Pages. Configure **Settings → Pages → GitHub Actions** as
the build source.

## Licensing and input manifests

The original code is MIT licensed. [Code and data attribution](data-attribution.md)
keeps upstream licenses separate and links both marine and Caspian manifests.
The marine generator revision is pinned there so its code, catalog and
imputation helpers can be inspected together. The existing NOAA input hashes,
scientific snapshots and geographic attribution are preserved when changing
browser asset loading.

## Browser loading budget

The initial JavaScript is approximately **670 KB / 124 KB gzip**, compared with
**10.15 MB / 3.19 MB gzip** before separating data. These are production-build
measurements, not a claim about measured network transfer on every host. The
map library chunk is still approximately 1.81 MB / 494 KB gzip; it loads separately.
The geographic data still have their original sizes and precision.

`npm run build` also checks that the initial script stays below 800 KB and
160 KB gzip, that all four geographic/route files are emitted separately with
bytes identical to the reviewed source files, and that deferred sections are
not preloaded by the HTML. This runs for the GitHub Pages base path too.
