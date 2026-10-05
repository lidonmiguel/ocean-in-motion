import { forecastSeries } from './data/temperatureForecasts';
import { seaSeries } from './data/seaTemperatures';

export function TemperatureHistoryChart({ areaId, selectedYear }: { areaId: string; selectedYear: number }) {
  const history = seaSeries(areaId);
  const future = forecastSeries(areaId);
  const derived = future[0]?.forecastBasis === 'estimated-history';
  const all = [...history, ...future];
  const low = Math.min(...all.map(row => row.lower ?? row.celsius));
  const high = Math.max(...all.map(row => row.upper ?? row.celsius));
  const firstYear = history[0].year;
  const lastYear = all.at(-1)!.year;
  const x = (year: number) => (year-firstYear)/(lastYear-firstYear)*260;
  const y = (value: number) => 65-(value-low)/Math.max(0.1, high-low)*55;
  const historicalPath = history.map(row => `${x(row.year)},${y(row.celsius)}`).join(' ');
  const bridge = history.at(-1)!;
  const forecastPath = [bridge, ...future].map(row => `${x(row.year)},${y(row.celsius)}`).join(' ');
  const band = future.map(row => `${x(row.year)},${y(row.upper!)}`).concat(
    [...future].reverse().map(row => `${x(row.year)},${y(row.lower!)}`)).join(' ');
  const selected = all.find(row => row.year === selectedYear);
  return <>
    <div className="field-label">TIMELINE · {firstYear}–{lastYear}</div>
    <svg className="temperature-chart" viewBox="0 0 260 80" role="img" aria-label={derived
      ? 'Estimated history through 2025 and forecasts for 2026–2030; donor-derived range without validated local coverage'
      : 'NOAA history through 2025 and forecasts for 2026–2030; nominal 90% interval, coverage not guaranteed'}>
      <line x1="0" y1="67" x2="260" y2="67" stroke="#4a737a" />
      {future.length > 0 && <polygon points={band} fill="#f7bd63" fillOpacity=".2" />}
      <polyline points={historicalPath} fill="none" stroke="#88e5db" strokeWidth="2.5" />
      {future.length > 0 && <><line x1={x(2025)} y1="0" x2={x(2025)} y2="70" stroke="#719799" strokeDasharray="2 3" /><polyline points={forecastPath} fill="none" stroke="#f7bd63" strokeWidth="2.5" strokeDasharray="4 3" /><text x={x(2025)} y="78" textAnchor="middle" fill="#b9d4d0" fontSize="8">2025</text></>}
      {selected && <circle cx={x(selected.year)} cy={y(selected.celsius)} r="3" fill={selected.method === 'forecast' ? '#f7bd63' : '#88e5db'} stroke="#0e2b39" strokeWidth="1"><title>{`Selected year: ${selected.year}`}</title></circle>}
      <text x="0" y="8" fill="#b9d4d0" fontSize="8">{high.toFixed(1)} °C</text>
      <text x="0" y="78" fill="#b9d4d0" fontSize="8">{low.toFixed(1)} °C</text>
    </svg>
    <div className="year-ends"><span>{firstYear}</span><span>{lastYear}</span></div>
    {future.length > 0 && <p className="forecast-chart-key">Turquoise: {derived ? 'estimated history' : 'NOAA history'} · Dashed amber: forecasts from 2026 · Band: {derived ? 'donor-derived range, no validated local coverage' : 'nominal 90% interval, coverage not guaranteed'}.</p>}
  </>;
}
