import snapshot from './temperatureForecasts.json';
import type { TemperatureRecord } from './seaTemperatures';

export const forecastMetadata = snapshot;
export const forecastYears = [...new Set(snapshot.records.map(row => row.year))].sort((a, b) => a-b);
export const forecastRecords: TemperatureRecord[] = snapshot.records.map(row => ({ ...row, cells: 0, method: 'forecast' }));
export const forecastsByYear = new Map(forecastYears.map(year => [year,
  new Map(forecastRecords.filter(row => row.year === year).map(row => [row.areaId, row]))]));
export const forecastSeries = (areaId: string) => forecastRecords.filter(row => row.areaId === areaId);
export const forecastModelLabel = snapshot.model === 'persistence'
  ? 'Persistencia: última temperatura conocida'
  : snapshot.model.startsWith('ridge') ? 'Regresión Ridge' : snapshot.model.startsWith('boosting') ? 'Gradient Boosting' : 'Tendencia reciente';
