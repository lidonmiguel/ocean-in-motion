import { availableYears, seaAreas, seaSeries, type TemperatureRecord } from './seaTemperatures';
import { forecastMetadata, timelineSeries } from './temperatureForecasts';

export const referencePeriod = [1982, 2010] as const;
export const comparisonPeriods = [[1982, 1991], [2016, 2025]] as const;
export type RegionKind = 'ocean' | 'sea' | 'other';
export type ComparisonMetric = 'temperature' | 'anomaly';
const oceanIds = new Set(['atlantic-north', 'atlantic-south', 'pacific-north', 'pacific-south', 'indian', 'arctic', 'southern']);
export const comparisonRegions = seaAreas.features.map(({ properties }) => ({
  ...properties,
  kind: (oceanIds.has(properties.id) ? 'ocean'
    : /\bSeas?\b/.test(properties.name) || ['iho-kattegat', 'iho-skagerrak'].includes(properties.id) ? 'sea' : 'other') as RegionKind,
  estimated: seaSeries(properties.id).some(row => row.method === 'estimated'),
})).sort((a, b) => a.name.localeCompare(b.name, 'en'));
export const comparisonRegionById = new Map(comparisonRegions.map(region => [region.id, region]));

// Require one finite historical value for every year: no forecasts or silent partial baselines.
export function periodMean(rows: TemperatureRecord[], start: number, end: number): number | undefined {
  const history = rows.filter(row => row.method !== 'forecast' && row.year >= start && row.year <= end);
  if (history.length !== end - start + 1 || new Set(history.map(row => row.year)).size !== history.length
      || history.some(row => !Number.isFinite(row.celsius))) return undefined;
  return history.reduce((sum, row) => sum + row.celsius, 0) / history.length;
}
export function comparisonSummary(areaId: string) {
  const history = seaSeries(areaId);
  const baseline = periodMean(history, ...referencePeriod);
  const early = periodMean(history, ...comparisonPeriods[0]);
  const recent = periodMean(history, ...comparisonPeriods[1]);
  return { baseline, change: early === undefined || recent === undefined ? undefined : recent - early };
}
export function comparisonValue(row: TemperatureRecord, metric: ComparisonMetric, baseline?: number) {
  return metric === 'temperature' ? row.celsius : baseline === undefined ? undefined : row.celsius - baseline;
}
export function comparisonProvenance(row: TemperatureRecord) {
  if (row.method === 'forecast') return row.forecastBasis === 'estimated-history' ? 'Forecast · estimated basis' : 'Forecast · NOAA basis';
  return row.method === 'estimated' ? 'Estimated history' : 'Reconstructed NOAA history';
}
export function normalizeRegionName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en').trim();
}
export function buildComparisonCsv(ids: string[], start: number, end: number) {
  const quote = (value: string | number | undefined) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const header = ['year', 'region_id', 'region', 'category', 'temperature_c', 'anomaly_c', 'reference_start', 'reference_end', 'reference_mean_c', 'provenance', 'cell_count', 'donor_regions', 'lower_bound_c', 'upper_bound_c', 'interval_kind', 'nominal_interval', 'model', 'history_through', 'run_id'];
  const rows = ids.flatMap(id => {
    const region = comparisonRegionById.get(id);
    const { baseline } = comparisonSummary(id);
    return timelineSeries(id).filter(row => row.year >= start && row.year <= end).map(row => [
      row.year, id, region?.name, region?.kind === 'ocean' ? 'ocean' : region?.kind === 'sea' ? 'sea' : 'other region',
      row.celsius, baseline === undefined ? undefined : row.celsius - baseline, ...referencePeriod, baseline,
      comparisonProvenance(row), row.cells,
      row.estimatedFrom?.map(donor => comparisonRegionById.get(donor)?.name ?? donor).join(' / '),
      row.lower, row.upper, row.intervalKind,
      row.intervalKind === 'calibrated' ? forecastMetadata.intervalLevel : undefined,
      row.method === 'forecast' ? forecastMetadata.model : undefined,
      row.method === 'forecast' ? availableYears.at(-1) : undefined,
      row.method === 'forecast' ? forecastMetadata.runId : undefined,
    ].map(quote).join(','));
  });
  return [header.map(quote).join(','), ...rows].join('\n');
}
