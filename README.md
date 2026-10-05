# Océano en Movimiento

An experimental marine map in Spanish with ten species and
**observation-derived** regional boxes. The 54 bounded extracts include multiple documented locations for every species.
The older hand-authored habitat fixtures have been removed.
Each turquoise square encloses the positions in one geographically close
group from a checked, bounded OBIS extract, with up to a 250 km display margin per side. The underlying observations, original
extract, query manifest and source citation are versioned in this repository.
Where a separate marine destination can be drawn outside all current squares
for that species, animated strands reach it. Their width and destination spacing are visual choices,
not measured movement or estimated habitat.

**The pink destinations and animated water-only strands are still a visual
simulation.** They are explicit translations of the observed squares, not
observations, migration tracks, predicted 2050 habitat, or a species
distribution model. The no-overlap rule only prevents a simulated destination
from covering known observation areas; it does not establish where animals will move.
The map opens with **only the documented areas**. Select **Mostrar ejemplo
ilustrativo** to add the pink destinations and strands; the control resets when
you choose another species or group. This separates the source evidence from
the optional visual demonstration.
The square describes the extent of *reported positions in
the scoped dataset*, not all habitat, animal abundance, or absence elsewhere.
Land is drawn over the squares, hiding their portions on land without changing
the underlying observation bounds or counts.

## Explore and publish

Node.js 24 and npm are needed locally:

```bash
npm ci
npm run dev
npm run check
python -m unittest discover -s python/tests -v
```

Open the local URL printed by Vite (usually `http://localhost:5173`). The
basemap and checked source snapshots are bundled, so the map needs no map tile
account. The layout is responsive; water routes use coarse Natural Earth land
geometry and may omit strands for which no marine path is found.

## Sea temperatures

Select **Ver mares y temperaturas** to switch to an independent temperature
view. Choose a complete calendar year, select one of 102 named sea and ocean
areas on the map or in the list, inspect its annual history, or download the
full CSV (with origin and donor columns). The species map and its illustrative
flows remain separate.

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

The **Mar Caspio** is included as a separate inland water area with
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

In the species list, choose **Ver todos** beside a group to see its species
together; the mobile selector offers the same three options. Fish include
bluefin tuna, whale shark, swordfish and white shark; marine mammals include
three cetaceans; the three turtles are marine reptiles. There are no amphibian datasets.
Each species has its own color within a combined view, while pink remains the
illustrative destination when the example is enabled. **Mostrar cajas** hides
or reveals the visible squares; the center markers remain. With the example
enabled, animated strands remain when boxes are hidden. Use
the scrollable region list to zoom to an individual source group. Viewing
species together does not establish shared habitat or real migration paths.

This public repository deploys through **GitHub Actions**: under **Settings →
Pages**, choose **GitHub Actions** as the build source, then merge to `main`.
The published map is at
<https://lidonmiguel.github.io/ocean-in-motion/> after deployment completes.

## Temperature forecasting · 2026–2030

The temperature map also animates **illustrative paths toward cooler seas**.
Lines start from multiple distributed water positions in each region and share
the species map's curved, growing turquoise-to-pink traces. Each point chooses
the nearest **touching, cooler neighbor** from its current position, arrives,
then compares only the new region's neighbors. Without a cooler neighbor it
turns locally and disappears. Paths use the selected year's values; controls
pause or hide them, and reduced-motion preferences are respected.
These are visual traces, not measured animal routes or ocean currents.
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
scenarios or predictions of animal movement.

## Displayed occurrence datasets

All taxa are exact WoRMS AphiaIDs; all extracts use OBIS v3 occurrence queries
with a specific dataset UUID, WGS84 bounds and inclusive dates. Counts below
are accepted records after documented quality checks. The links lead to the
individual source dataset, with its citation and license displayed in the app.
A repeated dataset link refers to a separate geographic query, not a new source.

