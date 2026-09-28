import type { HabitatCell, SpeciesDataset } from './schema';
import { curveOceanRoute, isOcean, oceanRoute, waterSegment } from './oceanRoutes';

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

// A decorative field for illustrative scenarios. Each observed square is
// connected to its translated visual pair, never an inferred migration route.
export function displayStreamlines(dataset: SpeciesDataset, strandsPerBox = 12): DisplayFlow[] {
  if (!Number.isInteger(strandsPerBox) || strandsPerBox < 2) throw new Error('Invalid display strand count');
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
    const centerPath = oceanRoute(current.center, future.center);
    if (!centerPath) return [];
    const cosine = Math.max(0.2, Math.cos(current.center[1] * Math.PI / 180));
    const deltaX = (future.center[0] - current.center[0]) * cosine;
    const deltaY = future.center[1] - current.center[1];
    const length = Math.hypot(deltaX, deltaY);
    const along: Position = [deltaX / length, deltaY / length];
    const across: Position = [-along[1], along[0]];
    const side = Math.min(current.widthDeg * cosine, current.heightDeg,
      future.widthDeg * cosine, future.heightDeg);
    const columns = Math.ceil(strandsPerBox / 2);

    return Array.from({ length: strandsPerBox }, (_, strand) => {
      // Two rows span each observed square. Matching offsets at the other end
      // make this a field from area to area, without inventing movement records.
      const lane = columns === 1 ? 0 : 2 * (strand % columns) / (columns - 1) - 1;
      const row = strand < columns ? -1 : 1;
      for (const scale of [1, 0.8, 0.6, 0.4, 0.2]) {
        const acrossDistance = lane * side * 0.38 * scale;
        const alongDistance = row * side * 0.1 * scale;
        const longitudeOffset = (across[0] * acrossDistance + along[0] * alongDistance) / cosine;
        const latitudeOffset = across[1] * acrossDistance + along[1] * alongDistance;
        const from: Position = [current.center[0] + longitudeOffset, current.center[1] + latitudeOffset];
        const to: Position = [future.center[0] + longitudeOffset, future.center[1] + latitudeOffset];
        if (!isOcean(from) || !isOcean(to)) continue;
        // Reuse the reviewed water geometry for the fan. Open-water strands
        // take their direct route; coastal ones follow a translated center
        // route only when every segment remains at sea.
        if (waterSegment(from, to)) {
          const path = oceanRoute(from, to) ?? [from, to];
          return { id: `${current.id}-${strand}`, from, to,
            path: curveOceanRoute(path, pairIndex * strandsPerBox + strand) };
        }
        const path = centerPath.map(([lon, lat]) => [lon + longitudeOffset, lat + latitudeOffset] as Position);
        if (path.every((point, index) => index === 0 || waterSegment(path[index - 1], point))) {
          return { id: `${current.id}-${strand}`, from, to,
            path: curveOceanRoute(path, pairIndex * strandsPerBox + strand) };
        }
      }
      // A very narrow coastal passage may not admit a parallel lane. Keep
      // one center strand when its reviewed water route is available.
      return strand === 0 ? { id: `${current.id}-${strand}`,
        from: current.center, to: future.center,
        path: curveOceanRoute(centerPath, pairIndex * strandsPerBox + strand) } : null;
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
  const start = end <= 0.82 ? 0 : (end - 0.82) / 0.18;
  return [Math.min(start, end), end];
}

export function flowSection(flow: DisplayFlow, from: number, to: number): Position[] {
  const start = Math.max(0, Math.min(1, from));
  const end = Math.max(start, Math.min(1, to));
  const lastIndex = flow.path.length - 1;
  const interior = flow.path.filter((_, index) => index / lastIndex > start && index / lastIndex < end);
  return [pointOnFlow(flow, start), ...interior, pointOnFlow(flow, end)];
}
