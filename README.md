# Océano en Movimiento

An experimental marine map with one published model layer and six
illustrative habitat views. The interface is in Spanish; this technical
documentation and the code are in English.

**The initial tortuga boba view shows modeled relative abundance zones** across
the Mediterranean from a published 2003–2018 survey-based model. The source
model was reprojected by EMODnet Biology; the colors compare its values and
do not establish precise habitat boundaries or predict 2050.
The other six views use hand-authored synthetic fixtures. They are not OBIS records,
Bio-ORACLE layers, scientific forecasts, real animal positions or validated
species distribution models. The animated streamlines between matching synthetic
habitat cells are a graphic illustration, not GPS routes, modeled corridors
or inferred animal migrations. Their density and curvature encode no science.

## Run locally

Requirements: Node.js 24 and npm. The basemap's land geometry is packaged with
the app, so the map itself does not require a map-tile account or external tile
service.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.
The page opens on loggerhead turtle model zones. Dark blue means lower and
yellow means higher relative modeled values; uncolored water has no model
estimate. Choose another
species to see **Actual** and **2050** habitat cells together,
with animated strokes connecting matching synthetic cells. Each stroke grows
from current to 2050, its tail follows, and it disappears on arrival. There are
no permanent route lines or moving point markers. Different regions can shift
in different directions.
The strokes start from approximate shortest water-only paths over the bundled
coarse land geometry. A small visual bend is applied only when every resulting
segment stays over water, so the displayed curve can be longer than that route.
Endpoints on land or without a traversable water connection are
omitted; no straight connector is substituted. This is cartographic display,
not marine navigation or a modeled biological corridor.
The map frames
the selected species automatically; drag/zoom to explore farther and
hover a colored cell for its illustrative suitability and uncertainty. The
layout adapts to narrower screens. Reduced-motion settings show the cells and
endpoints without animated strokes.

```bash
npm run lint
npm run typecheck
npm run test
npm run build
# or run all four:
npm run check
```

The small Python staging workspace requires Python 3.11+ and no third-party
packages:

```bash
python -m unittest discover -s python/tests -v
# optional editable installation for later processing work:
python -m pip install -e ./python
```

GitHub Actions runs the web checks and Python tests on pushes and pull requests.

## Publish the map with GitHub Pages

The web app is static. Its loggerhead model image and metadata are bundled with
the build; the remaining species are illustrative. GitHub Actions builds it with
Node.js 24 and publishes `dist`; no local Node installation is needed to
visit the published map.

1. On GitHub Free, make this repository public under **Settings → General →
   Danger Zone → Change repository visibility**. A Pages website is public
   even when its source repository is private on eligible paid plans.
2. Under **Settings → Pages → Build and deployment**, set **Source** to
   **GitHub Actions**.
3. Merge the Pages deployment change. A push to `main` deploys the app; you
   can also run **Publish map to GitHub Pages** manually under **Actions**.
4. Open `https://lidonmiguel.github.io/ocean-in-motion/` after the deployment
   succeeds. GitHub's Pages settings also show the live link.

The deployment builds with Vite's `/ocean-in-motion/` base path so assets load
at the project URL. Local `npm run dev` remains available at Vite's usual
localhost URL. Publishing does not turn the synthetic habitat fixtures into
scientific results.

## What is here

