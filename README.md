# Ocean in Motion

An interactive sea-surface temperature explorer and reproducible forecasting
experiment, with a English interface. Explore **102 seas and oceans** in one
continuous **1982–2030** timeline: historical values through 2025 and explicitly
marked experimental predictions for 2026–2030.

The map opens directly on temperatures. Select a region, inspect its full series,
compare regions and years, and download history and forecasts together as CSV. Curved visual
traces move between touching cooler regions using the selected year's values.
Observed/reconstructed values, regional estimates and predictions retain their
own provenance and labels throughout the map, chart, detail and download.

The Data Science experiment compares eight candidates with temporal selection,
calibration and a held-out final evaluation. **Persistence is the selected
baseline**, with final-test MAE **0.220 °C** on 22 NOAA-derived regions. The other
80 regions have estimated histories and donor-derived forecasts; they are
excluded from model training and evaluation.

[Live demo](https://lidonmiguel.github.io/ocean-in-motion/) ·
[Experiment report](reports/temperature/REPORT.md) ·
[Methodology and model card](docs/temperature-forecast.md) ·
[Executed notebook](notebooks/temperature_forecasting.ipynb)

## Run and verify

Node.js 24, npm and Python 3.12 are used in CI:

```bash
npm ci
npm run dev
npm run check
python -m pip install -e './python[forecast,analysis]'
PYTHONPATH=python python -m unittest discover -s python/tests -v
PYTHONPATH=python python -m ocean_pipeline.forecast --check
PYTHONPATH=python python -m ocean_pipeline.temperature_routes --check
```

Open Vite's printed local URL. The website bundles reviewed snapshots and
geography, so it needs no map-tile account or data API at runtime. Source data
refreshes require network access; forecast and route validation run offline.

Merge to `main` to deploy through GitHub Actions to GitHub Pages. Configure
**Settings → Pages → GitHub Actions** as the build source.

## Sea temperatures and provenance

Choose a calendar year and select a sea or ocean on the map, in the list or by
name search. History and predictions share the same slider, chart and table;
the year, marker and line style identify the prediction period.

The checked-in values are **annual sea-surface temperatures in °C**, not
anomalies or forecasts. The snapshot covers **1982–2025**. Its 21 original
areas were computed from all twelve monthly [NOAA ERSSTv6](https://www.ncei.noaa.gov/products/extended-reconstructed-sst)
files per year. Only ocean grid-cell centers within each polygon are used;
all twelve months must be present. Months are weighted by days and cells by
cosine of latitude. NOAA's 2° reconstruction smooths local changes. Ice-covered
areas use NOAA's ice/SST proxy, which matters especially in the Arctic.

The other **80 areas in the checked-in snapshot are estimates**, marked `≈`
throughout the map, detail panel, history, and CSV. For each year, the pipeline
takes the closest one or two areas with NOAA-derived values by IHO polygon
distance, averages their temperatures after an approximate latitude correction,
and rounds to 0.1 °C. The correction uses a capped broad latitude curve
(`max(-1.8, 28 - 0.008 × latitude²)` in °C). These estimates do **not** represent
local NOAA grid cells, and their `cells` count is zero. The record lists its
`estimatedFrom` donors and `method: "estimated"`. They are coarse visual
approximations; exclude them from model training that requires observations.
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
python -m ocean_pipeline.temperature --start 1982 --end 2025
```

The second script downloads monthly files from NOAA, refuses missing months,
and computes observed means for **all 101 polygons** where at least two
complete 2° cells are available. Only areas without sufficient NOAA cells are
estimated from neighboring areas. It replaces the two derived files in
`src/data/` and needs network access; the website itself works offline.

## Compare regions below the map

Compare two to five regions with stable colors, an annual line chart and sorted
bars for the map’s selected year. Toggle absolute temperature or anomalies
relative to each region’s own **1982–2010** mean. Narrow the visible interval,
filter the picker by region type and NOAA/estimated history, inspect values,
open the accessible table and export the chosen series as CSV with provenance.
Historical change compares **2016–2025** with **1982–1991** (ten-year means).
Forecasts stay in the same series, distinguished by dashed lines from 2026.
No ocean-wide aggregate or independent local measurements are inferred from
estimated seas. See [comparison definitions and limitations](docs/temperature-comparison.md).

## Temperature forecasting · 2026–2030

The temperature map also animates **illustrative paths toward cooler seas**.
Lines start from multiple distributed water positions in each region using
curved, growing turquoise-to-pink traces. Each point chooses
the nearest **touching, cooler neighbor** from its current position, arrives,
then compares only the new region's neighbors. Without a cooler neighbor it
turns locally and disappears. Paths use the selected year's values; controls
pause or hide them, and reduced-motion preferences are respected.
These are visual traces, not measured ocean currents.
See [distance rules, water geometry and limitations](docs/temperature-cooling-paths.md).

The temperature view has **one continuous 1982–2030 timeline** for all 102
regions. The same year slider, regional selection, chart and table show history
through 2025 and predictions from 2026, marked ↗ and drawn as a dashed line.
The historical snapshot is preserved.

The 22 NOAA-derived histories receive direct model forecasts. The other 80
regions keep their existing estimated baseline and receive the mean forecast
change of their documented NOAA donors. Their provenance is labeled in the
detail, chart and CSV; they do not enter model training or evaluation.
Their shaded bands are **donor-derived ranges with no validated local coverage**,
rather than calibrated 90% prediction intervals.

Eight predeclared candidates compare persistence, local trend, Ridge and
Gradient Boosting, with and without geographic neighbor features. Selection,
interval calibration and final evaluation use separate target-year periods.
**Persistence wins the development comparison**; final-test MAE is **0.220 °C**.
For the 22 evaluated NOAA regions, the nominal 90% interval achieves approximately **87%** pooled final coverage,
so future coverage is not guaranteed. The website explains the selected
baseline and exposes error and interval information instead of implying that a
more complex model won. The point forecast retains the 2025 value at each
horizon; this is not a claim that warming will stop.

[Experiment report](reports/temperature/REPORT.md) ·
[Data Science methodology and model card](docs/temperature-forecast.md) ·
[Executed analysis notebook](notebooks/temperature_forecasting.ipynb)

```bash
python -m pip install -e './python[forecast]'
PYTHONPATH=python python -m ocean_pipeline.forecast
PYTHONPATH=python python -m ocean_pipeline.forecast --check
```

The complete pipeline runs offline from reviewed snapshots and records input,
configuration and code hashes. CI verifies temporal leakage tests and artifact
reproducibility. Forecasts are experimental regional statistics, not climate
scenarios.

## Repository guide

- `src/TemperaturePage.tsx`, `SeaTemperatureMap.tsx` and `TemperatureHistoryChart.tsx`: explorer, map and unified series.
- `src/TemperatureComparison.tsx` and `src/data/temperatureComparison.ts`: interactive regional charts, fixed-reference anomalies and comparison export.
- `src/data/seaTemperatures.json` and `caspianTemperatures.json`: historical snapshots; `temperatureForecasts.json`: forecasts and evaluation metadata.
- `src/data/seaAreas.geojson`, `caspian.geojson` and `temperatureLand.geojson`: regional boundaries and detailed land/islands.
- `src/data/temperatureRoutes.json`, `temperatureFlows.ts` and `flowAnimation.ts`: water geometry, neighboring-region selection and animated traces.
- `python/ocean_pipeline/`: temperature preparation, estimates, forecasting, analysis and geometry validation.
- `experiments/temperature/config.json`: candidate models and temporal split configuration.
- `reports/temperature/` and `notebooks/temperature_forecasting.ipynb`: metrics, backtests, forecast exports, figures and executed analysis.
- `docs/temperature-forecast.md` and `docs/temperature-cooling-paths.md`: scientific method, animation rules and limitations.

GitHub Actions checks the app, Python tests, forecast reproducibility, executed
analysis and ocean route geometry. Deployment publishes the same application.
