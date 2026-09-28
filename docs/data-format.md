# Species map contract (v1)

The displayed species are registered in `src/data/index.ts` from concise
descriptive metadata and one or more checked OBIS snapshots per species.
`src/data/observationScenario.ts` calculates one square for each scoped
source, or one per separated group when that source declares a maximum group
diameter. It surrounds every position in the group with a 20 km visual margin.
When the geometric midpoint lies on land, the square's center moves to
nearby ocean and its side grows enough to keep every point enclosed.
The observed coordinate extrema remain unchanged in provenance metadata.

The square is a summary of *reported observations in a bounded dataset*.
It is not a statistically estimated habitat boundary, a grid of suitability,
or an accounting of unsurveyed waters. Datasets differ in effort, methods,
date coverage and georeferencing precision. The later pink square is a
labeled demonstration offset and has no empirical basis.

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Literal `1`; change on incompatible format changes. |
| `id`, `scientificName`, `commonNameEs`, `group` | Stable slug, taxon, Spanish name, display category. |
| `summaryEs`, `ecologyEs` | Spanish context and visual interpretation. |
| `provenance` | Displayed layers use `observation-demo`. The schema reserves `synthetic-demo` for old examples and `reviewed-model` for future vetted results; no synthetic fixture is displayed or bundled. |
| `reviewStatus`, `scenario` | `illustrative`, `illustrative` on observation layers. A tag alone is never scientific review. |
| `periods` | Observed study years and `Simulación visual` for the translated box. |
| `occurrence` | Total accepted record count, per-box ID and contributing dataset UUID, URL, citation, license, region, count, observed coordinate extrema, declared uncertainty range (or `null` when absent), and each box's illustrative offset. A dataset UUID can occur in multiple geographically separate boxes. |
| `citations[]` | Linked occurrence source plus explicit unlinked visual demonstration. Reviewed model output must also link its environment and model references. |
| `habitat.current[]`, `habitat.future[]` | One box per reviewed geographic group in both periods; each pair shares its ID. The latter is illustrative in `observation-demo`. |
| `movementVectors[]` | Only for reviewed results with documented direction statistics. It is not an individual's movement path. |

Each box has `center: [longitude, latitude]` in WGS84 decimal degrees and
`widthDeg`, `heightDeg` of at most 20°. Observation boxes omit `suitability`
and `uncertainty` indices: those would invent scientific values. The source's
coordinate uncertainty is distinct from model uncertainty and may be
unreported. `src/data/schema.ts` validates shape and prevents observation
layers from masquerading as reviewed model output, but cannot certify
identifications, sampling design or ecological inference.

The animated strands connect each current square to its illustrative future
pair, following approximate shortest paths over a coarse bundled Natural
Earth land layer. A small bend is kept only where all drawn segments stay
over water. No strand is drawn when its endpoints or connecting path fail
these water checks. The animation is a cartographic preview, not a migration
route or prediction; narrow channels and small islands may be absent from
the basemap. The app omits inferred connectors for reviewed model outputs
unless explicit supported vectors are supplied.

Bluefin's five new source extracts declare a 500 km maximum pairwise distance
per group. Points are sorted by location and added to the nearest group only
when every point in that group remains within this diameter. Distant points
make a separate box. The older regional extracts, and all other species,
keep their original one-box-per-extract grouping. This spatial rule is a
display choice, not a biological clustering model. Its exact source bounds,
group diameter and uncertainty are retained with the published snapshots.

For a real forecast, retain a processing manifest for occurrence selection,
environmental predictor versions, spatial reference, baseline and target
periods, model parameters, spatial validation, uncertainty and review. Then
replace the visual offset with separately reviewed model output.
