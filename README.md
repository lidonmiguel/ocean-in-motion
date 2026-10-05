# Ocean in Motion

Explore how sea-surface temperatures vary across **102 seas and oceans**, compare
their historical changes, and inspect experimental forecasts through **2030**.
An interactive map connects a reproducible Data Science experiment to one
continuous **1982–2030** timeline, with an English interface.

[**Live demo →**](https://lidonmiguel.github.io/ocean-in-motion/) ·
[Executed notebook](notebooks/temperature_forecasting.ipynb) ·
[Experiment report](reports/temperature/REPORT.md)

## Explore the project

- **Map:** select a year and region to inspect annual temperature, its complete
  series and data provenance.
- **Compare:** choose two to five regions, switch between temperature and
  anomalies, inspect historical change and compare the selected year's values.
- **Forecast:** explore 2026–2030 in the same timeline, with dashed lines,
  explicit forecast labels and regional uncertainty information.
- **Export:** download the complete timeline or a chosen comparison as CSV,
  retaining historical sources, donor regions and forecast traceability.

Animated paths connect touching cooler regions using the selected year's values.
They are illustrative visual traces, not measured ocean currents; they can be
paused or hidden.

### Temperature map

<img width="1899" height="934" alt="image" src="https://github.com/user-attachments/assets/983ae9a3-a1ed-4b65-9ca5-62436072bfc9" />

### Regional comparison

<img width="1824" height="827" alt="image" src="https://github.com/user-attachments/assets/c6fb5be9-4db0-4dcd-a3ca-fda929f4de63" />

<img width="1828" height="820" alt="image" src="https://github.com/user-attachments/assets/44fcf501-93c8-4370-ba8b-edfc06c757ff" />

<img width="1811" height="634" alt="image" src="https://github.com/user-attachments/assets/9207a9d5-a0d1-4c19-ab55-3851a471073d" />

## The Data Science result

**Can historical temperatures and geographic features outperform simple
baselines when forecasting a known region one to five years ahead?**

Eight candidates compare persistence, local trend, Ridge regression and Gradient
Boosting, including variants with geographic neighbor features. Model selection,
interval calibration and the final test use separate temporal periods.

| Final experiment | Result |
| --- | --- |
| Selected model | Histogram Gradient Boosting, without neighbor features |
| Evaluated data | 82 NOAA-derived regional histories, 1982–2025 |
| Fixed final test (re-evaluated) | Origin 2020 → target years 2021–2025 |
| Final-test MAE | **0.261 °C** |
| Nominal 90% interval coverage | Approximately **95%** across the final test |
| Published forecast | 2026–2030 for all 102 regions, with provenance distinguished |

Gradient Boosting narrowly wins development MAE (**0.2576 °C**, versus
**0.2580 °C** for persistence). In the fixed 2021–2025 test, persistence performs
better (**0.249 °C**, versus **0.261 °C** for the selected model). The selected
model follows the predeclared development rule; the small development advantage
does not establish reliable superiority. This is a re-evaluation of the same
published test window after expanding NOAA coverage, not a fresh untouched test.

[Evaluation and backtests](reports/temperature/REPORT.md) ·
[Methodology, temporal splits and model card](docs/temperature-forecast.md)

## Data and interpretation

**82 regions** use annual temperatures derived from
[NOAA ERSSTv6](https://www.ncei.noaa.gov/products/extended-reconstructed-sst),
a 2° reconstruction rather than direct local measurements. They include the
Caspian Sea as a separate inland water region.

A full NOAA coverage audit replaced **60 previously estimated histories** with
NOAA-derived series. See the [region-by-region audit](reports/temperature/SOURCE_COVERAGE.md).

The other **20 regions** have approximate histories derived from neighboring
NOAA regions and latitude adjustments. They are marked **≈**, excluded from
model training and evaluation, and receive donor-derived forecasts. Their local
forecast errors and interval coverage are unvalidated.

Regional boundaries use **VLIZ / IHO Sea Areas v3**, with source attribution and
CC BY 4.0 details in the data guide. The Caspian outline and detailed land/island
cover use **Natural Earth**.

Comparison anomalies subtract each region's own **1982–2010** mean. Historical
change compares **2016–2025** with **1982–1991**, using ten-year means. Regions
are not combined into an unweighted ocean-wide average.

This is a regional statistical experiment, not a climate scenario or a coastal
forecast. One five-year final test window does not establish future reliability;
nominal interval coverage is not guaranteed.

[Sources, preparation and geographic limitations](docs/temperature-data.md) ·
[Comparison definitions](docs/temperature-comparison.md) ·
[Animated path rules](docs/temperature-cooling-paths.md)

## Run and reproduce

**Web app — Node.js 24:**

```bash
npm ci
npm run dev
# Lint, TypeScript, tests and production build:
npm run check
```

**Offline experiment — Python 3.12:**

```bash
python -m pip install -e './python[forecast,analysis]'
PYTHONPATH=python python -m unittest discover -s python/tests -v
PYTHONPATH=python python -m ocean_pipeline.forecast --check
```

The application serves reviewed snapshots and separate geographic assets without data API credentials.
Input, configuration and pipeline hashes identify the experiment. GitHub Actions
checks the application, experiment and route geometry, and deploys `main` to
GitHub Pages. See the [data and maintenance guide](docs/temperature-data.md)
for source refreshes, geometry validation and notebook regeneration.

## Project structure

| Location | Purpose |
| --- | --- |
| `src/` | React / TypeScript explorer, MapLibre / deck.gl map and comparison charts |
| `src/data/` | Historical snapshots, forecasts and geographic artifacts |
| `python/ocean_pipeline/` | Data preparation, forecasting, analysis and geometry validation |
| `experiments/temperature/` | Candidate models and temporal split configuration |
| `reports/temperature/` | Evaluation metrics, backtests, feature diagnostics and figures |
| `notebooks/temperature_forecasting.ipynb` | Executed exploratory analysis and experiment walkthrough |
| `docs/` | Data sources, methods, comparison definitions and limitations |

## License

Original code is licensed under [MIT](LICENSE). Third-party data retain their
own terms and attribution: marine boundaries are CC BY 4.0, Natural Earth
geography is public domain, and NOAA ERSSTv6 remains credited. See
[code and data attribution](docs/data-attribution.md), including both input manifests.
