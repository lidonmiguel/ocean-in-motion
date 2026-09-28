# Species map contract (v1)

The displayed species are registered in `src/data/index.ts` from concise
descriptive metadata and ten species-level clean OBIS files in
`src/data/curated/*.json`. Each clean file contains its checked observations,
source scopes, quality totals and provenance; see `docs/curated-pipeline.md`.
`src/data/observationScenario.ts` calculates one square for each scoped
source, or one per separated group when that source declares a maximum group
diameter. It surrounds every position in the group with up to a 250 km visual
margin per side, limited by the map's 20° maximum box size.
When the geometric midpoint lies on land, the square's center moves to
nearby ocean and its side grows enough to keep every point enclosed.
The observed coordinate extrema remain unchanged in provenance metadata.

The square is a summary of *reported observations in a bounded dataset*.
It is not a statistically estimated habitat boundary, a grid of suitability,
or an accounting of unsurveyed waters. Datasets differ in effort, methods,
date coverage and georeferencing precision. The later pink square is a
labeled demonstration offset and has no empirical basis. It is shown only
when its entire display square remains outside every current square of that
species with a 35 km gap and its center has a marine route. Regions without a
valid visual destination have no future square or animated route.
The map starts with those illustrative squares and routes hidden. The user
must enable **Mostrar ejemplo ilustrativo** to see them; selecting another
species or group resets the control. `src/data/mapPresentation.ts` exposes
the observation layer as `observedAreas` and the optional visual layer as
`illustrativeDestinations`. The version 1 source contract still uses
`habitat.current` and `habitat.future` internally for compatibility, but
those fields do not turn an observation summary into a habitat model.

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Literal `1`; change on incompatible format changes. |
| `id`, `scientificName`, `commonNameEs`, `group` | Stable slug, taxon, Spanish name, display category. |
| `summaryEs`, `ecologyEs` | Spanish context and visual interpretation. |
| `provenance` | Displayed layers use `observation-demo`. The schema reserves `synthetic-demo` for old examples and `reviewed-model` for future vetted results; no synthetic fixture is displayed or bundled. |
| `reviewStatus`, `scenario` | `illustrative`, `illustrative` on observation layers. A tag alone is never scientific review. |
| `periods` | Observed study years and `Simulación visual` for the translated box. |
| `occurrence` | Total accepted record count, per-box ID and contributing dataset UUID, URL, citation, license, region, count, observed coordinate extrema, declared uncertainty range (or `null` when absent), and each box's illustrative offset or `null` when no separate destination is drawn. A dataset UUID can occur in multiple geographically separate boxes. |
| `citations[]` | Linked occurrence source plus explicit unlinked visual demonstration. Reviewed model output must also link its environment and model references. |
| `habitat.current[]`, `habitat.future[]` | One current box per reviewed geographic group; a subset has an illustrative future box with the same ID. No destination is required when a separate, marine display square cannot be placed. |
| `movementVectors[]` | Only for reviewed results with documented direction statistics. It is not an individual's movement path. |

Each box has `center: [longitude, latitude]` in WGS84 decimal degrees and
`widthDeg`, `heightDeg` of at most 20°. Observation boxes omit `suitability`
and `uncertainty` indices: those would invent scientific values. The source's
coordinate uncertainty is distinct from model uncertainty and may be
unreported. `src/data/schema.ts` validates shape and prevents observation
layers from masquerading as reviewed model output, but cannot certify
identifications, sampling design or ecological inference.

The animated strands start at multiple positions inside each current square
and arrive across its illustrative future pair. Their area spread is a visual
choice and does not represent observed tracks or dispersal probability. They
follow approximate shortest paths over a coarse bundled Natural Earth land
layer. A small bend is kept only where all drawn segments stay over water.
No strand is drawn when its endpoints or connecting path fail
these water checks. The animation is a cartographic preview, not a migration
route or prediction; narrow channels and small islands may be absent from
the basemap. The app omits inferred connectors for reviewed model outputs
unless explicit supported vectors are supplied.

The five additional bluefin and 40 additional other-species extracts declare an 800 km maximum pairwise distance
per group. The display reduces that diameter to 700, 600 or 500 km for an
entire scope if a group would exceed the 20° box limit. Points are sorted by
location and added to the nearest group only
when every point in that group remains within this diameter. Distant points
make a separate box. The older regional extracts keep their original
one-box-per-extract grouping. This spatial rule is a
display choice, not a biological clustering model. Its exact source bounds,
group diameter and uncertainty are retained with the published clean files.

For a real forecast, retain a processing manifest for occurrence selection,
environmental predictor versions, spatial reference, baseline and target
periods, model parameters, spatial validation, uncertainty and review. Then
replace the visual offset with separately reviewed model output.
