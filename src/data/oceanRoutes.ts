import { feature } from 'topojson-client';
import world from 'world-atlas/land-110m.json';

export type Position = [number, number];
type Ring = { points: Position[]; west: number; east: number; south: number; north: number; center: number };
type Polygon = { outer: Ring; holes: Ring[] };

const topology = world as unknown as Parameters<typeof feature>[0];
const land = feature(topology, topology.objects.land) as unknown as {
  features: { geometry: { coordinates: Position[][][] } }[]
};

function longitudeDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

function makeRing(raw: Position[]): Ring {
  const points: Position[] = raw.map(([lon, lat], index) => [
    index === 0 ? lon : 0, lat
  ]);
  for (let i = 1; i < raw.length; i++) {
    points[i][0] = points[i - 1][0] + longitudeDelta(raw[i - 1][0], raw[i][0]);
  }
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  const west = Math.min(...xs);
  const east = Math.max(...xs);
  return { points, west, east, south: Math.min(...ys), north: Math.max(...ys), center: (west + east) / 2 };
}

const polygons: Polygon[] = land.features.flatMap(item =>
  item.geometry.coordinates.map(rings => ({ outer: makeRing(rings[0]), holes: rings.slice(1).map(makeRing) }))
);
const rings = polygons.flatMap(polygon => [polygon.outer, ...polygon.holes]);

function ringContains(ring: Ring, [lon, lat]: Position): boolean {
  if (lat < ring.south || lat > ring.north) return false;
  const x = lon + 360 * Math.round((ring.center - lon) / 360);
  if (x < ring.west || x > ring.east) return false;
  let inside = false;
  const points = ring.points;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > lat) !== (yj > lat) && x < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function isOcean(point: Position): boolean {
  return !polygons.some(polygon => ringContains(polygon.outer, point) &&
    !polygon.holes.some(hole => ringContains(hole, point)));
}

function orientation(a: Position, b: Position, c: Position): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function touches(a: Position, b: Position, c: Position, d: Position): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if ((abC > 0 && abD > 0) || (abC < 0 && abD < 0) ||
      (cdA > 0 && cdB > 0) || (cdA < 0 && cdB < 0)) return false;
  const epsilon = 1e-9;
  return Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <=
      Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) + epsilon &&
    Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <=
      Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1])) + epsilon;
}

// Test the actual rendered land boundaries, including islands. A water grid
// vertex alone is insufficient: its edge could still cut across a coastline.
export function waterSegment(from: Position, to: Position): boolean {
  if (!isOcean(from) || !isOcean(to)) return false;
  const end: Position = [from[0] + longitudeDelta(from[0], to[0]), to[1]];
  const west = Math.min(from[0], end[0]);
  const east = Math.max(from[0], end[0]);
  const south = Math.min(from[1], end[1]);
  const north = Math.max(from[1], end[1]);
  for (const ring of rings) {
    const center = (west + east) / 2;
    const nearest = Math.round((center - ring.center) / 360) * 360;
    for (const shift of [nearest - 360, nearest, nearest + 360]) {
      if (east < ring.west + shift || west > ring.east + shift ||
          north < ring.south || south > ring.north) continue;
      for (let i = 1; i < ring.points.length; i++) {
        const a = ring.points[i - 1];
        const b = ring.points[i];
        if (touches(from, end, [a[0] + shift, a[1]], [b[0] + shift, b[1]])) return false;
      }
    }
  }
  return true;
}

const step = 0.5;
const columns = 720;
const rows = 321;
const seaCache = new Map<number, boolean>();
const edgeCache = new Map<string, boolean>();
const neighbors: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

function node(x: number, y: number): number { return y * columns + ((x % columns) + columns) % columns; }
function location(id: number): Position { return [-180 + (id % columns) * step, -80 + Math.floor(id / columns) * step]; }
function atSea(id: number): boolean {
  if (!seaCache.has(id)) seaCache.set(id, isOcean(location(id)));
  return seaCache.get(id)!;
}
function edgeAtSea(a: number, b: number): boolean {
  const key = a < b ? `${a}:${b}` : `${b}:${a}`;
  if (!edgeCache.has(key)) edgeCache.set(key, waterSegment(location(a), location(b)));
  return edgeCache.get(key)!;
}

function distance(a: Position, b: Position): number {
  const radians = Math.PI / 180;
  const latitudeA = a[1] * radians;
  const latitudeB = b[1] * radians;
  const deltaLat = (b[1] - a[1]) * radians;
  const deltaLon = longitudeDelta(a[0], b[0]) * radians;
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLon / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(value)));
}

type HeapItem = { id: number; score: number };
class MinHeap {
  private data: HeapItem[] = [];
  get length() { return this.data.length; }
  push(item: HeapItem) {
    const data = this.data;
    let index = data.length;
    data.push(item);
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (data[parent].score <= item.score) break;
      data[index] = data[parent];
      index = parent;
    }
    data[index] = item;
  }
  pop(): HeapItem | undefined {
    const data = this.data;
    const top = data[0];
    const last = data.pop();
    if (!top || !last || data.length === 0) return top;
    let index = 0;
    while (index * 2 + 1 < data.length) {
      let child = index * 2 + 1;
      if (child + 1 < data.length && data[child + 1].score < data[child].score) child++;
      if (last.score <= data[child].score) break;
      data[index] = data[child];
      index = child;
    }
    data[index] = last;
    return top;
  }
}

