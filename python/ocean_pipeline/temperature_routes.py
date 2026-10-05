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
from shapely.affinity import translate, scale
from shapely.geometry import LineString, Point, box, shape
from shapely.ops import polylabel, unary_union, nearest_points
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


def base_geometry(root=ROOT):
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


def orbit_at(anchor, water):
    cosine = max(0.2, math.cos(math.radians(anchor[1])))
    for radius in (2, 1.4, .9, .5, .25, .1, .04, .01, .002, .0005):
        orbit = rounded_path([(anchor[0]+radius*math.sin(math.pi*t)*math.cos(6*math.pi*t)/cosine,
                               anchor[1]+radius*math.sin(math.pi*t)*math.sin(6*math.pi*t))
                              for t in [i/96 for i in range(97)]])
        if water.covers(LineString(orbit)):
            return orbit
    raise ValueError(f'No safe local orbit at {anchor}')


def distributed_points(water, anchor, count):
    """Spread emitters across open water, with safe access to the base route."""
    prepared = prep(water)
    interior = prep(water.buffer(-.005))
    west, south, east, north = water.bounds
    candidates = []
    for i in range(32):
        for j in range(32):
            point = [round(west+(east-west)*(i+.5)/32, 5), round(south+(north-south)*(j+.5)/32, 5)]
            if interior.covers(Point(point)) and prepared.covers(LineString([point, anchor])):
                candidates.append(point)
    # Narrow polygons still receive distinct origins near their interior point.
    for radius in (.1, .01, .001):
        for i in range(24):
            point = [round(anchor[0]+radius*math.cos(i*math.pi/12), 5),
                     round(anchor[1]+radius*math.sin(i*math.pi/12), 5)]
            if interior.covers(Point(point)) and prepared.covers(LineString([point, anchor])):
                candidates.append(point)
    unique = list({tuple(p): p for p in candidates}.values())
    if len(unique) < count:
        raise ValueError('Not enough distributed water origins')
    selected = [max(unique, key=lambda p: distance(p, anchor))]
    for _ in range(count-1):
        selected.append(max(unique, key=lambda p: min(distance(p, q) for q in selected)))
    return selected


def curved_path(path, allowed, variation):
    """Same sinusoidal bend as curveOceanRoute, checked against the 10m coast."""
    # Remove unnecessary interior routing waypoints before adding the visual
    # arc, so distributed origins do not fan back through a regional center.
    prepared = prep(allowed)
    def collapse(first, last):
        if last <= first+1 or prepared.covers(LineString([path[first], path[last]])):
            return [path[first], path[last]]
        middle = (first+last)//2
        return collapse(first, middle)[:-1]+collapse(middle, last)
    path = collapse(0, len(path)-1)
    short, index = [path[0]], 0
    while index < len(path)-1:
        next_index = index+1
        for j in range(len(path)-1, index, -1):
            if prepared.covers(LineString([path[index], path[j]])):
                next_index = j
                break
        short.append(path[next_index])
        index = next_index
    path = short
    path = resample(path)
    # Ocean-scale routes use the same local arc scale as the animal examples,
    # whose demonstration offsets are 12 degrees, instead of a huge straight fan.
    sections, section, span = [], [path[0]], 0
    for point in path[1:]:
        step = math.hypot(point[0]-section[-1][0], point[1]-section[-1][1])
        if span+step > 12 and len(section) > 1:
            sections.append(section)
            section, span = [section[-1]], 0
        section.append(point)
        span += step
    sections.append(section)
    result = []
    for i, section in enumerate(sections):
        curve = curve_section(section, allowed, variation+i)
        result.extend(curve if i == 0 else curve[1:])
    return compact_path(result, allowed)


def curve_section(path, allowed, variation):
    first, last = path[0], path[-1]
    cosine = max(.2, math.cos(math.radians((first[1]+last[1])/2)))
    dx, dy = (last[0]-first[0])*cosine, last[1]-first[1]
    length = math.hypot(dx, dy)
    if length < .2:
        return compact_path(path, allowed)
    prepared = prep(allowed)
    amplitude = min(3, length*.22)
    preferred = 1 if variation % 2 == 0 else -1
    for factor in (1, .7, .45, .25, .1):
        for side in (preferred, -preferred):
            candidate = []
            for i, (lon, lat) in enumerate(path):
                t = i/(len(path)-1)
                offset = side*amplitude*factor*math.sin(math.pi*t)*(1+.14*math.sin(2*math.pi*t+variation*1.7))
                candidate.append([lon-dy/length*offset/cosine, lat+dx/length*offset])
            candidate[0], candidate[-1] = first, last
            candidate = resample(rounded_path(candidate))
            if prepared.covers(LineString(candidate)):
                return compact_path(candidate, allowed)
    # Smooth coastal corners conservatively when a wider bend is unavailable.
    for _ in range(2):
        candidate = [path[0]]
        for a, b in zip(path, path[1:]):
            candidate.extend([[.75*a[0]+.25*b[0], .75*a[1]+.25*b[1]],
                              [.25*a[0]+.75*b[0], .25*a[1]+.75*b[1]]])
        candidate.append(path[-1])
        candidate = resample(candidate)
        if prepared.covers(LineString(candidate)):
            path = candidate
    return compact_path(path, allowed)


def compact_path(path, allowed):
    """Version control points; the renderer reconstructs <=0.2° vertices."""
    prepared = prep(allowed)
    for tolerance in (.02, .01, .005, .001):
        candidate = rounded_path(LineString(path).simplify(tolerance).coords)
        if prepared.covers(LineString(resample(candidate))):
            return candidate
    return path


