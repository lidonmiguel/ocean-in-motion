# Illustrative paths toward cooler neighboring seas

The temperature explorer emits lines from several distinct water positions in
each of its 102 regions: six per sea, or twelve for the largest ocean polygons.
The selected year's values drive the comparisons, including historical estimates
and experimental 2026–2030 predictions. This is an illustrative cooling rule,
not measured animal movement, currents or a physical transport model.

## Neighbor rule and proximity

At each current water point, inspect **only regions touching its current region**
that have a strictly lower temperature. Choose the closest of those neighbors.
The proximity score approximates geographic distance from the actual point to
the neighbor's water polygon boundary: local longitude scaling finds a nearby
boundary point, then haversine measures the distance in kilometers. It does not
use distance between ocean centers, route length, or temperature difference.

The water route goes directly into that neighboring region, to a distributed
water position inside it. On arrival the same comparison runs from the new
point against **that new region's own neighbors**. There is no global search,
no jump to a non-neighbor, and no passage through a warmer region to reach a
colder one. Equal temperatures do not count as cooler. Each visited region is
strictly colder, so the chain ends after at most 102 regions.

If no adjacent cooler region is routable, the line turns locally, shrinks and
fades completely, waits briefly, then a new line starts from its original water
position. Caspian has no marine neighbors and always circulates locally.

## Water geometry and origins

`src/data/temperatureRoutes.json` versions distributed origins, local orbits,
directed routes from every origin to each available neighbor, and geographic
proximity scores. Origins are spread with deterministic farthest-point sampling
inside open water. Large regions get twelve distinct origins; others get six.
No line is emitted from a regional center. Representative interior points are
used only as conservative routing waypoints if a direct water route is blocked.

IHO polygons supply touching/overlapping neighbor candidates, with a 0.025°
tolerance for small rounding gaps. Curves use the same sinusoidal bend formula
as the species lines, shrinking or reversing the bend when needed near land.
Every connector stays within its two neighboring water polygons and avoids
the displayed Natural Earth 10m land, including islands. Compact control points are densified to steps of at most 0.2° in the
renderer; validation checks that reconstructed path to limit projection errors. Local turns stay within their current region.

The artifact contains 654 origins, 654 local turns and 2,148 directed origin-to-neighbor routes.
There are 149 routable neighbor pairs out of 171 candidates. The 22 unavailable
pairs remain recorded. Some are genuine land barriers; others involve narrow
straits unresolved by the conservative geometry/grid. Marmara remains isolated.
A missing connector is not proof that two real seas are disconnected; no land
shortcut is inserted. Origin distribution currently samples the largest water
component that can access the conservative route waypoint, not every island
channel or every disconnected polygon component.

Proximity uses a local geographic approximation and routes end at sampled water
positions; this does not establish exact geodesic distances to every point on a
sea's boundary or exact shortest marine paths. Static polygon limits, coarse 2°
SST reconstructions and imputed temperatures further limit interpretation.

## Shared animation

Both map views import `flowAnimation.ts`, sharing the 5.6-second cycle, growing
and retracting visible-length window, three-step turquoise-to-pink gradient,
1.8px stroke, and subtle 5px glow. Temperature routes have no extra bright head,
white/gold palette, or selected-origin color override. The curve formula also
matches the existing species routes, with detailed coast checks performed offline.
Long ocean hops are split into local arcs and visible sections at the same 12°
scale used by the animal demonstration offsets. Each section follows the same
growth/retraction cycle, keeping trace length bounded instead of stretching a
line across an entire ocean. The cooling decision is only repeated on arrival
at the next region, never at these visual section boundaries. Terminal turns add a final
fade and blank interval. Seconds are visual timing, not real travel duration.

Year changes reset and recompute routes. Selection does not reset them. Users
can pause or hide lines; reduced-motion preferences freeze them. WebGL and SVG
share the same frame/gradient logic and split paths at the antimeridian. Land
covers the lines in both renderers. Frame updates are throttled to the same
30ms interval as the species map, without React state updates each frame.

## Reproduce and verify

```bash
python -m pip install -e './python[forecast]'
PYTHONPATH=python python -m ocean_pipeline.temperature_routes
PYTHONPATH=python python -m ocean_pipeline.temperature_routes --check
PYTHONPATH=python python -m unittest discover -s python/tests -p test_temperature_routes.py -v
npm run check
```

Generation is offline and deterministic. SHA-256 hashes trace input polygons,
displayed land and generator code. `--check` verifies origin coverage/distinctness,
orbits, touching neighbors, complete choices for every origin, route endpoints,
water clearance, vertex density and proximity scores without rerunning search.
Web tests cover the shared visual frame, different choices from different origins,
neighbor-only descent, rejection of warmer intermediary jumps, year changes,
terminal disappearance and all 49 years. CI runs both web and geometry checks.
