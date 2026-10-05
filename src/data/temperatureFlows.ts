import geometry from './temperatureRoutes.json';

export type Position = [number, number];
export type CoolingNetwork = {
  nodes: { areaId: string; anchor: Position; orbit: Position[] }[];
  links: { from: string; to: string; lengthKm: number; path: Position[] }[];
};
export const temperatureNetwork = geometry as unknown as CoolingNetwork;
type Values = ReadonlyMap<string, { celsius: number }>;
export type CoolingFlow = {
  id: string; areas: string[]; path: Position[]; times: number[];
  travelDuration: number; orbitDuration: number; duration: number; phase: number;
};
export type CoolingFrame = { path: Position[]; head?: Position; alpha: number; stage: 'travel' | 'circling' | 'waiting' };

const radians = Math.PI / 180;
export function geographicDistance(a: Position, b: Position): number {
  const value = Math.sin((b[1]-a[1])*radians/2)**2 + Math.cos(a[1]*radians)*Math.cos(b[1]*radians)*Math.sin((b[0]-a[0])*radians/2)**2;
  return 12742*Math.asin(Math.min(1, Math.sqrt(value)));
}

function adjacency(network: CoolingNetwork) {
  const links = new Map<string, { area: string; length: number; path: Position[] }[]>();
  for (const edge of network.links) {
    for (const [from, to, path] of [[edge.from, edge.to, edge.path], [edge.to, edge.from, [...edge.path].reverse()]] as [string, string, Position[]][]) {
      const neighbors = links.get(from) ?? [];
      neighbors.push({ area: to, length: edge.lengthKm, path });
      links.set(from, neighbors);
    }
  }
  return links;
}

function nearestCooler(start: string, values: Values, neighbors: ReturnType<typeof adjacency>, positions: ReadonlyMap<string, Position>): string[] | null {
  const temperature = values.get(start)!.celsius;
  const costs = new Map([[start, 0]]);
  const previous = new Map<string, string>();
  const closed = new Set<string>();
  const queue: { area: string; cost: number }[] = [{ area: start, cost: 0 }];
  while (queue.length) {
    queue.sort((a, b) => b.cost-a.cost || b.area.localeCompare(a.area));
    const current = queue.pop()!;
    if (closed.has(current.area)) continue;
    closed.add(current.area);
    for (const edge of neighbors.get(current.area) ?? []) {
      const cost = current.cost+edge.length;
      if (closed.has(edge.area) || cost >= (costs.get(edge.area) ?? Infinity)) continue;
      costs.set(edge.area, cost);
      previous.set(edge.area, current.area);
      queue.push({ area: edge.area, cost });
    }
  }
  const origin = positions.get(start)!;
  const destination = [...closed].filter(area => Number.isFinite(values.get(area)?.celsius) && values.get(area)!.celsius < temperature-1e-6)
    .sort((a, b) => geographicDistance(origin, positions.get(a)!)-geographicDistance(origin, positions.get(b)!) || a.localeCompare(b))[0];
  if (!destination) return null;
  const route = [destination];
  while (previous.has(route.at(-1)!)) route.push(previous.get(route.at(-1)!)!);
  return route.reverse();
}

function descend(start: string, values: Values, neighbors: ReturnType<typeof adjacency>, positions: ReadonlyMap<string, Position>) {
  if (!positions.has(start) || !Number.isFinite(values.get(start)?.celsius)) return { stops: [], navigation: [] };
  const stops = [start], navigation = [start];
  while (true) {
    const next = nearestCooler(stops.at(-1)!, values, neighbors, positions);
    if (!next) break;
    stops.push(next.at(-1)!);
    navigation.push(...next.slice(1));
  }
  return { stops, navigation };
}

// Measure geographic proximity from the particle's current position.
// Choose the nearest cooler reachable sea, then route it over water.
// Intermediate seas are navigation only; cooler stops strictly decrease.
export function coolingChain(start: string, values: Values, network = temperatureNetwork): string[] {
  return descend(start, values, adjacency(network), new Map(network.nodes.map(n => [n.areaId, n.anchor]))).stops;
}