function densify(points: Position[]): Position[] {
  const result: Position[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const from = result[result.length - 1];
    const to = points[i];
    const longitude = longitudeDelta(from[0], to[0]);
    const pieces = Math.max(1, Math.ceil(Math.hypot(longitude * Math.cos(from[1] * Math.PI / 180), to[1] - from[1]) / 0.3));
    for (let j = 1; j <= pieces; j++) {
      result.push([from[0] + longitude * j / pieces, from[1] + (to[1] - from[1]) * j / pieces]);
    }
  }
  return result;
}

// Approximate shortest water path on a half-degree grid. Never fall back to a
// straight land-crossing connector when the endpoints cannot be routed.
export function oceanRoute(from: Position, to: Position): Position[] | null {
  if (!isOcean(from) || !isOcean(to) || Math.abs(from[1]) > 79 || Math.abs(to[1]) > 79) return null;
  if (waterSegment(from, to)) return densify([from, to]);

  const open = new MinHeap();
  const costs = new Map<number, number>();
  const previous = new Map<number, number>();
  const closed = new Set<number>();
  const x = Math.round((from[0] + 180) / step);
  const y = Math.round((from[1] + 80) / step);
  const seeds: number[] = [];
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    if (y + dy < 0 || y + dy >= rows) continue;
    const id = node(x + dx, y + dy);
    if (atSea(id) && waterSegment(from, location(id))) seeds.push(id);
  }
  seeds.sort((a, b) => distance(from, location(a)) - distance(from, location(b)));
  for (const id of seeds.slice(0, 8)) {
    const cost = distance(from, location(id));
    costs.set(id, cost);
    open.push({ id, score: cost + distance(location(id), to) });
  }

  let goal: number | null = null;
  while (open.length && closed.size < 30000) {
    const current = open.pop()!.id;
    if (closed.has(current)) continue;
    const position = location(current);
    if (distance(position, to) < 0.04 && waterSegment(position, to)) {
      goal = current;
      break;
    }
    closed.add(current);
    const cx = current % columns;
    const cy = Math.floor(current / columns);
    for (const [dx, dy] of neighbors) {
      if (cy + dy < 0 || cy + dy >= rows) continue;
      const next = node(cx + dx, cy + dy);
      if (closed.has(next) || !atSea(next) || !edgeAtSea(current, next)) continue;
      const candidate = costs.get(current)! + distance(position, location(next));
      if (candidate >= (costs.get(next) ?? Infinity)) continue;
      costs.set(next, candidate);
      previous.set(next, current);
      open.push({ id: next, score: candidate + distance(location(next), to) });
    }
  }
  if (goal === null) return null;
  const ids: number[] = [];
  for (let current: number | undefined = goal; current !== undefined; current = previous.get(current)) ids.push(current);
  ids.reverse();
  const points: Position[] = [from, ...ids.map(location), to];
  const shorter: Position[] = [from];
  for (let i = 0; i < points.length - 1;) {
    let next = i + 1;
    for (let j = Math.min(points.length - 1, i + 16); j > next; j--) {
      if (waterSegment(points[i], points[j])) { next = j; break; }
    }
    shorter.push(points[next]);
    i = next;
  }
  return densify(shorter);
}

function staysAtSea(path: Position[]): boolean {
  for (let i = 1; i < path.length; i++) {
    if (!waterSegment(path[i - 1], path[i])) return false;
  }
  return true;
}

// Add a modest visual arc after finding the short water route. Test the whole
// displaced path, shrinking or reversing the bend near a coast. This is an
// illustration, so the curved result can be longer than the shortest route.
export function curveOceanRoute(path: Position[], variation: number): Position[] {
  if (path.length < 3) return path;
  const first = path[0];
  const last = path[path.length - 1];
  const latitude = (first[1] + last[1]) * Math.PI / 360;
  const cosLatitude = Math.max(0.2, Math.cos(latitude));
  const dx = longitudeDelta(first[0], last[0]) * cosLatitude;
  const dy = last[1] - first[1];
  const length = Math.hypot(dx, dy);
  if (length < 0.2) return path;
  const amplitude = Math.min(3, length * 0.22);
  const preferred = variation % 2 === 0 ? 1 : -1;

  for (const factor of [1, 0.7, 0.45, 0.25, 0.1]) {
    for (const side of [preferred, -preferred]) {
      const candidate = path.map(([lon, lat], index): Position => {
        if (index === 0 || index === path.length - 1) return path[index];
        const t = index / (path.length - 1);
        const offset = side * amplitude * factor * Math.sin(Math.PI * t) *
          (1 + 0.14 * Math.sin(2 * Math.PI * t + variation * 1.7));
        return [lon - dy / length * offset / cosLatitude, lat + dx / length * offset];
      });
      if (staysAtSea(candidate)) return candidate;
    }
  }
  return path;
}
