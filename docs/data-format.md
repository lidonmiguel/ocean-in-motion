# Species dataset contract (v1)

Each species is one JSON document in `src/data/species/`, parsed at startup by
`src/data/schema.ts`. The three bundled examples are deliberately synthetic.
This contract prepares the UI for reviewed model outputs; passing validation
checks structure and provenance labels, **not** scientific validity.

| Field | Type / meaning |
| --- | --- |
| `schemaVersion` | Literal `1`. Change it when the format changes incompatibly. |
| `id`, `scientificName`, `commonNameEs` | Stable slug, taxonomic name and Spanish display name. |
| `summaryEs`, `ecologyEs` | Spanish explanatory copy. |
| `provenance` | `synthetic-demo` or `reviewed-model`. |
| `reviewStatus` | `illustrative` for demo; `approved` for externally reviewed output. This is a declaration, not a review mechanism. |
| `scenario` | Currently `SSP2-4.5` only. |
| `periods` | `{ "current": "<reference period>", "future": "2050" }`. Use an exact observed/baseline period for real models. |
| `citations[]` | `{ id, title, url, role }`, where role is `demonstration`, `occurrence`, `environment`, `method` or `model`. URL may be null only for synthetic data. Reviewed output must link occurrence, environment and model citations. Record dataset versions, access dates and licenses in the cited documentation or a future metadata revision. |
| `habitat.current[]`, `habitat.future[]` | Nonempty arrays of grid cells; IDs unique within a period. See below. |
| `movementVectors[]` | Optional `{ from: [lon, lat], to: [lon, lat], labelEs }`. A summarised direction of distribution change, never an individual animal path. Omit if the analysis does not support a defensible direction. |

Grid cell fields:

| Field | Type / meaning |
| --- | --- |
| `id` | Stable cell ID within a period. |
| `center` | `[longitude, latitude]` in WGS84 decimal degrees; valid ranges −180–180 and −85–85. |
| `widthDeg`, `heightDeg` | Positive angular width and height, at most 20°. Rendering splits cells that cross the antimeridian. A real grid should document actual resolution and grid geometry. |
| `suitability` | Normalized 0–1 relative habitat suitability index. It is **not** a probability of animal presence, abundance, or a migration route. |
| `uncertainty` | Normalized 0–1 uncertainty indicator, higher meaning more uncertain. The demo numbers are invented. Before real data, define the metric, calibration, aggregation and uncertainty decomposition; consider replacing this with intervals or ensemble summaries in a future schema version. |

The web map paints suitability bands at `<0.35`, `0.35–<0.7`, and `≥0.7`.
Cell selection reveals exact suitability and uncertainty values. These cutoffs
are presentation choices for the fixture, not ecological thresholds.

The synthetic demo draws multiple curved strands from each current cell to
its future cell with the same ID. Their endpoints stay inside the hand-authored
cells, and each strand follows its pair's direction of displacement. Different
pairs can have different directions. The strands grow from the current cell,
move along the curved path, then disappear at the future cell; the map leaves
no permanent route lines. Their spacing, density, and timing are design choices,
not estimated migration
paths or movement model output. For reviewed outputs the interface does not
infer connectors from cells; it only uses explicitly supplied `movementVectors`
when their direction statistic is documented.

Displayed strokes are routed over water using the same bundled 1:110m Natural
Earth land polygons as the map. A half-degree A* search approximates the shortest
water path. A small decorative arc can lengthen that route; it is reduced or
discarded near land, and every drawn segment is checked against the boundaries.
Synthetic strand endpoints on land, or pairs with no water path at this map
resolution, are omitted. Reviewed vectors are likewise hidden when they cannot
be drawn over water; this cartographic routing does not establish an actual
animal route or navigable marine passage. Narrow channels and small islands may
be absent from the coarse basemap.

## Example excerpt

```json
{
  "schemaVersion": 1,
  "id": "example-species",
  "scientificName": "Species example",
  "commonNameEs": "Especie de ejemplo",
  "summaryEs": "Descripción ilustrativa.",
  "ecologyEs": "Contexto ilustrativo.",
  "provenance": "synthetic-demo",
  "reviewStatus": "illustrative",
  "scenario": "SSP2-4.5",
  "periods": { "current": "Referencia ilustrativa", "future": "2050" },
  "citations": [{ "id": "demo", "title": "Hand-authored synthetic fixture", "url": null, "role": "demonstration" }],
  "habitat": {
    "current": [{ "id": "a", "center": [-40, 20], "widthDeg": 8, "heightDeg": 6, "suitability": 0.6, "uncertainty": 0.2 }],
    "future": [{ "id": "a", "center": [-38, 25], "widthDeg": 8, "heightDeg": 6, "suitability": 0.7, "uncertainty": 0.5 }]
  }
}
```

For production output, retain a machine-readable processing manifest with
taxon identifier, query filters, input versions, spatial reference, baseline
and forecast windows, model parameters, validation results, uncertainty method,
scenario and review sign-off. Do not change a fixture's status merely to remove
the warning: populate reviewed data only after scientific review.
