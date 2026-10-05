# Temperature comparison

The panel below the map compares two to five of the existing 102 regions. It
uses the same reviewed annual series and selected year as the map. No new
observations, models, geographic aggregation or interpolation are introduced.
Region colors stay assigned while the region remains selected. Region selection
is explicit: changing the map selection does not replace a comparison; use
**Añadir zona del mapa** to add it.

## Reference and historical change

- **Absolute temperature:** the existing annual surface temperature in °C.
- **Anomaly:** annual temperature minus that region's own arithmetic mean over
  **1982–2010**, inclusive (29 annual values). The reference is fixed when the
  visible interval changes. Forecast values never enter the reference.
- **Historical change:** mean **2016–2025** minus mean **1982–1991**, inclusive.
  Each period contains ten annual values. This describes the difference between
  periods, not a fitted trend, causal warming attribution or an annual rate.

These means weight complete annual regional values equally; they do not pool
NOAA cells or regions. A reference or change is unavailable unless every year
in its historical period has exactly one finite value. All published regions
currently have complete series. Computations use the published values at their
existing precision; displayed statistics are rounded to two decimals.

## Provenance and prediction

The **22 NOAA-derived histories are reconstructed regional SST**, rather than
direct station measurements. The **80 estimated histories** use neighboring
NOAA regions and a latitude adjustment. Estimated anomaly and historical change
are also estimates, not independently observed warming. A donor and its derived
sea are not independent evidence. The Caspian Sea remains an inland water region.

Historical lines are continuous, forecasts from 2026 are dashed in the same
regional color, and the forecast area is highlighted. Each inspected value and
CSV row identifies reconstructed history, estimated history, a forecast with a
NOAA basis, or a forecast with an estimated basis. Persistence was selected by
the existing experiment, so point forecasts preserve the 2025 value. Flat lines
are model behavior, not a claim that warming will stop.

The comparison omits uncertainty bands to avoid stacking up to five different
ranges. The original regional detail chart retains them and explains the
nominal calibrated interval versus the donor-derived range without validated
local coverage. The comparison CSV retains interval bounds, type, nominal level
where applicable, forecast model and run identifier.

## Controls, categories and export

Search is accent-insensitive. Category and source filters affect only the
region picker, preserving the selected comparison. The ocean filter uses the
seven published Atlantic/Pacific subdivisions, Indian, Arctic and Southern
regions. The sea filter includes names beginning with Mar/Mares, the two
Mediterranean regions, Kattegat, Skagerrak and the Caspian. Other regions include
gulfs, bays, channels and straits. These are presentation groups based on the
published regional labels, not a new scientific classification. They do not
combine smaller seas into ocean-wide averages.

The visible period can be narrowed with its start/end controls. The reference
period remains fixed. Hover or tap a line chart year to inspect all chosen
regions; click to select that year on the map. The shared keyboard-accessible
year slider updates the map and the sorted bar comparison. On the focused line
chart, left/right arrow keys inspect years and Enter selects the inspected year
on the map. Negative anomalies
extend to the left of zero. The expandable table provides the visible series
as text. The CSV exports only selected regions and the chosen interval, with
both absolute temperature and anomaly, fixed reference dates and means,
provenance, cells, donor regions and forecast traceability. UTF-8 BOM and quoted
fields support spreadsheet imports. Raw numerical values are preserved.

See [source preparation and geographic limitations](../README.md#sea-temperatures-and-provenance)
and [forecast methodology](temperature-forecast.md).
