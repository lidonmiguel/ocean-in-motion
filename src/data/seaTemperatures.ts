import areas from './seaAreas.geojson?raw';
import temperatures from './seaTemperatures.json';

export type SeaFeature = {
  type: 'Feature';
  properties: { id: string; name: string };
  geometry: { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
};
export type TemperatureRecord = {
  year: number; areaId: string; celsius: number; cells: number;
  method?: 'estimated'; estimatedFrom?: string[];
};

export const seaAreas = JSON.parse(areas) as { type: 'FeatureCollection'; features: SeaFeature[] };
export const temperatureMetadata = temperatures;
const temperatureRows = temperatures.records as TemperatureRecord[];
export const availableYears = Array.from(new Set(temperatureRows.map(row => row.year))).sort((a, b) => a - b);
export const recordsByYear = new Map<number, Map<string, TemperatureRecord>>(
  availableYears.map(year => [year, new Map(temperatureRows.filter(row => row.year === year).map(row => [row.areaId, row]))])
);

export function seaSeries(areaId: string): TemperatureRecord[] {
  return temperatureRows.filter(row => row.areaId === areaId);
}

export function temperatureColor(value: number): [number, number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [-2, [37, 91, 150]], [8, [52, 164, 192]], [16, [92, 209, 187]],
    [24, [247, 189, 99]], [32, [234, 100, 104]]
  ];
  const upper = stops.findIndex(([limit]) => value <= limit);
  if (upper === -1) return [...stops[stops.length - 1][1], 175];
  if (upper === 0) return [...stops[0][1], 175];
  const [low, from] = stops[upper - 1];
  const [high, to] = stops[upper];
  const ratio = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return [0, 1, 2].map(index => Math.round(from[index] + (to[index] - from[index]) * ratio)).concat(175) as [number, number, number, number];
}
