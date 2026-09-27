import type { HabitatCell, Period, SpeciesDataset } from './schema';

type Position = [number, number];
export type DisplayCell = { id: string; polygon: Position[]; suitability?: number; uncertainty?: number };

// Split cells at the antimeridian so a small cell never spans the whole map.
export function cellPolygons(cell: HabitatCell): Position[][] {
  const [lon, lat] = cell.center;
  const left = lon - cell.widthDeg / 2;
  const right = lon + cell.widthDeg / 2;
  const bottom = Math.max(-85, lat - cell.heightDeg / 2);
  const top = Math.min(85, lat + cell.heightDeg / 2);
  const rectangle = (west: number, east: number): Position[] => [
    [west, bottom], [east, bottom], [east, top], [west, top], [west, bottom]
  ];
  if (right > 180) return [rectangle(left, 180), rectangle(-180, right - 360)];
  if (left < -180) return [rectangle(left + 360, 180), rectangle(-180, right)];
  return [rectangle(left, right)];
}

export function displayCells(dataset: SpeciesDataset, period: Period): DisplayCell[] {
  return dataset.habitat[period].flatMap(cell => cellPolygons(cell).map((polygon, index) => ({
    id: `${cell.id}-${index}`,
    polygon,
    suitability: cell.suitability,
    uncertainty: cell.uncertainty
  })));
}

export function suitabilityColor(value: number): [number, number, number, number] {
  if (value < 0.35) return [40, 120, 155, 125];
  if (value < 0.7) return [33, 190, 204, 158];
  return [105, 237, 226, 190];
}
