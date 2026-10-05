# Annual regional SST forecasting: 2026–2030

Run `5ed531b7bb3af8d8`. Selected on development data: **boosting**.

NOAA ERSSTv6 reconstructions, not direct local measurements. Five direct horizon models; learned models predict change from the origin temperature.

## Development comparison (selection only)

| Model | MAE °C | RMSE °C |
| --- | ---: | ---: |
| boosting | 0.258 | 0.341 |
| persistence | 0.258 | 0.349 |
| boosting_neighbors | 0.259 | 0.342 |
| ridge100 | 0.272 | 0.358 |
| ridge100_neighbors | 0.273 | 0.359 |
| ridge10 | 0.276 | 0.363 |
| ridge10_neighbors | 0.277 | 0.363 |
| trend5 | 0.386 | 0.546 |

## Fixed final test: origin 2020 → 2021–2025

Selected model MAE: **0.261 °C**. Persistence: **0.249 °C**. Trend: **0.338 °C**.

| Horizon | MAE °C | Bias °C | Interval width °C | Test coverage | Calibration rows |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 0.266 | 0.216 | 1.131 | 91% | 410 |
| 2 | 0.255 | 0.136 | 1.271 | 98% | 328 |
| 3 | 0.284 | 0.109 | 1.392 | 96% | 246 |
| 4 | 0.281 | -0.032 | 1.480 | 96% | 164 |
| 5 | 0.220 | 0.092 | 1.052 | 94% | 82 |

## Protocol and limits

Development origins 2000–2009 (latest target 2014); fixed-model interval calibration origins 2014–2018, only targets 2015–2019; final origin 2020. Labels in training must be at or before the forecast origin. All regions share year cutoffs. Final fits use data available through 2025.

Nominal 90% symmetric intervals use a conservative empirical absolute-error order statistic separately by horizon. Correlated regions and years violate exchangeability; test coverage above is empirical, not a guarantee. The 5-year calibration has only one origin (82 regional errors). Intervals do not include all upstream reconstruction uncertainty.

The regional cohort was expanded after auditing NOAA coverage. The same published temporal protocol and candidates are rerun; the 2021–2025 window is a re-evaluation, not a new untouched holdout.

See metrics.json for regional errors, provenance and neighbor ablations; backtests.csv for every prediction, actual and split; features.csv and geography.json for input diagnostics.

## Coverage of the published timeline

510 forecasts cover all 102 historical regions. The 82 NOAA-derived regions use the selected model directly. For each of the other 20 regions, the published 2025 estimated value is shifted by the mean forecast change of its existing NOAA donors. This preserves the historical latitude adjustment and baseline; estimated histories never enter training or evaluation.

Bounds for these 20 regions transfer the donors' bounds by the same formula. They are donor-derived ranges, not locally calibrated 90% prediction intervals. Local errors, imputation uncertainty and coverage are unknown. No regional test MAE is assigned to them. The historical/future boundary remains labeled in the single 1982–2030 timeline.

- Only 82 complete NOAA-derived regional series enter training and evaluation.
- 20 estimated regions receive donor-derived forecasts; local error and range coverage are unvalidated.
- Intervals pool past errors across correlated regions; nominal 90% is not a guarantee.
- No climate scenarios or physical transport model; statistical experiment only.
- Static geographic proximity is a heuristic; Caspian has no marine neighbors.
- A single five-year final test window cannot establish future reliability.