| Path | Purpose |
| --- | --- |
| `src/App.tsx`, `src/styles.css` | Spanish responsive controls, legend, species information and prominent demo warnings. |
| `src/MapView.tsx`, `src/data/flowData.ts` | MapLibre world view with bundled Natural Earth land geometry (`world-atlas`), model overlay, synthetic cells and illustrative flow animation. |
| `src/data/species/*.json` | Seven synthetic species fixtures, each with current and 2050 cells. |
| `src/data/model/*` | Published loggerhead model rendered as a transparent geographic PNG, with provenance and display metadata. |
| `data/model/*.nc.gz`, `python/ocean_pipeline/render_density.py` | Reviewed, compressed EMODnet model snapshot and reproducible overlay conversion. |
| `src/data/observations/loggerhead-west-med.json` | Archived snapshot of 117 real sightings, no longer drawn as points. |
| `data/obis/*` | Losslessly compressed bounded OBIS JSONL extract and QC manifest with query URLs and checksum. |
| `python/ocean_pipeline/publish_pilot.py` | Strict, reproducible conversion of the extract to the display snapshot. |
| `src/data/schema.ts`, `src/data/mapData.ts` | Runtime validation, typed data, period selection, color bands and antimeridian cell splitting. |
| `src/data/*.test.ts` | Focused schema and map-data tests. |
| `docs/data-format.md` | Versioned metadata, citation, suitability, uncertainty and vector format. |
| `python/ocean_pipeline/sources.py` | Explicit, bounded OBIS occurrence staging; Bio-ORACLE remains unimplemented. |
| `.github/workflows/checks.yml` | Automated lint, type check, tests and production build. |

