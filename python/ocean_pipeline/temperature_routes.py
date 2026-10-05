"""Prepare water-only neighbors, connectors and local orbits for SST animation.

Offline geometry only: no temperature or animal data influences connectivity.
--check verifies source/code hashes and every versioned connector/orbit against
the displayed 10m coastline and region polygons without rerunning path search.
"""
from __future__ import annotations

import argparse
import hashlib
import heapq
import json
import math
from pathlib import Path

from shapely import make_valid
from shapely.affinity import translate
from shapely.geometry import LineString, Point, box, shape
from shapely.ops import polylabel, unary_union
from shapely.prepared import prep

ROOT = Path(__file__).resolve().parents[2]
INPUTS = ['src/data/seaAreas.geojson', 'src/data/caspian.geojson', 'src/data/temperatureLand.geojson']
OUTPUT = ROOT/'src/data/temperatureRoutes.json'
MARGIN = 0.002  # Coastal clearance, approximately 200m in latitude.


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def provenance(root=ROOT):
    return {'inputs': {p: digest(root/p) for p in INPUTS},
            'codeSha256': digest(root/'python/ocean_pipeline/temperature_routes.py')}


def parts(geometry):
    if geometry.geom_type == 'Polygon':
        return [geometry]
    return [p for g in getattr(geometry, 'geoms', []) for p in parts(g)]


def distance(a, b):
    lat1, lat2 = math.radians(a[1]), math.radians(b[1])
    dlat, dlon = lat2-lat1, math.radians(b[0]-a[0])
    value = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 12742*math.asin(min(1, math.sqrt(value)))


def geometries(root=ROOT):
    features = json.loads((root/INPUTS[0]).read_text())['features']
    features.append(json.loads((root/INPUTS[1]).read_text()))
    areas = {f['properties']['id']: make_valid(shape(f['geometry'])) for f in features}
    land = unary_union([make_valid(shape(f['geometry'])) for f in json.loads((root/INPUTS[2]).read_text())['features']])
    clearance = land.buffer(MARGIN)
    water = {k: g.intersection(box(-180, -84, 180, 84)).difference(clearance) for k, g in areas.items()}
    return areas, land, water


def periodic(geometry, center):
    near = 360*round((center-geometry.representative_point().x)/360)
    return unary_union([translate(geometry, xoff=near+s) for s in (-360, 0, 360)])


def connector(water, a, b):
    """Visibility shortcut, then bounded A* on progressively finer water grids."""
    prepared = prep(water)
    def visible(p, q):
        return prepared.covers(LineString([p, q]))
    if visible(a, b):
        return [a, b]
    # Do not search disconnected water components (e.g. separate inland seas).
    component = next((g for g in parts(water) if g.covers(Point(a)) and g.covers(Point(b))), None)
    if component is None:
        return None
    prepared = prep(component)
    for step in (0.5, 0.15, 0.04):
        sea, edges = {}, {}
        def location(node):
            return (node[0]*step, node[1]*step)
        def at_sea(node):
            if node not in sea:
                sea[node] = prepared.covers(Point(location(node)))
            return sea[node]
        def edge_ok(p, q):
            key = tuple(sorted((p, q)))
            if key not in edges:
                edges[key] = visible(location(p), location(q))
            return edges[key]
        start = (round(a[0]/step), round(a[1]/step))
        seeds = [(start[0]+dx, start[1]+dy) for dx in range(-2, 3) for dy in range(-2, 3)]
        seeds = [n for n in seeds if at_sea(n) and visible(a, location(n))]
        seeds.sort(key=lambda n: distance(a, location(n)))
        costs, previous, closed, queue = {}, {}, set(), []
        for node in seeds[:6]:
            costs[node] = distance(a, location(node))
            heapq.heappush(queue, (costs[node]+distance(location(node), b), node))
        goal = None
        while queue and len(closed) < 18000:
            _, current = heapq.heappop(queue)
            if current in closed:
                continue
            position = location(current)
            if distance(position, b) < step*200 and visible(position, b):
                goal = current
                break
            closed.add(current)
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
                neighbor = (current[0]+dx, current[1]+dy)
                if neighbor in closed or not at_sea(neighbor) or not edge_ok(current, neighbor):
                    continue
                value = costs[current]+distance(position, location(neighbor))
                if value >= costs.get(neighbor, math.inf):
                    continue
                costs[neighbor], previous[neighbor] = value, current
                heapq.heappush(queue, (value+distance(location(neighbor), b), neighbor))
        if goal is None:
            continue
        nodes = [goal]
        while nodes[-1] in previous:
            nodes.append(previous[nodes[-1]])
        path = [a, *[location(n) for n in reversed(nodes)], b]
        short, index = [a], 0
        while index < len(path)-1:
            next_index = index+1
            for j in range(min(len(path)-1, index+30), index+1, -1):
                if visible(path[index], path[j]):
                    next_index = j
                    break
            short.append(path[next_index])
            index = next_index
        return short
    return None


def rounded_path(path):
    return [[round(x, 5), round(y, 5)] for x, y in path]


def resample(path):
    """Small angular steps keep Mercator rendering close to checked geometry."""
    result = [path[0]]
    for a, b in zip(path, path[1:]):
        pieces = max(1, math.ceil(max(abs(b[0]-a[0]), abs(b[1]-a[1]))/0.2-1e-9))
        result.extend([[a[0]+(b[0]-a[0])*i/pieces, a[1]+(b[1]-a[1])*i/pieces]
                       for i in range(1, pieces+1)])
    return rounded_path(result)


