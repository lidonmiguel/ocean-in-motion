import snapshot from './temperatureForecasts.json';
import {
  availableYears,
  recordsByYear,
  seaRegions,
  seaSeries,
  temperatureMetadata,
  type TemperatureRecord
} from './seaTemperatures';

export const forecastMetadata = snapshot;
export const forecastYears = [
  ...new Set(snapshot.records.map((row) => row.year))
].sort((a, b) => a - b);
export const forecastRecords: TemperatureRecord[] = snapshot.records.map(
  (row) => ({
    ...row,
    cells: 0,
    method: 'forecast',
    forecastBasis: row.forecastBasis as TemperatureRecord['forecastBasis'],
    intervalKind: row.intervalKind as TemperatureRecord['intervalKind']
  })
);
export const forecastsByYear = new Map(
  forecastYears.map((year) => [
    year,
    new Map(
      forecastRecords
        .filter((row) => row.year === year)
        .map((row) => [row.areaId, row])
    )
  ])
);
export const forecastSeries = (areaId: string) =>
  forecastRecords.filter((row) => row.areaId === areaId);
export const timelineYears = [...availableYears, ...forecastYears];
export const timelineByYear = new Map([...recordsByYear, ...forecastsByYear]);
export const timelineSeries = (areaId: string) => [
  ...seaSeries(areaId),
  ...forecastSeries(areaId)
];
export const forecastModelLabel =
  snapshot.model === 'persistence'
    ? 'Persistence: last known temperature'
    : snapshot.model.startsWith('ridge')
      ? 'Ridge regression'
      : snapshot.model.startsWith('boosting')
        ? 'Gradient Boosting'
        : 'Recent trend';

export function buildTemperatureCsv() {
  const header =
    'year,region,temperature_c,type,basis,cell_count,donor_regions,lower_bound_c,upper_bound_c,interval_kind,nominal_interval,model,history_through,run_id';
  const names = new Map(seaRegions.map((item) => [item.id, item.name]));
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const rows = [...temperatureMetadata.records, ...forecastRecords].map(
    (row) => {
      const future = row.method === 'forecast';
      const estimated =
        row.method === 'estimated' || row.forecastBasis === 'estimated-history';
      return [
        row.year,
        quote(names.get(row.areaId)!),
        row.celsius,
        future ? 'forecast' : 'history',
        estimated ? 'estimated' : 'NOAA',
        row.cells,
        quote(row.estimatedFrom?.map((id) => names.get(id)).join(' / ') ?? ''),
        row.lower ?? '',
        row.upper ?? '',
        row.intervalKind ?? '',
        row.intervalKind === 'calibrated' ? snapshot.intervalLevel : '',
        future ? snapshot.model : '',
        future ? snapshot.trainedThrough : '',
        future ? snapshot.runId : ''
      ].join(',');
    }
  );
  return [header, ...rows].join('\n');
}
