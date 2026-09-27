import type { HabitatCell, SpeciesDataset } from './schema';

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
  const pairs = dataset.provenance === 'synthetic-demo'
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

// A decorative field for the synthetic fixture only. Nearby habitat cells are
// connected to make the period-to-period shift legible at map scale. These
// connections are not inferred migration routes or model output.
export function displayStreamlines(dataset: SpeciesDataset): DisplayFlow[] {
  if (dataset.provenance !== 'synthetic-demo') return displayFlows(dataset);

  const pairs: CellPair[] = dataset.habitat.current.flatMap(current =>
    dataset.habitat.future
      .map(future => {
        const longitude = ((future.center[0] - current.center[0] + 540) % 360) - 180;
        const latitude = future.center[1] - current.center[1];
        const distance = Math.hypot(longitude * Math.cos(current.center[1] * Math.PI / 180), latitude);
        return { future, distance };
      })
      .filter(({ distance }) => distance > 0 && distance < 68)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map(({ future }) => ({ current, future }))
  );

  return pairs.flatMap((pair, pairIndex) => {
    const { current, future } = pair;

    return Array.from({ length: 9 }, (_, strand) => {
      // Keep both ends inside their respective invented habitat cells.
      const lane = (strand - 4) / 4;
      const wave = Math.sin(pairIndex * 2.7 + strand * 1.9);
      const from: Position = [
        current.center[0] + lane * current.widthDeg * 0.31,
        current.center[1] + wave * current.heightDeg * 0.29
      ];
      const to: Position = [
        future.center[0] + lane * future.widthDeg * 0.31,
        future.center[1] + Math.sin(pairIndex * 2.7 + strand * 1.9 + 0.9) * future.heightDeg * 0.29
      ];
      return { id: `${current.id}-${future.id}-${strand}`, from, to, path: curvedPath(from, to, pairIndex + strand) };
    });
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