def build(root=ROOT):
    areas, _, water = geometries(root)
    nodes, anchors = [], {}
    for ident in sorted(areas):
        largest = max(parts(water[ident]), key=lambda g: g.area)
        point = polylabel(largest, tolerance=0.04)
        anchor = [round(point.x, 5), round(point.y, 5)]
        cosine = max(0.2, math.cos(math.radians(anchor[1])))
        # A three-turn expanding/shrinking orbit begins and ends at the anchor.
        for radius in (2.0, 1.4, 0.9, 0.5, 0.25, 0.1, 0.04, 0.01):
            orbit = rounded_path([(anchor[0]+radius*math.sin(math.pi*t)*math.cos(6*math.pi*t)/cosine,
                                   anchor[1]+radius*math.sin(math.pi*t)*math.sin(6*math.pi*t))
                                  for t in [i/96 for i in range(97)]])
            if largest.covers(LineString(orbit)):
                break
        else:
            raise ValueError(f'No safe orbit for {ident}')
        anchors[ident] = anchor
        nodes.append({'areaId': ident, 'anchor': anchor, 'orbit': orbit})
    links, candidates, failed = [], 0, []
    ids = sorted(areas)
    for i, source in enumerate(ids):
        if source == 'caspian':
            continue
        for target in ids[i+1:]:
            if target == 'caspian':
                continue
            # Neighbors touch/overlap; tolerate only small coastline-rounding gaps.
            if min(areas[source].distance(translate(areas[target], xoff=s)) for s in (-360, 0, 360)) > 0.025:
                continue
            candidates += 1
            a, b = anchors[source], anchors[target].copy()
            b[0] += 360*round((a[0]-b[0])/360)
            allowed = unary_union([periodic(water[source], a[0]), periodic(water[target], a[0])])
            path = connector(allowed, a, b)
            if path is None:
                failed.append([source, target])
                continue
            path = resample(rounded_path(path))
            if not allowed.covers(LineString(path)):
                raise ValueError(f'Rounded connector leaves water: {source} → {target}')
            length = sum(distance(p, q) for p, q in zip(path, path[1:]))
            links.append({'from': source, 'to': target, 'lengthKm': round(length, 3), 'path': path})
            print(source, '↔', target, round(length), 'km', flush=True)
    return {'schemaVersion': 1, 'provenance': provenance(root), 'neighborToleranceDeg': 0.025,
            'coastClearanceDeg': MARGIN, 'candidatePairs': candidates,
            'unroutablePairs': failed, 'nodes': nodes, 'links': links}


def verify(snapshot, root=ROOT):
    if snapshot['provenance'] != provenance(root):
        raise ValueError('Temperature-route sources/code changed; regenerate geometry')
    areas, land, _ = geometries(root)
    land_check = prep(land)
    wrapped_land = prep(unary_union([translate(land, xoff=s) for s in (-720, -360, 0, 360, 720)]))
    anchors = {n['areaId']: n['anchor'] for n in snapshot['nodes']}
    if len(anchors) != len(snapshot['nodes']) or set(anchors) != set(areas):
        raise ValueError('Every historical region must have one route anchor')
    seen = set()
    for node in snapshot['nodes']:
        orbit = LineString(node['orbit'])
        if node['orbit'][0] != node['anchor'] or node['orbit'][-1] != node['anchor']:
            raise ValueError('Orbit must join continuously at its anchor')
        if not areas[node['areaId']].covers(orbit) or land_check.intersects(orbit):
            raise ValueError(f'Local orbit crosses land/region: {node["areaId"]}')
    for link in snapshot['links']:
        a, b = link['from'], link['to']
        pair = tuple(sorted((a, b)))
        if 'caspian' in pair or a == b or pair in seen:
            raise ValueError('Duplicate, self or inland-marine route')
        seen.add(pair)
        center = anchors[a][0]
        allowed = unary_union([periodic(areas[a], center), periodic(areas[b], center)])
        path = LineString(link['path'])
        if any(max(abs(p[0]-q[0]), abs(p[1]-q[1])) > 0.20002 for p, q in zip(link['path'], link['path'][1:])):
            raise ValueError('Connector is too sparse for the rendered projection')
        if not allowed.covers(path) or wrapped_land.intersects(path):
            raise ValueError(f'Connector crosses land or another region: {a} → {b}')
        if distance(link['path'][0], anchors[a]) > 0.002 or distance(link['path'][-1], anchors[b]) > 0.002:
            raise ValueError('Connector does not join its anchors')
        length = sum(distance(p, q) for p, q in zip(link['path'], link['path'][1:]))
        if abs(length-link['lengthKm']) > 0.002:
            raise ValueError('Incorrect water-route distance')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    snapshot = json.loads(OUTPUT.read_text()) if args.check else build()
    verify(snapshot)
    if not args.check:
        OUTPUT.write_text(json.dumps(snapshot, separators=(',', ':'))+'\n')
    print(f'Verified {len(snapshot["nodes"])} local orbits and {len(snapshot["links"])} water-only neighbor routes')


if __name__ == '__main__':
    main()