The land silhouettes come from [Natural Earth](https://www.naturalearthdata.com/)
via the [world-atlas](https://github.com/topojson/world-atlas) package. This is
a coarse but geographically grounded global basemap. It is not the mood image,
and the application does not embed that image.

## Data provenance and integration points

The fixture files were invented by hand for interface testing. Their values,
uncertainties and arrows have no empirical source. Their `citations` entries
say so explicitly; species names and short explanatory text are context, not
evidence for the displayed cells. The animated lines connect matching invented
cells to illustrate a visual change; they do not describe movements of
individual animals or establish corridors. Reviewed datasets retain only their
explicitly supplied direction vectors. See [the data contract](docs/data-format.md).

### Displayed model: loggerhead turtle

The default map displays the annual mean loggerhead abundance model by
[Sparks and DiMatteo (2020)](https://seamap.env.duke.edu/models/NUWC/Med/),
based on aerial and shipboard surveys during 2003–2018, via the
[EMODnet Biology reprojected product](https://erddap.emodnet.eu/erddap/info/biology_8514_94a0_0784_7406/index.html).
See also [DiMatteo et al. (2022)](https://doi.org/10.3389/fmars.2022.930412).
The source metadata permits public distribution and warns that spatial and
value differences introduced by reprojection have not been formally assessed.
Its `abundance` variable declares no units, so the map deliberately uses a
**relative color scale**, not animals per square kilometer. The source model
extrapolates in unsurveyed areas and does not estimate all nearshore waters;
blank water means no estimate, not absence. This is a historical modeled
distribution, not a movement route or a 2050 forecast.

The 10 km EPSG:3035 source grid is sampled into a 1200 × 560 WGS84 PNG;
positive cells use a logarithmic blue–teal–yellow gradient with the source
10th and 90th percentiles as display endpoints. The source SHA256, bounds,
quantiles, method and attribution are in
[`src/data/model/loggerhead-mediterranean.json`](src/data/model/loggerhead-mediterranean.json).
To regenerate from the checked-in compressed source:

```bash
python -m pip install netCDF4 numpy pillow pyproj
PYTHONPATH=python python -m ocean_pipeline.render_density \
  --source data/model/loggerhead-emodnet-2003-2018.nc.gz \
  --image src/data/model/loggerhead-mediterranean.png \
  --manifest src/data/model/loggerhead-mediterranean.json
```

The manual **Refresh Mediterranean turtle density snapshot** workflow can
fetch the original product for review. New upstream files require a checksum,
rights and scientific interpretation review before changing this versioned map.

### Archived observation pilot: loggerhead turtle

The archived extract uses **Caretta caretta** (WoRMS AphiaID 137205) from one
[OBIS dataset](https://obis.org/dataset/b9bfb219-1d5c-450e-9b26-fd377aee8561),
surveyed on a regular ferry transect between Barcelona and Civitavecchia.
Arcangeli, A.; Campana, I.; Paraboschi, M.; ISPRA (2018), *Presence of sea turtles
collected through Fixed-Line-Transect monitoring across the Western Mediterranean
Sea (Civitavecchia-Barcelona route) between 2013 and 2017*,
[doi:10.14284/532](https://doi.org/10.14284/532). The provider's OBIS dataset
page states **CC BY 4.0**; the occurrence API rows themselves have no `license`
field. These points are retained for audit, but are not the source of the
displayed model zones or currently shown in the app.

The extract was fetched on 2026-09-27 with the dataset UUID, taxon, WGS84
box (1, 39, 14, 44), and dates 2013-01-01 to 2017-12-31. The API returned
117 of 117 records; none were removed by the staging coordinate or duplicate
checks. The display conversion additionally checks source dataset, taxon,
presence, marine status, OBIS flags, dates, coordinates, identifiers, and
the extract checksum. It does not hide the large spatial uncertainty declared
on **every record: approximately 59–257 km**. Points are approximate reported
locations, not precise GPS fixes. Since sampling follows one ferry route,
unobserved waters cannot be interpreted as absent habitat. The count is a
snapshot of this dataset, not turtle abundance or an ocean-wide trend.

To refresh the source, run **Refresh OBIS pilot snapshot** in GitHub Actions,
inspect the downloaded extract and manifest, recheck the dataset's citation
and license, then regenerate and review the versioned files. Do not silently
replace the published snapshot with a newer mutable API response.

The four added species are humpback whale, common bottlenose dolphin, swordfish
and loggerhead turtle. General species context was checked against NOAA Fisheries
profiles for [humpback whale](https://www.fisheries.noaa.gov/species/humpback-whale),
[bottlenose dolphin](https://www.fisheries.noaa.gov/species/common-bottlenose-dolphin),
[swordfish](https://www.fisheries.noaa.gov/species/north-atlantic-swordfish) and
[loggerhead turtle](https://www.fisheries.noaa.gov/species/loggerhead-turtle).
Those profiles do not provide or validate the invented habitat cells, period
shifts, suitability scores or animated strokes.

- **OBIS:** `python/ocean_pipeline/sources.py::stage_obis_occurrences` stages
  a small, scoped occurrence extract and JSON manifest. See
  [the staging protocol](docs/obis-staging.md) for required parameters,
  quality checks, attribution and limitations.
- **Bio-ORACLE:** `stage_bio_oracle_environment` is the future entry point for
  a small, explicitly chosen set of environmental predictors. Verify layer
  availability and compatibility for the chosen baseline, depth, resolution,
  SSP2-4.5 and 2050 window, then record units, versions and citations. Consult
  [Bio-ORACLE documentation](https://www.bio-oracle.org/documentation.php).

The bundled OBIS snapshot is static; only an explicit staging run fetches new
data. The model zones come from the separate published product above. Neither
the sightings nor the synthetic views constitute a forecast.

## Planned scientific workflow

1. Define a reviewable study scope for each species: taxon identity, geography,
   accessible area, baseline window and occurrence quality protocol. Obtain a
   bounded, cited OBIS extract and inspect bias and coverage.
2. Select biologically relevant, compatible Bio-ORACLE baseline and SSP2-4.5
   future predictors. Align grids and units, document assumptions, and fit and
   evaluate a species distribution model with spatial validation and sensitivity
   checks. Estimate uncertainty across inputs and models.
3. Review maps, metrics and interpretation with domain experts. Export a
   versioned dataset and provenance manifest, plus meaningful uncertainty.
   Only then set `provenance: reviewed-model` and provide linked occurrence,
   environment and model citations. Review status in JSON alone is not proof
   of review.

**Projected range shift ≠ migration route.** A change in habitat suitability
or predicted distribution describes where conditions may become more or less
suitable under a scenario. It does not observe where an individual traveled,
predict its path, or establish that a population will move there. Any future
direction vector should summarize a documented distribution statistic, not
draw a supposed animal track.

## Next engineering steps

1. Review sampling effort and coordinate uncertainty for the loggerhead pilot and decide whether a different source is needed for broader inference.
2. Select and harmonize Bio-ORACLE layers for baseline and SSP2-4.5 / 2050.
3. Fit, validate and review a reproducible model before replacing fixture data.
