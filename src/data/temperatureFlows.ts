import geometryRaw from './temperatureRoutes.json?raw';
import { FLOW_CYCLE_SECONDS, FLOW_SPAN_DEGREES, growingFlowFrame, type FlowSegment } from './flowAnimation';
import type { DisplayFlow } from './flowAnimation';

export type Position = [number, number];
export type CoolingNode = { id: string; areaId: string; position: Position; orbit: Position[] };
export type CoolingNetwork = {
  nodes: CoolingNode[];
  links: { from: string; to: string; proximityKm: number; path: Position[] }[];
};
// Reconstruct dense render vertices from the compact offline control points.
// Raw import prevents TypeScript from inferring a giant tuple type for geometry.
function renderPath(path: Position[]): Position[] {
  const result: Position[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const a = path[i-1], b = path[i];
    const pieces = Math.max(1, Math.ceil(Math.max(Math.abs(b[0]-a[0]), Math.abs(b[1]-a[1]))/.2-1e-9));
    for (let j = 1; j <= pieces; j++) result.push([
      Math.round((a[0]+(b[0]-a[0])*j/pieces)*1e5)/1e5,
      Math.round((a[1]+(b[1]-a[1])*j/pieces)*1e5)/1e5
    ]);
  }
  return result;
}
const compact = JSON.parse(geometryRaw) as CoolingNetwork;
export const temperatureNetwork: CoolingNetwork = {
  nodes: compact.nodes, links: compact.links.map(l => ({ ...l, path: renderPath(l.path) }))
};
type Values = ReadonlyMap<string, { celsius: number }>;
export type CoolingFlow = {
  id: string; sourceArea: string; areas: string[]; legs: DisplayFlow[];
  travelDuration: number; orbitDuration: number; duration: number; phase: number;
};
export type CoolingFrame = {
  path: Position[]; segments: FlowSegment[]; alpha: number;
  stage: 'travel' | 'circling' | 'waiting';
};

export function geographicDistance(a: Position, b: Position): number {
  const radians = Math.PI / 180;
  const value = Math.sin((b[1]-a[1])*radians/2)**2 + Math.cos(a[1]*radians)*Math.cos(b[1]*radians)*Math.sin((b[0]-a[0])*radians/2)**2;
  return 12742*Math.asin(Math.min(1, Math.sqrt(value)));
}

function indexNetwork(network: CoolingNetwork) {
  const nodes = new Map(network.nodes.map(n => [n.id, n]));
  const links = new Map<string, CoolingNetwork['links']>();
  for (const link of network.links) {
    const choices = links.get(link.from) ?? [];
    choices.push(link);
    links.set(link.from, choices);
  }
  return { nodes, links };
}

function descend(start: string, values: Values, network: ReturnType<typeof indexNetwork>) {
  const origin = network.nodes.get(start);
  if (!origin || !Number.isFinite(values.get(origin.areaId)?.celsius)) return { areas: [], legs: [], terminal: undefined };
  const areas = [origin.areaId];
  const legs: DisplayFlow[] = [];
  let current = origin;
  while (true) {
    const temperature = values.get(current.areaId)!.celsius;
    // Only directly touching regions: never route through a warmer intermediary.
    const choice = (network.links.get(current.id) ?? [])
      .filter(l => {
        const area = network.nodes.get(l.to)!.areaId;
        return Number.isFinite(values.get(area)?.celsius) && values.get(area)!.celsius < temperature-1e-6;
      })
      .sort((a, b) => a.proximityKm-b.proximityKm || a.to.localeCompare(b.to))[0];
    if (!choice) break;
    legs.push({ id: `${start}:${legs.length}`, from: choice.path[0], to: choice.path.at(-1)!, path: choice.path });
    current = network.nodes.get(choice.to)!;
    areas.push(current.areaId);
  }
  return { areas, legs, terminal: current };
}

// Starts and arrivals are distributed water points, never regional centers.
export function coolingChain(start: string, values: Values, network = temperatureNetwork): string[] {
  return descend(start, values, indexNetwork(network)).areas;
}

function visualSections(flow: DisplayFlow): DisplayFlow[] {
  const sections: DisplayFlow[] = [];
  let path = [flow.path[0]], span = 0;
  for (const point of flow.path.slice(1)) {
    const previous = path.at(-1)!;
    const step = Math.hypot(point[0]-previous[0], point[1]-previous[1]);
    if (span+step > FLOW_SPAN_DEGREES && path.length > 1) {
      sections.push({ id: `${flow.id}:${sections.length}`, from: path[0], to: previous, path });
      path = [previous]; span = 0;
    }
    path.push(point); span += step;
  }
  sections.push({ id: `${flow.id}:${sections.length}`, from: path[0], to: path.at(-1)!, path });
  return sections;
}

export function temperatureFlows(values: Values, network = temperatureNetwork): CoolingFlow[] {
  const indexed = indexNetwork(network);
  return network.nodes.flatMap((node, index) => {
    const { areas, legs, terminal } = descend(node.id, values, indexed);
    if (!terminal) return [];
    const sections = legs.flatMap(visualSections);
    const travelDuration = sections.length*FLOW_CYCLE_SECONDS;
    const orbitDuration = FLOW_CYCLE_SECONDS;
    const duration = travelDuration+orbitDuration+1.4;
    const orbit: DisplayFlow = { id: `${node.id}:orbit`, from: terminal.position,
      to: terminal.position, path: terminal.orbit };
    return [{ id: node.id, sourceArea: node.areaId, areas, legs: [...sections, orbit],
      travelDuration, orbitDuration, duration, phase: ((index*.618034)%1)*FLOW_CYCLE_SECONDS }];
  });
}

export function coolingFlowFrame(flow: CoolingFlow, seconds: number, stagger = true): CoolingFrame {
  const time = ((seconds+(stagger ? flow.phase : 0))%flow.duration+flow.duration)%flow.duration;
  const finish = flow.travelDuration+flow.orbitDuration;
  if (time >= finish) return { path: [], segments: [], alpha: 0, stage: 'waiting' };
  const leg = Math.min(flow.legs.length-1, Math.floor(time/FLOW_CYCLE_SECONDS));
  const progress = (time-leg*FLOW_CYCLE_SECONDS)/FLOW_CYCLE_SECONDS;
  const circling = time >= flow.travelDuration;
  const alpha = circling ? Math.max(0, 1-Math.max(0, (progress-.8)/.2)) : 1;
  return { ...growingFlowFrame(flow.legs[leg], progress, alpha), alpha, stage: circling ? 'circling' : 'travel' };
}

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