def proximity(point, target):
    # Local longitude scaling approximates the closest boundary geographically.
    # Haversine reports distance to that boundary point, never to a sea's center.
    cosine = max(.2, math.cos(math.radians(point[1])))
    projected = scale(target, xfact=cosine, yfact=1, origin=(0, 0))
    _, near = nearest_points(Point(point[0]*cosine, point[1]), projected)
    return distance(point, [near.x/cosine, near.y])


def build(root=ROOT, base=None):
    base = base if base is not None else base_geometry(root)
    _, _, water = geometries(root)
    anchors = {n['areaId']: n['anchor'] for n in base['nodes']}
    nodes, points = [], {}
    for area in sorted(water):
        largest = max(parts(water[area]), key=lambda g: g.area)
        count = 12 if largest.area > 1000 else 6
        seeds = distributed_points(largest, anchors[area], count)
        points[area] = []
        for i, position in enumerate(seeds):
            node = {'id': f'{area}:{i}', 'areaId': area, 'position': position,
                    'orbit': orbit_at(position, largest)}
            nodes.append(node)
            points[area].append(node)
    links = []
    periodic_water = {area: periodic(g, 0) for area, g in water.items()}
    for pair in base['links']:
        allowed = unary_union([periodic_water[pair['from']], periodic_water[pair['to']]])
        prepared = prep(allowed)
        for source, target, route in ((pair['from'], pair['to'], pair['path']),
                                      (pair['to'], pair['from'], list(reversed(pair['path'])))):
            for origin in points[source]:
                a = origin['position']
                def shifted(point):
                    return [point[0]+360*round((a[0]-point[0])/360), point[1]]
                destination = min(points[target], key=lambda p: distance(a, p['position']))
                b = shifted(destination['position'])
                target_water = periodic_water[target]
                if prepared.covers(LineString([a, b])):
                    path = [a, b]
                else:
                    # The base route joins only these two touching regions.
                    offset = 360*round((a[0]-route[0][0])/360)
                    path = [a, *[[lon+offset, lat] for lon, lat in route], b]
                    # Periodic destination must align with the last base vertex.
                    path[-1][0] += 360*round((path[-2][0]-path[-1][0])/360)
                path = curved_path(path, allowed, len(links))
                if not prepared.covers(LineString(path)):
                    raise ValueError(f'Distributed path leaves water: {origin["id"]} → {destination["id"]}')
                links.append({'from': origin['id'], 'to': destination['id'],
                              'proximityKm': round(proximity(a, target_water), 3), 'path': path})
        print('Distributed', pair['from'], '↔', pair['to'], flush=True)
    return {'schemaVersion': 2, 'provenance': provenance(root), 'neighborToleranceDeg': .025,
            'coastClearanceDeg': MARGIN, 'candidatePairs': base['candidatePairs'],
            'unroutablePairs': base['unroutablePairs'], 'neighborPairs': [[l['from'], l['to']] for l in base['links']],
            'nodes': nodes, 'links': links}


def verify(snapshot, root=ROOT):
    if snapshot['provenance'] != provenance(root):
        raise ValueError('Temperature-route sources/code changed; regenerate geometry')
    areas, land, water = geometries(root)
    wrapped_land = prep(unary_union([translate(land, xoff=s) for s in (-720, -360, 0, 360, 720)]))
    nodes = {n['id']: n for n in snapshot['nodes']}
    if len(nodes) != len(snapshot['nodes']) or {n['areaId'] for n in nodes.values()} != set(areas):
        raise ValueError('Every historical region must have distributed emitters')
    for area in areas:
        positions = {tuple(n['position']) for n in nodes.values() if n['areaId'] == area}
        if len(positions) < 6:
            raise ValueError('Origins must be distinct and distributed')
    for node in nodes.values():
        orbit = LineString(node['orbit'])
        if node['orbit'][0] != node['position'] or node['orbit'][-1] != node['position']:
            raise ValueError('Orbit must join continuously at its emitter')
        if not water[node['areaId']].covers(orbit):
            raise ValueError('Local orbit crosses land/region')
    pairs = {tuple(sorted(pair)) for pair in snapshot['neighborPairs']}
    for a, b in pairs:
        if 'caspian' in (a, b) or a == b or min(areas[a].distance(translate(areas[b], xoff=s)) for s in (-360, 0, 360)) > .025:
            raise ValueError('Cooling link must join touching marine regions')
    periodic_water = {area: periodic(g, 0) for area, g in water.items()}
    allowed_key, allowed = None, None
    seen = set()
    for link in snapshot['links']:
        source, target = nodes[link['from']], nodes[link['to']]
        a, b = source['areaId'], target['areaId']
        if (link['from'], b) in seen or tuple(sorted((a, b))) not in pairs:
            raise ValueError('Duplicate or non-neighbor cooling choice')
        seen.add((link['from'], b))
        key = tuple(sorted((a, b)))
        if key != allowed_key:
            allowed = prep(unary_union([periodic_water[a], periodic_water[b]]))
            allowed_key = key
        path = LineString(resample(link['path']))
        if not allowed.covers(path) or wrapped_land.intersects(path):
            raise ValueError(f'Connector crosses land or a non-neighbor: {a} → {b}')
        if distance(link['path'][0], source['position']) > .002 or distance(link['path'][-1], target['position']) > .002:
            raise ValueError('Incorrect route endpoints')
        if abs(link['proximityKm']-proximity(source['position'], periodic_water[b])) > .002:
            raise ValueError('Incorrect neighbor proximity')
    for node in nodes.values():
        expected = {b if a == node['areaId'] else a for a, b in pairs if node['areaId'] in (a, b)}
        actual = {nodes[l['to']]['areaId'] for l in snapshot['links'] if l['from'] == node['id']}
        if actual != expected:
            raise ValueError('An emitter is missing a routable neighboring region')


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
