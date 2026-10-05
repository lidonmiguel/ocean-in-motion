"""Clip Natural Earth land at the map seams for deck.gl's flat projection.

The world-atlas land MultiPolygon joins Alaska and Eurasia across ±180°.
Passing that ring directly to GeoJsonLayer produces a spurious fill across
the North Atlantic. This creates ordinary polygons with no edge longer than
180° in longitude, while retaining the original coast and holes.
"""

from __future__ import annotations

import json
import argparse
import subprocess
from pathlib import Path

from shapely import make_valid
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, box, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "src/data/temperatureLand.geojson"


def unwrap(ring: list[list[float]]) -> list[tuple[float, float]]:
    result = [tuple(ring[0])]
    for longitude, latitude in ring[1:]:
        while longitude - result[-1][0] > 180:
            longitude -= 360
        while longitude - result[-1][0] < -180:
            longitude += 360
        result.append((longitude, latitude))
    return result


def polygons(geometry):
    if geometry.geom_type == "Polygon":
        return [geometry]
    if geometry.geom_type in ("MultiPolygon", "GeometryCollection"):
        return [part for child in geometry.geoms for part in polygons(child)]
    return []


def build(resolution: str = '10m', tolerance: float = 0.01) -> dict:
    command = (
        "import {feature} from 'topojson-client'; "
        f"import world from 'world-atlas/land-{resolution}.json' with {{type:'json'}}; "
        "process.stdout.write(JSON.stringify(feature(world,world.objects.land)));"
    )
    raw = json.loads(subprocess.check_output(
        ["node", "--input-type=module", "-e", command], cwd=ROOT, text=True
    ))
    source_polygons = raw["features"][0]["geometry"]["coordinates"]
    result = []
    for rings in source_polygons:
        shell = unwrap(rings[0])
        shell_center = sum(point[0] for point in shell) / len(shell)
        holes = []
        for ring in rings[1:]:
            hole = unwrap(ring)
            hole_center = sum(point[0] for point in hole) / len(hole)
            shift = round((shell_center - hole_center) / 360) * 360
            holes.append([(lon + shift, lat) for lon, lat in hole])
        land = Polygon(shell, holes)
        if not land.is_valid:
            land = make_valid(land)
        if tolerance:
            land = land.simplify(tolerance, preserve_topology=True)

        # Clip into two 180° halves, including shifted copies at the date line.
        # The internal fill seams are not stroked in the UI.
        for shift in range(-2, 3):
            for west in (-180, 0):
                clipped = land.intersection(box(west + 360 * shift, -90,
                                                west + 180 + 360 * shift, 90))
                result.extend(translate(part, xoff=-360 * shift)
                              for part in polygons(clipped) if part.area > 1e-10)

    union = unary_union(result)
    assert not union.contains(Point(-40, 45)), "North Atlantic must remain water"
    assert union.contains(Point(-100, 40)), "North America must remain land"
    assert union.contains(Point(10, 50)), "Europe must remain land"
    for part in result:
        for ring in (part.exterior, *part.interiors):
            assert all(abs(a[0] - b[0]) <= 180 for a, b in
                       zip(ring.coords, list(ring.coords)[1:]))

    def rounded(value):
        if isinstance(value, (list, tuple)):
            return [rounded(item) for item in value]
        return round(value, 5)

    return {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {}, "geometry": {
            **mapping(part), 'coordinates': rounded(mapping(part)['coordinates'])}}
        for part in result
    ]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--resolution', choices=['110m', '50m', '10m'], default='10m')
    parser.add_argument('--tolerance', type=float, default=0.01)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    args = parser.parse_args()
    args.output.write_text(json.dumps(build(args.resolution, args.tolerance), separators=(",", ":")), encoding="utf-8")
    print(f"Wrote seam-free land to {args.output}")