export function temperatureFlows(values: Values, network = temperatureNetwork): CoolingFlow[] {
  const neighbors = adjacency(network);
  const nodes = new Map(network.nodes.map(node => [node.areaId, node]));
  const positions = new Map(network.nodes.map(node => [node.areaId, node.anchor]));
  return network.nodes.flatMap((node, index) => {
    const { stops: areas, navigation } = descend(node.areaId, values, neighbors, positions);
    if (!areas.length) return [];
    const path: Position[] = [node.anchor];
    for (let leg = 1; leg < navigation.length; leg++) {
      const edge = neighbors.get(navigation[leg-1])!.find(e => e.area === navigation[leg])!;
      const shift = 360*Math.round((path.at(-1)![0]-edge.path[0][0])/360);
      path.push(...edge.path.slice(1).map(([lon, lat]): Position => [lon+shift, lat]));
    }
    const distances = [0];
    for (let i = 1; i < path.length; i++) distances.push(distances[i-1]+geographicDistance(path[i-1], path[i]));
    const length = distances.at(-1)!;
    const travelDuration = length === 0 ? 0 : Math.max(5, Math.min(24, length/700));
    const times = distances.map(d => length ? d/length*travelDuration : 0);
    const terminal = nodes.get(areas.at(-1)!)!;
    const shift = 360*Math.round((path.at(-1)![0]-terminal.anchor[0])/360);
    const orbitDuration = 5.5;
    terminal.orbit.slice(1).forEach(([lon, lat], i) => {
      path.push([lon+shift, lat]);
      times.push(travelDuration+orbitDuration*(i+1)/(terminal.orbit.length-1));
    });
    const duration = travelDuration+orbitDuration+1.4;
    return [{ id: node.areaId, areas, path, times, travelDuration, orbitDuration, duration,
      phase: ((index*0.618034)%1)*duration }];
  });
}

function pointAt(flow: CoolingFlow, time: number): Position {
  const after = flow.times.findIndex(t => t >= time);
  if (after < 0) return flow.path.at(-1)!;
  if (after === 0) return flow.path[0];
  const before = after-1;
  const fraction = (time-flow.times[before])/Math.max(1e-9, flow.times[after]-flow.times[before]);
  return [flow.path[before][0]+fraction*(flow.path[after][0]-flow.path[before][0]),
    flow.path[before][1]+fraction*(flow.path[after][1]-flow.path[before][1])];
}

// Bounded moving tail; the entire trace fades during the final local orbit.
// A blank interval follows before a new illustrative particle is emitted.
export function coolingFlowFrame(flow: CoolingFlow, seconds: number, stagger = true): CoolingFrame {
  const time = ((seconds+(stagger ? flow.phase : 0))%flow.duration+flow.duration)%flow.duration;
  const finish = flow.travelDuration+flow.orbitDuration;
  if (time >= finish) return { path: [], alpha: 0, stage: 'waiting' };
  const start = Math.max(0, time-2.4);
  const orbitProgress = Math.max(0, (time-flow.travelDuration)/flow.orbitDuration);
  const alpha = Math.min(1, time/0.4)*Math.max(0, 1-Math.max(0, (orbitProgress-0.6)/0.4));
  const head = pointAt(flow, time);
  const path = [pointAt(flow, start), ...flow.path.filter((_, i) => flow.times[i] > start && flow.times[i] < time), head];
  return { path, head, alpha, stage: time < flow.travelDuration ? 'travel' : 'circling' };
}

// Split the SVG fallback at ±180°, rather than drawing across the whole map.
export function coolingSvgPath(path: Position[]): string {
  let previous: number | undefined;
  return path.map(([lon, lat]) => {
    const x = (((lon+180)%360+360)%360)/360*1200;
    const y = (90-lat)/180*600;
    const move = previous === undefined || Math.abs(x-previous) > 600;
    previous = x;
    return `${move ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join('');
}