| Species | Regional source, period | Accepted / queried | Rights |
| --- | --- | ---: | --- |
| *Thunnus thynnus* | [iNaturalist Marine, western Mediterranean](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 32 / 38 | CC BY-NC 4.0 |
| *Thunnus thynnus* | [NYSERDA digital aerial survey, New York Bight](https://obis.org/dataset/ca78b5b9-d4e4-4ab0-bbe1-9f75659769e2), 2017–2018 | 653 / 653 | CC BY 4.0 |
| *Thunnus thynnus* | [Observatoire PELAGIS boat surveys, Bay of Biscay](https://obis.org/dataset/924c4d25-6358-44a3-8f4d-24086256ad3e), 2015–2021 | 18 / 18 | CC BY-NC 4.0 |
| *Thunnus thynnus* | [BOEM digital aerial survey, off North Carolina](https://obis.org/dataset/5055f146-1a0a-41be-a747-24968c2cf584), 2018 | 230 / 230 | CC BY 4.0 |
| *Thunnus thynnus* | [MareCamp expert visual surveys, Sicilian Ionian Sea](https://obis.org/dataset/b14abb47-b481-4272-a8d6-d4e2b612dce9), 2015–2019 | 5 / 5 | CC BY 4.0 |
| *Thunnus thynnus* | [iNaturalist Marine, eastern Mediterranean](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2020 | 4 / 6 | CC BY-NC 4.0 |
| *Thunnus thynnus* | [iNaturalist Marine, North Sea and adjacent waters](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2019–2024 | 7 / 12 | CC BY-NC 4.0 |
| *Thunnus thynnus* | [iNaturalist Marine, Atlantic Canada](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2020–2024 | 8 / 14 | CC BY-NC 4.0 |
| *Rhincodon typus* | [iNaturalist Marine, Gulf of Mexico](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 157 / 172 | CC BY-NC 4.0 |
| *Xiphias gladius* | [ANSE visual surveys, southeastern Spanish Mediterranean](https://obis.org/dataset/da5982a8-e9a1-46af-ab1b-8293edb79c5d), 2014–2024 | 190 / 190 | CC BY-NC 4.0 |
| *Megaptera novaeangliae* | [NEFSC aerial survey, Gulf of Maine](https://obis.org/dataset/c7d259da-370a-4504-9445-29de96d9223a), 2022 | 479 / 479 | CC0 1.0 |
| *Tursiops truncatus* | [ISPRA ferry transect, western Mediterranean](https://obis.org/dataset/d5847ecb-6f9b-4599-888a-461cb26f8018), 2014–2018 | 84 / 84 | CC BY 4.0 |
| *Chelonia mydas* | [iNaturalist Marine, northwestern Caribbean](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 384 / 519 | CC BY-NC 4.0 |
| *Caretta caretta* | [ISPRA ferry transect, western Mediterranean](https://obis.org/dataset/b9bfb219-1d5c-450e-9b26-fd377aee8561), 2013–2017 | 117 / 117 | CC BY 4.0 |
| *Rhincodon typus* | [iNaturalist Marine, Golfo de California](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 220 / 253 | CC BY-NC 4.0 |
| *Rhincodon typus* | [iNaturalist Marine, Filipinas y mar de Célebes](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 117 / 161 | CC BY-NC 4.0 |
| *Rhincodon typus* | [iNaturalist Marine, Ningaloo · Australia occidental](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 65 / 75 | CC BY-NC 4.0 |
| *Rhincodon typus* | [iNaturalist Marine, Costa de Mozambique](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2016–2024 | 6 / 12 | CC BY-NC 4.0 |
| *Rhincodon typus* | [iNaturalist Marine, Maldivas](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 58 / 65 | CC BY-NC 4.0 |
| *Xiphias gladius* | [iNaturalist Marine, Mediterráneo oriental](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 15 / 19 | CC BY-NC 4.0 |
| *Xiphias gladius* | [iNaturalist Marine, Atlántico occidental · costa de EE. UU.](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2017–2024 | 13 / 15 | CC BY-NC 4.0 |
| *Xiphias gladius* | [iNaturalist Marine, Pacífico oriental · California](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2017–2024 | 20 / 21 | CC BY-NC 4.0 |
| *Xiphias gladius* | [iNaturalist Marine, Atlántico ibérico](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2021–2022 | 2 / 4 | CC BY-NC 4.0 |
| *Megaptera novaeangliae* | [CRC HRC small-vessel survey, Hawái · prospección en embarcación](https://obis.org/dataset/9fc29d00-9998-4059-b0bd-f28cfa63a793), 2015 | 15 / 15 | CC BY 4.0 |
| *Megaptera novaeangliae* | [SWFSC CLAWS survey, Alaska · campaña CLAWS](https://obis.org/dataset/1dc828ac-d522-4ebf-97c3-e5a521b4509c), 2015 | 369 / 369 | CC0 1.0 |
| *Megaptera novaeangliae* | [RV Investigator sightings, Mar de Tasmania · campaña RV Investigator](https://obis.org/dataset/3f424661-13b8-4008-8600-091bf43037ad), 2017 | 59 / 59 | CC BY-NC 4.0 |
| *Megaptera novaeangliae* | [iNaturalist Marine, Sudáfrica y Mozambique](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 184 / 381 | CC BY-NC 4.0 |
| *Megaptera novaeangliae* | [iNaturalist Marine, Islandia](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 275 / 529 | CC BY-NC 4.0 |
| *Tursiops truncatus* | [GoMMAPPS aerial survey, Golfo de México · prospección aérea](https://obis.org/dataset/717041c4-dd72-4457-8963-4e63e8e35710), 2018 | 169 / 172 | CC0 1.0 |
| *Tursiops truncatus* | [Happywhale, California · Happywhale](https://obis.org/dataset/86ffd903-47fc-435e-a42e-f3aec79c2d03), 2014–2024 | 222 / 226 | CC BY-NC 4.0 |
| *Tursiops truncatus* | [iNaturalist Marine, Australia oriental](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 94 / 128 | CC BY-NC 4.0 |
| *Tursiops truncatus* | [iNaturalist Marine, Caribe oriental](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 51 / 56 | CC BY-NC 4.0 |
| *Tursiops truncatus* | [iNaturalist Marine, Costa sudafricana del Índico](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 11 / 13 | CC BY-NC 4.0 |
| *Chelonia mydas* | [CRC HRC shore survey, Hawái · observación desde la costa](https://obis.org/dataset/57fc04f0-c9f9-4d2f-9030-bf7281afda92), 2014–2015 | 114 / 135 | CC BY 4.0 |
| *Chelonia mydas* | [BioNet NSW sightings, Nueva Gales del Sur · BioNet](https://obis.org/dataset/0ae49e4e-ad4c-4b89-be2e-b6003c0038ec), 2014 | 63 / 72 | CC BY 4.0 |
| *Chelonia mydas* | [iNaturalist Marine, Mar Rojo](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 200 / 421 | CC BY-NC 4.0 |
| *Chelonia mydas* | [iNaturalist Marine, Seychelles](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 23 / 25 | CC BY-NC 4.0 |
| *Chelonia mydas* | [iNaturalist Marine, Galápagos](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 908 / 1351 | CC BY-NC 4.0 |
| *Caretta caretta* | [AMAPPS aerial survey, Florida · prospección aérea](https://obis.org/dataset/eeb7f0c5-dfe8-4a07-b273-6dc4a634cc14), 2019 | 215 / 215 | CC0 1.0 |
| *Caretta caretta* | [Tethys aerial survey, Mediterráneo oriental · prospección aérea](https://obis.org/dataset/7225dc7b-dd9a-4bec-b689-f084a49d13eb), 2021 | 358 / 360 | CC BY-NC 4.0 |
| *Caretta caretta* | [iNaturalist Marine, Japón](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 13 / 18 | CC BY-NC 4.0 |
| *Caretta caretta* | [iNaturalist Marine, Australia oriental](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 129 / 194 | CC BY-NC 4.0 |
| *Caretta caretta* | [iNaturalist Marine, Sudáfrica](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 48 / 80 | CC BY-NC 4.0 |
| *Orcinus orca* | [iNaturalist Marine, Pacífico nororiental](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 2341 / 2850 | CC BY-NC 4.0 |
| *Orcinus orca* | [iNaturalist Marine, Islandia y Noruega](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 229 / 253 | CC BY-NC 4.0 |
| *Orcinus orca* | [iNaturalist Marine, Nueva Zelanda](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 203 / 224 | CC BY-NC 4.0 |
| *Orcinus orca* | [iNaturalist Marine, Patagonia](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 72 / 101 | CC BY-NC 4.0 |
| *Carcharodon carcharias* | [iNaturalist Marine, California](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 154 / 198 | CC BY-NC 4.0 |
| *Carcharodon carcharias* | [iNaturalist Marine, Sudáfrica](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 64 / 85 | CC BY-NC 4.0 |
| *Carcharodon carcharias* | [iNaturalist Marine, Australia oriental](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 6 / 10 | CC BY-NC 4.0 |
| *Carcharodon carcharias* | [iNaturalist Marine, Atlántico estadounidense](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 20 / 26 | CC BY-NC 4.0 |
| *Dermochelys coriacea* | [iNaturalist Marine, Atlántico estadounidense](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 98 / 137 | CC BY-NC 4.0 |
| *Dermochelys coriacea* | [iNaturalist Marine, Caribe](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 126 / 259 | CC BY-NC 4.0 |
| *Dermochelys coriacea* | [iNaturalist Marine, Australia](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 14 / 20 | CC BY-NC 4.0 |

The iNaturalist Marine source is credited to iNaturalist contributors / Marine
Biological Association (2026), [doi:10.17031/0bbcjx](https://doi.org/10.17031/0bbcjx).
The New York Bight aerial survey is credited to Vukovich (2022),
[doi:10.82144/2972b82d](https://doi.org/10.82144/2972b82d). The Bay of
Biscay boat surveys are credited to Doremus and Peltier (2025),
[doi:10.82144/c7d01c61](https://doi.org/10.82144/c7d01c61).
The BOEM aerial survey is credited to Vukovich (2022),
[doi:10.82144/47a6c4f3](https://doi.org/10.82144/47a6c4f3).
The Sicilian expert surveys are credited to Monaco, Garofalo, Raffa,
MareCamp, Cavallè and LIFE platform (2020); see the linked dataset.
The ANSE visual survey is credited to Murcia Abellán and Morata (2026).
The NEFSC 2022 aerial survey is credited to Cole, Khan and Ogilvie (2025),
[doi:10.82144/9f540955](https://doi.org/10.82144/9f540955).
The ISPRA cetacean ferry transect is credited to Arcangeli, Campana,
Paraboschi and ISPRA (2018), [doi:10.14284/533](https://doi.org/10.14284/533);
the loggerhead transect to the same authors, [doi:10.14284/532](https://doi.org/10.14284/532).
The recorded dataset rights come from OBIS dataset metadata `intellectualrights`
checked on 2026-09-27 and 2026-09-28. **CC BY-NC sources carry a noncommercial restriction.**

All published extracts exclude OBIS `ON_LAND` flags and declared position uncertainty greater than 300 km. The new scopes also exclude subordinate names returned with `NO_ACCEPTED_NAME` and a different AphiaID (367 rows), keeping only the exact reviewed taxon. Each snapshot records its own exclusion counts. `NO_DEPTH`
is retained because this map does not analyze depth. The swordfish dataset
provides no coordinate uncertainty for its 190 observations; the interface
reports that as unknown. The Bay of Biscay tuna survey also omits that field.
The New York aerial survey declares 11.13 m for every tuna record; this is a
reported coordinate value, not proof of identification or exact animal
position. The NEFSC survey reports zero, which is the source
value and must not be interpreted as perfect location accuracy. The ferry
transects have broad stated uncertainties of roughly 32–257 km. All counts
are records, not individual animals; citizen reports and survey routes are
spatially biased. The OBIS source may change after these versioned extracts.
The eight scoped bluefin extracts total **957** accepted records from five
distinct contributing datasets, displayed in **thirteen** geographically
separated boxes. The year labels in the table describe accepted observation
dates; query dates for the 29 newly staged regions, and the five recently added
bluefin regions, are 2014-01-01 to 2024-12-31. The exact WGS84 search bounds
are in `publish_species.py` and the manifests. For these grouped extracts, a
deterministic complete-link grouping keeps all pairs of positions in a box
within 800 km, reducing the diameter to 700, 600 or 500 km for a scope when
needed to fit every group within the 20° map limit. Close records share a box
and distant ones form separate boxes.
The earlier regional extracts keep their reviewed one-box grouping. A separate box around one reported position still does not
establish a habitat area. Search coverage is uneven; gaps on the map are
unknown, not confirmed absences. Survey density cannot be compared directly
with citizen reports. The map's scrollable region list zooms to each documented group. The
original 43 extracts account for 6,404 records. The eleven newer
extracts add 3,327 accepted records across three species, so the map now
contains **9,731 accepted records from 54 scoped extracts**, displayed in
121 current areas. Only 111 have a separate illustrative destination;
the others remain visible without an invented flow. These newer
sources all use the same iNaturalist Marine dataset license and citation;
counts are records, not unique animals or survey effort.

Select a documented area to open its evidence card: source and manifest,
query bounds and dates, accepted and rejected counts, coordinate uncertainty,
recorded method, dataset and record-level rights, and the exact OBIS IDs in
that box. Search those IDs in its linked species-level curated file to inspect
the retained rows. Scope totals may cover several boxes. The card does not
offer a download; [the rights review](docs/rights-review.md) records mixed and
missing occurrence-level license fields for source-by-source review.

## How the files fit

| Path | Purpose |
| --- | --- |
| `data/obis/*.jsonl.gz`, `*.manifest.json` | Bounded coordinate-checked staging extracts, query URLs, upstream QC counts, access time and SHA-256. The original API response is not retained in full. |
| `python/ocean_pipeline/sources.py` | Bounded OBIS staging using the occurrence ID cursor; refuses incomplete or repeated pages. |
| `python/ocean_pipeline/publish_species.py` | Source-specific taxon, date, license and quality checks; generates 53 regional snapshots, including eleven scopes for the three additional species. |
| `python/ocean_pipeline/publish_pilot.py` | Rebuilds the original loggerhead snapshot. |
| `python/ocean_pipeline/curate.py` | Rebuilds the ten species-level clean files and a rejected-record audit ledger; `--check` detects drift. |
| `src/data/curated/*.json` | Ten clean species files read by the website: checked positions, taxon and group, source scope, provenance and quality totals. |
| `data/curated/rejected-records.jsonl` | Record-level reasons for rows excluded after staging. Upstream coordinate/duplicate rejects are counted in manifests. |
| `src/data/speciesMetadata.json`, `src/data/index.ts` | Descriptive names and 54 explicitly scoped extracts across ten species. |
| `src/data/observationScenario.ts` | Computes an ocean-centered square per reviewed region or geographic group, enclosing its retained points. |
| `src/data/mapPresentation.ts` | Separates observed areas from optional illustrative destinations at the map boundary; neither is a modeled forecast. |
| `src/MapView.tsx`, `src/data/flowData.ts` | Interactive map and illustrative curved animation over water. |

Run `PYTHONPATH=python python -m ocean_pipeline.curate` to regenerate the clean
files from the committed extracts. The Python CI checks reproducibility with
`--check`. **Refresh regional OBIS extracts** in GitHub Actions produces a
reviewable artifact containing all staged extracts, manifests, ten clean
files and the rejection ledger. Inspect counts, flags, source rights and
positions before replacing the committed inputs and outputs. The workflow
does not silently update the website. See `docs/curated-pipeline.md` for the
contract, `docs/obis-staging.md` for staging, and `docs/data-format.md` for
the map display.

To produce a genuine destination prediction, select suitable environmental
predictors and study areas, fit and spatially validate a species distribution
model, document uncertainty and review the result scientifically. A displacement
of boxes alone cannot predict where animals will go.
