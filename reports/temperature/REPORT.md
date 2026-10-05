# Annual regional SST forecasting: 2026–2030

Run `d384abb90341f47a`. Selected on development data: **persistence**.

NOAA ERSSTv6 reconstructions, not direct local measurements. Five direct horizon models; learned models predict change from the origin temperature.

## Development comparison (selection only)

| Model | MAE °C | RMSE °C |
| --- | ---: | ---: |
| persistence | 0.203 | 0.285 |
| boosting | 0.218 | 0.307 |
| boosting_neighbors | 0.218 | 0.308 |
| ridge100 | 0.224 | 0.312 |
| ridge100_neighbors | 0.229 | 0.317 |
| ridge10 | 0.245 | 0.335 |
| ridge10_neighbors | 0.248 | 0.337 |
| trend5 | 0.303 | 0.453 |

## Untouched final test: origin 2020 → 2021–2025

Selected model MAE: **0.220 °C**. Persistence: **0.220 °C**. Trend: **0.263 °C**.

| Horizon | MAE °C | Bias °C | Interval width °C | Test coverage | Calibration rows |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 0.210 | 0.185 | 0.760 | 86% | 110 |
| 2 | 0.208 | 0.082 | 0.980 | 86% | 88 |
| 3 | 0.247 | -0.098 | 0.860 | 86% | 66 |
| 4 | 0.257 | -0.179 | 0.960 | 82% | 44 |
| 5 | 0.175 | -0.080 | 0.880 | 95% | 22 |

## Protocol and limits

Development origins 2000–2009 (latest target 2014); fixed-model interval calibration origins 2014–2018, only targets 2015–2019; final origin 2020. Labels in training must be at or before the forecast origin. All regions share year cutoffs. Final fits use data available through 2025.

Nominal 90% symmetric intervals use a conservative empirical absolute-error order statistic separately by horizon. Correlated regions and years violate exchangeability; test coverage above is empirical, not a guarantee. The 5-year calibration has only one origin (22 regional errors). Intervals do not include all upstream reconstruction uncertainty.

See metrics.json for regional errors, provenance and neighbor ablations; backtests.csv for every prediction, actual and split; features.csv and geography.json for input diagnostics.

- Only 22 existing NOAA-derived regional series; estimated zones excluded.
- Intervals pool past errors across correlated regions; nominal 90% is not a guarantee.
- No climate scenarios or physical transport model; statistical experiment only.
- Static geographic proximity is a heuristic; Caspian has no marine neighbors.
- A single five-year final test window cannot establish future reliability.
