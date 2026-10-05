import snapshot from './temperatureForecasts.json';
import { availableYears, recordsByYear, seaAreas, seaSeries, temperatureMetadata, type TemperatureRecord } from './seaTemperatures';

export const forecastMetadata = snapshot;
export const forecastYears = [...new Set(snapshot.records.map(row => row.year))].sort((a, b) => a-b);
export const forecastRecords: TemperatureRecord[] = snapshot.records.map(row => ({ ...row, cells: 0, method: 'forecast',
  forecastBasis: row.forecastBasis as TemperatureRecord['forecastBasis'],
  intervalKind: row.intervalKind as TemperatureRecord['intervalKind'] }));
export const forecastsByYear = new Map(forecastYears.map(year => [year,
  new Map(forecastRecords.filter(row => row.year === year).map(row => [row.areaId, row]))]));
export const forecastSeries = (areaId: string) => forecastRecords.filter(row => row.areaId === areaId);
export const timelineYears = [...availableYears, ...forecastYears];
export const timelineByYear = new Map([...recordsByYear, ...forecastsByYear]);
export const timelineSeries = (areaId: string) => [...seaSeries(areaId), ...forecastSeries(areaId)];
export const forecastModelLabel = snapshot.model === 'persistence'
  ? 'Persistencia: última temperatura conocida'
  : snapshot.model.startsWith('ridge') ? 'Regresión Ridge' : snapshot.model.startsWith('boosting') ? 'Gradient Boosting' : 'Tendencia reciente';

export function buildTemperatureCsv() {
  const header = 'año,zona,temperatura_c,tipo,base,numero_celdas,zonas_base,limite_inferior_c,limite_superior_c,tipo_intervalo,intervalo_nominal,modelo,historico_hasta,run_id';
  const names = new Map(seaAreas.features.map(item => [item.properties.id, item.properties.name]));
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const rows = [...temperatureMetadata.records, ...forecastRecords].map(row => {
    const future = row.method === 'forecast';
    const estimated = row.method === 'estimated' || row.forecastBasis === 'estimated-history';
    return [row.year, quote(names.get(row.areaId)!), row.celsius, future ? 'predicción' : 'histórico',
      estimated ? 'estimada' : 'NOAA', row.cells, quote(row.estimatedFrom?.map(id => names.get(id)).join(' / ') ?? ''),
      row.lower ?? '', row.upper ?? '', row.intervalKind ?? '', row.intervalKind === 'calibrated' ? snapshot.intervalLevel : '',
      future ? snapshot.model : '', future ? snapshot.trainedThrough : '', future ? snapshot.runId : ''].join(',');
  });
  return [header, ...rows].join('\n');
}
