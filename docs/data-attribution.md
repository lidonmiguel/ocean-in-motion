# Code license and data attribution

Original project code is licensed under [MIT](../LICENSE), copyright 2026
Miguel Lidón. This does not replace the terms or attribution of third-party
data, libraries, geographic boundaries or derived geographic artifacts.

| Material | Source and attribution | Terms / provenance |
| --- | --- | --- |
| IHO marine boundaries | Flanders Marine Institute (2018), IHO Sea Areas v3, [doi:10.14284/323](https://doi.org/10.14284/323); simplified GeoJSON distributed by [alvinometric/oceans-seas.geojson](https://github.com/alvinometric/oceans-seas.geojson) | CC BY 4.0. Source: `data/geography/iho-sea-areas-simplified.geojson`; derived display geometry: `src/data/seaAreas.geojson`. |
| Caspian outline and land cover | [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) | Public domain. Derived outline and simplified land cover remain attributed in the map and data guide. |
| Reconstructed temperatures | [NOAA NCEI ERSSTv6](https://www.ncei.noaa.gov/products/extended-reconstructed-sst) | NOAA source attribution is retained. Monthly source URLs and SHA-256 hashes are recorded in both temperature manifests. These are reconstructed temperatures, not direct local measurements. |
| Estimated histories and experimental forecasts | Ocean in Motion pipeline, derived from the sources above | Their source basis, donor regions and limitations remain in the snapshots, CSV exports and reports. MIT does not relabel upstream data. |
| Runtime libraries | React, MapLibre GL JS, deck.gl and their dependencies | Their own licenses apply; retain dependency notices supplied with distributed builds. |

## Marine snapshot traceability

The [marine manifest](../data/geography/marine-temperature.manifest.json)
was added with the NOAA coverage refresh in
[commit 558efa9](https://github.com/lidonmiguel/ocean-in-motion/commit/558efa96787c9f262d68d770a5812fbcf220ab51).
That immutable revision contains the generator and its helper modules, including
the region catalog and estimation method. It provides the code version needed
to interpret the manifest's generator hash.

The manifest records the 528 monthly inputs for 1982–2025, their SHA-256 hashes,
source URL pattern, access date, source-geometry hash, snapshot hash, generator
hash, eligibility method and complete-cell counts for every marine region/year.
The coverage tests verify these against the checked-in source and output, and
verify that estimates are used only below the two-cell threshold. See the
[coverage audit](../reports/temperature/SOURCE_COVERAGE.md) for the 60 replaced
histories and the remaining 20 estimates.

The Caspian series retains its [separate input manifest](../data/geography/caspian-temperature.manifest.json).
Both input vintages are preserved; changing how the browser loads files does
not recompute or alter the scientific snapshots.

See [the data guide](temperature-data.md) for source preparation and weighting,
and [the forecast guide](temperature-forecast.md) for experiment provenance.
