# Océano en Movimiento

An experimental marine map with one observation-derived loggerhead view and six
fully synthetic habitat views. The interface is in Spanish; this technical
documentation and the code are in English.

**The initial tortuga boba view calculates one geographic box from all 117
documented OBIS sightings** on the Barcelona–Civitavecchia ferry route. The
pink destination is an explicitly marked illustrative translation, not an
inference from these sightings or a 2050 forecast. The animated strands only
demonstrate how a future modeled box could be displayed. The other six species
use wholly synthetic fixtures. None of these flows are GPS tracks, inferred
migrations or validated predictions.

## Run locally

Requirements: Node.js 24 and npm. The basemap's land geometry is packaged with
the app, so the map itself does not require a map-tile account or external tile
service.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.
The page opens on the loggerhead's single observation box and a visibly labeled
simulated destination. Choose another species to see **Actual** and **2050** habitat cells together,
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
endpoints without animated strokes. Browsers without WebGL2 use a simplified
SVG flow animation.

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

The web app is static. Its checked OBIS observation snapshot is bundled with
the build; the future display is illustrative. GitHub Actions builds it with
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
| `src/MapView.tsx`, `src/data/flowData.ts` | MapLibre world view with bundled Natural Earth land geometry (`world-atlas`), boxes and illustrative water-only flow animation. |
| `src/data/species/*.json` | Seven original synthetic species fixtures; the loggerhead fixture supplies only descriptive species metadata to the displayed view. |
| `src/data/observationScenario.ts` | Generic one-box-per-scoped-extract computation with an explicitly illustrative destination. |
| `src/data/observations/loggerhead-west-med.json` | Checked snapshot of 117 real sightings used to calculate the visible box. |
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

The six other fixture files were invented by hand for interface testing. Their values,
uncertainties and arrows have no empirical source. Their `citations` entries
say so explicitly; species names and short explanatory text are context, not
evidence for the displayed cells. The animated lines connect matching invented
cells to illustrate a visual change; they do not describe movements of
individual animals or establish corridors. Reviewed datasets retain only their
explicitly supplied direction vectors. See [the data contract](docs/data-format.md).

### Displayed observation box: loggerhead turtle

The displayed extract uses **Caretta caretta** (WoRMS AphiaID 137205) from one
[OBIS dataset](https://obis.org/dataset/b9bfb219-1d5c-450e-9b26-fd377aee8561),
surveyed on a regular ferry transect between Barcelona and Civitavecchia.
Arcangeli, A.; Campana, I.; Paraboschi, M.; ISPRA (2018), *Presence of sea turtles
collected through Fixed-Line-Transect monitoring across the Western Mediterranean
Sea (Civitavecchia-Barcelona route) between 2013 and 2017*,
[doi:10.14284/532](https://doi.org/10.14284/532). The provider's OBIS dataset
page states **CC BY 4.0**; the occurrence API rows themselves have no `license`
field. The app derives its one current box directly from these points.

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

`src/data/observationScenario.ts` computes the extrema of all reported
coordinates in each scoped dataset, then constructs one enclosing square in
approximate ground distance, with a 20 km display margin. For this source the
observed extrema are 2.41215–11.422413° E and 41.110438–41.99854° N.
The square encloses every point but also includes places never surveyed; it
is a visual summary of locations, **not** a habitat boundary. Its size does
not account for each record's coordinate uncertainty.

The pink box is a **demonstration only**, translated two degrees south. That
offset is an explicit display setting, not a trend, extrapolation, Bio-ORACLE
projection or prediction of 2050. The animated strands connect corresponding
positions over water to exercise the existing visual renderer. A future
validated model must supply future boxes and provenance before this view can
be described as a forecast. To add another regional occurrence snapshot,
register it in `src/data/index.ts`; the same calculator creates one box for
that source regardless of its point count. For another species, add its
descriptive species fixture and register its scoped snapshot. Broad extracts
must be split into justified regional datasets rather than making a giant box.

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
data. The displayed future box and all other species flows are illustrative,
not forecasts.

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
