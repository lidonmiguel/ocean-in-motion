# Océano en Movimiento

An experimental global map for comparing marine habitat suitability now and
under a 2050 **SSP2-4.5** scenario. The interface is in Spanish; this technical
documentation and the code are in English.

**Everything shown in the first release is synthetic and illustrative.** The
three small hand-authored datasets are UI fixtures. They are not OBIS records,
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
Choose one of three species to see **Actual** and **2050** habitat cells together,
with animated strokes connecting matching synthetic cells. Each stroke grows
from current to 2050, its tail follows, and it disappears on arrival. There are
no permanent route lines or moving point markers. Different regions can shift
in different directions.
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

The web app is a static, illustrative demo. GitHub Actions builds it with
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
localhost URL. Publishing does not replace the synthetic habitat fixtures or
turn them into scientific results.

## What is here

| Path | Purpose |
| --- | --- |
| `src/App.tsx`, `src/styles.css` | Spanish responsive controls, legend, species information and prominent demo warnings. |
| `src/MapView.tsx`, `src/data/flowData.ts` | MapLibre world view with bundled Natural Earth land geometry (`world-atlas`), deck.gl habitat cells and illustrative flow animation. |
| `src/data/species/*.json` | Three synthetic species fixtures, each with current and 2050 cells. |
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

- **OBIS:** `python/ocean_pipeline/sources.py::stage_obis_occurrences` stages
  a small, scoped occurrence extract and JSON manifest. See
  [the staging protocol](docs/obis-staging.md) for required parameters,
  quality checks, attribution and limitations.
- **Bio-ORACLE:** `stage_bio_oracle_environment` is the future entry point for
  a small, explicitly chosen set of environmental predictors. Verify layer
  availability and compatibility for the chosen baseline, depth, resolution,
  SSP2-4.5 and 2050 window, then record units, versions and citations. Consult
  [Bio-ORACLE documentation](https://www.bio-oracle.org/documentation.php).

Only an explicit invocation of the OBIS staging command fetches data. It
does not prepare a scientific model or change the illustrative web map.

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

1. Review a bounded OBIS extract and its quality-control manifest for a chosen study scope.
2. Select and harmonize Bio-ORACLE layers for baseline and SSP2-4.5 / 2050.
3. Fit, validate and review a reproducible model before replacing fixture data.
