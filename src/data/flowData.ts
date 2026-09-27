import type { HabitatCell, SpeciesDataset } from './schema';
import { curveOceanRoute, oceanRoute } from './oceanRoutes';

type Position = [number, number];
export type DisplayFlow = { id: string; from: Position; to: Position; path: Position[] };

type CellPair = { current: HabitatCell; future: HabitatCell };

function curvedPath(from: Position, to: Position, index: number): Position[] {
  // Use the short side of the world when a pair straddles the antimeridian.
  const deltaLon = ((to[0] - from[0] + 540) % 360) - 180;
  const deltaLat = to[1] - from[1];
  const distance = Math.hypot(deltaLon, deltaLat);
  const bend = Math.min(4, distance * 0.18) * (index % 2 === 0 ? 1 : -1);
  const control: Position = [
    from[0] + deltaLon / 2 - (deltaLat / distance) * bend,
    from[1] + deltaLat / 2 + (deltaLon / distance) * bend
  ];
  return Array.from({ length: 25 }, (_, step) => {
    const t = step / 24;
    const inverse = 1 - t;
    return [
      inverse * inverse * from[0] + 2 * inverse * t * control[0] + t * t * (from[0] + deltaLon),
      inverse * inverse * from[1] + 2 * inverse * t * control[1] + t * t * to[1]
    ];
  });
}

export function displayFlows(dataset: SpeciesDataset): DisplayFlow[] {
  const pairs = dataset.provenance !== 'reviewed-model'
    ? dataset.habitat.current.flatMap(cell => {
      const future = dataset.habitat.future.find(candidate => candidate.id === cell.id);
      return future ? [{ id: cell.id, from: cell.center, to: future.center }] : [];
    })
    : (dataset.movementVectors ?? []).map((vector, index) => ({
      id: `reviewed-${index}`, from: vector.from, to: vector.to
    }));

  return pairs.filter(pair => pair.from[0] !== pair.to[0] || pair.from[1] !== pair.to[1])
    .map((pair, index) => ({ ...pair, path: curvedPath(pair.from, pair.to, index) }));
}

// A decorative field for the synthetic fixture only. Each current cell is
// connected only to the future cell with the same ID. These strands are not
// inferred migration routes or model output.
export function displayStreamlines(dataset: SpeciesDataset): DisplayFlow[] {
  if (dataset.provenance === 'reviewed-model') {
    return displayFlows(dataset).flatMap((flow, index) => {
      const path = oceanRoute(flow.from, flow.to);
      return path ? [{ ...flow, path: curveOceanRoute(path, index) }] : [];
    });
  }

  const pairs: CellPair[] = dataset.habitat.current.flatMap(current => {
    const future = dataset.habitat.future.find(cell => cell.id === current.id);
    return future && (current.center[0] !== future.center[0] || current.center[1] !== future.center[1])
      ? [{ current, future }] : [];
  });

  return pairs.flatMap((pair, pairIndex) => {
    const { current, future } = pair;

    return Array.from({ length: 18 }, (_, strand) => {
      // Equal offsets at both ends preserve the direction of the paired centers.
      const lane = (strand - 8.5) / 8.5;
      const wave = Math.sin(pairIndex * 2.7 + strand * 1.9);
      const longitudeOffset = lane * Math.min(current.widthDeg, future.widthDeg) * 0.31;
      const latitudeOffset = wave * Math.min(current.heightDeg, future.heightDeg) * 0.29;
      const from: Position = [
        current.center[0] + longitudeOffset,
        current.center[1] + latitudeOffset
      ];
      const to: Position = [
        future.center[0] + longitudeOffset,
        future.center[1] + latitudeOffset
      ];
      const path = oceanRoute(from, to);
      return path ? { id: `${current.id}-${strand}`, from, to, path: curveOceanRoute(path, pairIndex * 18 + strand) } : null;
    }).filter((flow): flow is DisplayFlow => flow !== null);
  });
}

export function pointOnFlow(flow: DisplayFlow, progress: number): Position {
  const location = Math.max(0, Math.min(1, progress)) * (flow.path.length - 1);
  const before = Math.floor(location);
  const after = Math.min(before + 1, flow.path.length - 1);
  const fraction = location - before;
  return [
    flow.path[before][0] + (flow.path[after][0] - flow.path[before][0]) * fraction,
    flow.path[before][1] + (flow.path[after][1] - flow.path[before][1]) * fraction
  ];
}

// The growing line starts at the source, then its tail follows the tip until
// both reach the destination. No part of the route remains on screen afterward.
export function visibleFlowWindow(progress: number): [number, number] {
  const end = Math.max(0, Math.min(1, progress));
  const start = end <= 0.62 ? 0 : (end - 0.62) / 0.38;
  return [Math.min(start, end), end];
}

export function flowSection(flow: DisplayFlow, from: number, to: number): Position[] {
  const start = Math.max(0, Math.min(1, from));
  const end = Math.max(start, Math.min(1, to));
  const lastIndex = flow.path.length - 1;
  const interior = flow.path.filter((_, index) => index / lastIndex > start && index / lastIndex < end);
  return [pointOnFlow(flow, start), ...interior, pointOnFlow(flow, end)];
}
