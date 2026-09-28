# Océano en Movimiento

An experimental marine map in Spanish with seven species and nine
**observation-derived** regional boxes. The older hand-authored habitat
fixtures have been removed.
Each turquoise square encloses the positions in one checked, bounded OBIS
dataset, with a 20 km display margin. The underlying observations, original
extract, query manifest and source citation are versioned in this repository.

**The pink destinations and animated water-only strands are still a visual
simulation.** They are explicit translations of the observed squares, not
observations, migration tracks, predicted 2050 habitat, or a species
distribution model. The square describes the extent of *reported positions in
the scoped dataset*, not all habitat, animal abundance, or absence elsewhere.

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

This public repository deploys through **GitHub Actions**: under **Settings →
Pages**, choose **GitHub Actions** as the build source, then merge to `main`.
The published map is at
<https://lidonmiguel.github.io/ocean-in-motion/> after deployment completes.

## Displayed occurrence datasets

All taxa are exact WoRMS AphiaIDs; all extracts use OBIS v3 occurrence queries
with a specific dataset UUID, WGS84 bounds and inclusive dates. Counts below
are accepted records after documented quality checks. The links lead to the
individual source dataset, with its citation and license displayed in the app.

| Species | Regional source, period | Accepted / queried | Rights |
| --- | --- | ---: | --- |
| *Thunnus thynnus* | [iNaturalist Marine, western Mediterranean](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 32 / 38 | CC BY-NC 4.0 |
| *Thunnus thynnus* | [NYSERDA digital aerial survey, New York Bight](https://obis.org/dataset/ca78b5b9-d4e4-4ab0-bbe1-9f75659769e2), 2017–2018 | 653 / 653 | CC BY 4.0 |
| *Thunnus thynnus* | [Observatoire PELAGIS boat surveys, Bay of Biscay](https://obis.org/dataset/924c4d25-6358-44a3-8f4d-24086256ad3e), 2015–2021 | 18 / 18 | CC BY-NC 4.0 |
| *Rhincodon typus* | [iNaturalist Marine, Gulf of Mexico](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 157 / 172 | CC BY-NC 4.0 |
| *Xiphias gladius* | [ANSE visual surveys, southeastern Spanish Mediterranean](https://obis.org/dataset/da5982a8-e9a1-46af-ab1b-8293edb79c5d), 2014–2024 | 190 / 190 | CC BY-NC 4.0 |
| *Megaptera novaeangliae* | [NEFSC aerial survey, Gulf of Maine](https://obis.org/dataset/c7d259da-370a-4504-9445-29de96d9223a), 2022 | 479 / 479 | CC0 1.0 |
| *Tursiops truncatus* | [ISPRA ferry transect, western Mediterranean](https://obis.org/dataset/d5847ecb-6f9b-4599-888a-461cb26f8018), 2014–2018 | 84 / 84 | CC BY 4.0 |
| *Chelonia mydas* | [iNaturalist Marine, northwestern Caribbean](https://obis.org/dataset/eaea291a-1e1d-4382-b86f-ac3cc15b8d5a), 2014–2024 | 384 / 519 | CC BY-NC 4.0 |
| *Caretta caretta* | [ISPRA ferry transect, western Mediterranean](https://obis.org/dataset/b9bfb219-1d5c-450e-9b26-fd377aee8561), 2013–2017 | 117 / 117 | CC BY 4.0 |

The iNaturalist Marine source is credited to iNaturalist contributors / Marine
Biological Association (2026), [doi:10.17031/0bbcjx](https://doi.org/10.17031/0bbcjx).
The New York Bight aerial survey is credited to Vukovich (2022),
[doi:10.82144/2972b82d](https://doi.org/10.82144/2972b82d). The Bay of
Biscay boat surveys are credited to Doremus and Peltier (2025),
[doi:10.82144/c7d01c61](https://doi.org/10.82144/c7d01c61).
The ANSE visual survey is credited to Murcia Abellán and Morata (2026).
The NEFSC 2022 aerial survey is credited to Cole, Khan and Ogilvie (2025),
[doi:10.82144/9f540955](https://doi.org/10.82144/9f540955).
The ISPRA cetacean ferry transect is credited to Arcangeli, Campana,
Paraboschi and ISPRA (2018), [doi:10.14284/533](https://doi.org/10.14284/533);
the loggerhead transect to the same authors, [doi:10.14284/532](https://doi.org/10.14284/532).
The recorded dataset rights come from OBIS dataset metadata `intellectualrights`
checked on 2026-09-27 and 2026-09-28. **CC BY-NC sources carry a noncommercial restriction.**

The iNaturalist Marine queries exclude OBIS `ON_LAND` flags (6 tuna, 11 whale
sharks, 131 green turtles). Four whale shark and four green turtle records with
declared position uncertainty greater than 300 km are also excluded. `NO_DEPTH`
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
The three bluefin datasets total **703** accepted records in three separately
scoped regions. The two new queries use 2014-01-01 to 2024-12-31 and WGS84
bounds (−75, 38, −69, 43) and (−12, 42, −1, 50); the year labels in the table
describe when accepted observations actually occurred. One box is drawn for
each dataset. Survey density cannot be compared directly with citizen reports.

## How the files fit

| Path | Purpose |
| --- | --- |
| `data/obis/*.jsonl.gz`, `*.manifest.json` | Lossless raw bounded extracts, query URLs, QC counts, access time and SHA-256. |
| `python/ocean_pipeline/sources.py` | Bounded OBIS staging using the occurrence ID cursor; refuses incomplete or repeated pages. |
| `python/ocean_pipeline/publish_species.py` | Source-specific taxon, date, license and quality checks; generates eight non-loggerhead snapshots. |
| `python/ocean_pipeline/publish_pilot.py` | Rebuilds the original loggerhead snapshot. |
| `src/data/observations/*.json` | Compact, checked positions and citations bundled in the map. |
| `src/data/speciesMetadata.json`, `src/data/index.ts` | Descriptive names and nine explicitly scoped display layers across seven species. |
| `src/data/observationScenario.ts` | Computes one near-ocean-centered square per extract, enclosing every retained point. |
| `src/MapView.tsx`, `src/data/flowData.ts` | Interactive map and illustrative curved animation over water. |

Run **Refresh regional OBIS extracts** in GitHub Actions for a reviewable new
artifact, then inspect counts, flags, source rights and positions before
replacing the committed snapshot and manifest. The workflow does not silently
update the website. `docs/obis-staging.md` details the generic source command;
`docs/data-format.md` defines the map contract.

To produce a genuine destination prediction, select suitable environmental
predictors and study areas, fit and spatially validate a species distribution
model, document uncertainty and review the result scientifically. A displacement
of boxes alone cannot predict where animals will go.
