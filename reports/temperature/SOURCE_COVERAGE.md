# NOAA regional coverage audit

The 1982–2025 refresh checks all 101 IHO marine polygons against all 528 monthly NOAA ERSSTv6 files. Caspian remains a separately audited inland series.

| Coverage | Before | After |
| --- | ---: | ---: |
| NOAA-derived marine histories | 21 | 81 |
| NOAA-derived histories including Caspian | 22 | 82 |
| Neighbor-estimated marine histories | 80 | 20 |

**60 previously estimated regions now have complete NOAA-derived histories.** All 81 eligible marine regions have at least two valid grid-cell centers inside their polygons in every one of the 44 years. The other 20 regions consistently have zero or one complete cell and retain explicit neighboring-region estimates. One complete cell is not promoted to a regional NOAA mean.

The threshold and weighting are unchanged: each cell must contain all twelve months; months use calendar-day weights and cells use cosine-latitude weights. NOAA values are reconstructions at 2° resolution, not direct local measurements. All marine means are recomputed; remaining estimates use the expanded donor pool.

The [marine manifest](../../data/geography/marine-temperature.manifest.json) records input hashes, coverage per region/year, source geometry, pipeline and output hashes. The comparison baseline is commit `b86088dc9c1e364899e43ffe1fdcf5683a643cec`.

## Previously estimated regions that now qualify

| Region | Complete NOAA cells per year, min–max |
| --- | ---: |
| Adriatic Sea | 2–2 |
| Aegean Sea | 4–4 |
| Alboran Sea | 2–2 |
| Andaman or Burma Sea | 13–13 |
| Arafura Sea | 17–17 |
| Baffin Bay | 39–39 |
| Banda Sea | 16–16 |
| Barentsz Sea | 112–112 |
| Bass Strait | 2–2 |
| Bay of Biscay | 5–5 |
| Beaufort Sea | 27–27 |
| Bismarck Sea | 6–6 |
| Celebes Sea | 9–9 |
| Celtic Sea | 6–6 |
| Ceram Sea | 3–3 |
| Chukchi Sea | 14–14 |
| Davis Strait | 31–31 |
| East Siberian Sea | 45–45 |
| Eastern China Sea | 18–18 |
| English Channel | 2–2 |
| Flores Sea | 4–4 |
| Great Australian Bight | 32–32 |
| Greenland Sea | 96–96 |
| Gulf of Aden | 6–6 |
| Gulf of Alaska | 17–17 |
| Gulf of Bothnia | 5–5 |
| Gulf of California | 3–3 |
| Gulf of Finland | 3–3 |
| Gulf of Guinea | 15–15 |
| Gulf of St. Lawrence | 9–9 |
| Gulf of Thailand | 7–7 |
| Halmahera Sea | 3–3 |
| Hudson Bay | 32–32 |
| Hudson Strait | 8–8 |
| Inner Seas off the West Coast of Scotland | 2–2 |
| Ionian Sea | 3–3 |
| Irish Sea and St. George's Channel | 2–2 |
| Japan Sea | 30–30 |
| Java Sea | 10–10 |
| Kara Sea | 72–72 |
| Labrador Sea | 26–26 |
| Laccadive Sea | 16–16 |
| Laptev Sea | 43–43 |
| Makassar Strait | 3–3 |
| Malacca Strait | 5–5 |
| Molukka Sea | 3–3 |
| Mozambique Channel | 31–31 |
| Norwegian Sea | 79–79 |
| Persian Gulf | 5–5 |
| Philippine Sea | 123–123 |
| Sea of Okhotsk | 51–51 |
| Skagerrak | 2–2 |
| Solomon Sea | 14–14 |
| Sulu Sea | 7–7 |
| The Coastal Waters of Southeast Alaska and British Columbia | 4–4 |
| The Northwestern Passages | 69–69 |
| Timor Sea | 7–7 |
| Tyrrhenian Sea | 6–6 |
| White Sea | 5–5 |
| Yellow Sea | 9–9 |

## Regions that still require estimates

| Region | Complete NOAA cells per year | Reason |
| --- | ---: | --- |
| Balearic (Iberian Sea) | 1 | Below the two-cell threshold |
| Bali Sea | 1 | Below the two-cell threshold |
| Bay of Fundy | 0 | No complete cell centers inside the polygon |
| Bristol Channel | 0 | No complete cell centers inside the polygon |
| Gulf of Aqaba | 0 | No complete cell centers inside the polygon |
| Gulf of Boni | 0 | No complete cell centers inside the polygon |
| Gulf of Oman | 1 | Below the two-cell threshold |
| Gulf of Riga | 1 | Below the two-cell threshold |
| Gulf of Suez | 0 | No complete cell centers inside the polygon |
| Gulf of Tomini | 1 | Below the two-cell threshold |
| Kattegat | 0 | No complete cell centers inside the polygon |
| Ligurian Sea | 0 | No complete cell centers inside the polygon |
| Lincoln Sea | 0 | No complete cell centers inside the polygon |
| Rio de La Plata | 0 | No complete cell centers inside the polygon |
| Savu Sea | 1 | Below the two-cell threshold |
| Sea of Azov | 1 | Below the two-cell threshold |
| Sea of Marmara | 0 | No complete cell centers inside the polygon |
| Seto Naikai or Inland Sea | 0 | No complete cell centers inside the polygon |
| Singapore Strait | 0 | No complete cell centers inside the polygon |
| Strait of Gibraltar | 0 | No complete cell centers inside the polygon |

The fixed forecasting candidates and date splits are rerun on the expanded NOAA cohort. The previously published 2021–2025 test window is a re-evaluation, not a new untouched holdout. Model metrics and outputs must be read from the regenerated experiment report.
