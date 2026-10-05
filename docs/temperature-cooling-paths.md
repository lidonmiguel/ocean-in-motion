# Illustrative paths toward cooler seas

The temperature explorer emits a visual point from a fixed water position in
each of its 102 regions. It uses the temperatures of the selected year, including
clearly identified historical estimates and experimental 2026–2030 predictions.
These traces illustrate a discrete cooling rule, not measured animal movement,
ocean currents, transport velocities or a physical climate simulation.

## Distance and cooling rule

From the point's **current position**, choose the closest cooler sea that can
be reached over water. Proximity is the great-circle geographic distance from
that position to the representative water point of the destination sea.
There is **no fixed search radius** and the destination does not have to be an
immediate polygon neighbor. Recalculate the search from the new position after
every arrival. Distance, rather than the size of the temperature difference,
determines which cooler destination is chosen.

The navigation graph is undirected. Dijkstra determines reachability and a
short water-graph itinerary; it does not decide geographic proximity. A long
detour through an ocean's representative point cannot change which nearby
cooler destination is selected. Intermediate regions can be crossed to reach it, including warmer
ones; these are transit regions, not cooling stops. At each actual cooling stop,
temperature strictly decreases. Consequently, cooling stops never repeat, and
the sequence ends after at most 102 stops. Equal-temperature seas are not cooler.
This is a discrete greedy descent among regional destinations, not a continuous
temperature-gradient field or a differentiable optimization model.

If no reachable cooler destination exists, the point makes three expanding and
shrinking turns within its terminal region, fades completely, waits briefly,
then a new illustrative point starts. The same local behavior applies when a
starting region has no cooler reachable sea. Caspian is isolated from all marine
links; its points circulate locally.

## Water geometry

`src/data/temperatureRoutes.json` versions 102 representative water positions,
their safe local orbits, and the verified connectors. Neighboring/overlapping
IHO polygons supply **navigation candidates only**, not a cutoff on cooler-sea
selection. A 0.025° tolerance handles small boundary-rounding gaps. Every accepted
connector stays inside the union of its two regional polygons and avoids the
displayed Natural Earth 10m land geometry, including islands and lake holes.
The generator uses a small coastal clearance and a bounded, adaptive water-grid
search when a direct line is blocked. Dense vertices reduce projection errors.

The current artifact accepts **149 of 171 candidate links**. The 22 unavailable
pairs are recorded as `unroutablePairs`. Some are valid land barriers; others,
including narrow straits, cannot be resolved by these coast/region geometries
and the bounded grid. Marmara is currently isolated in this conservative graph.
Disconnected basins can therefore finish at different minima. A missing link is
not evidence that the real seas are physically disconnected. No terrestrial
shortcut is inserted when the available geometry cannot establish a water path.

The graph approximates water itineraries between selected representative positions;
it does not establish the exact shortest route from every point of a whole sea.
Rounded and clipped geography, static polygons, 2° temperature reconstructions
and neighbor-imputed values limit the interpretation of this visual experiment.

## Animation and controls

The WebGL map uses the existing project's moving PathLayer style, with a short
tail and a bright moving head. The source selected in the side panel is highlighted.
The SVG fallback uses the same route/frame functions and splits traces at the
antimeridian. Land is drawn above traces in both renderers.

The year changes the temperature comparisons and resets the animation clock.
Changing the selected region highlights its trace without resetting all routes.
Users can hide or pause the paths. System reduced-motion preferences render a
fixed frame and are respected when they change. Animation updates are throttled
to 25 fps and do not update React state each frame. Cleanup cancels animation
frames and removes preference listeners. Speeds, tails, emission phases, turns
and fade durations are visual choices; seconds do not represent real travel time.

## Reproduce and verify

```bash
python -m pip install -e './python[forecast]'
PYTHONPATH=python python -m ocean_pipeline.temperature_routes
PYTHONPATH=python python -m ocean_pipeline.temperature_routes --check
PYTHONPATH=python python -m unittest discover -s python/tests -p test_temperature_routes.py -v
npm run check
```

Generation is offline. The artifact records SHA-256 hashes of the region and
displayed-land inputs and generator code. `--check` verifies these hashes, every
connector and orbit, endpoints, segment density and distances without repeating
the path search. CI performs this validation. Web tests cover nearest cooler
selection, recalculation, warmer transit, equal-temperature stops, isolation,
year changes, terminal disappearance, dateline splitting and all 49 years.
