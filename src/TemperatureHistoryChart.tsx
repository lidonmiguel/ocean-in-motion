import { forecastSeries } from './data/temperatureForecasts';
import { seaSeries } from './data/seaTemperatures';

export function TemperatureHistoryChart({ areaId, forecastMode }: { areaId: string; forecastMode: boolean }) {
  const history = seaSeries(areaId);
  const future = forecastMode ? forecastSeries(areaId) : [];
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
  return <>
    <div className="field-label">EVOLUCIÓN · {firstYear}–{lastYear}</div>
    <svg className="temperature-chart" viewBox="0 0 260 80" role="img" aria-label={forecastMode
      ? 'Histórico NOAA hasta 2025; previsión 2026–2030 con intervalo nominal del 90%, cobertura no garantizada'
      : `Histórico de temperatura de ${firstYear} a ${lastYear}`}>
      <line x1="0" y1="67" x2="260" y2="67" stroke="#4a737a" />
      {future.length > 0 && <polygon points={band} fill="#f7bd63" fillOpacity=".2" />}
      <polyline points={historicalPath} fill="none" stroke="#88e5db" strokeWidth="2.5" />
      {future.length > 0 && <><line x1={x(2025)} y1="0" x2={x(2025)} y2="70" stroke="#719799" strokeDasharray="2 3" /><polyline points={forecastPath} fill="none" stroke="#f7bd63" strokeWidth="2.5" strokeDasharray="4 3" /></>}
    </svg>
    <div className="year-ends"><span>{firstYear}</span><span>{lastYear}</span></div>
    {future.length > 0 && <p className="forecast-chart-key">Turquesa: histórico · Ámbar discontinuo: predicción · Banda: intervalo nominal del 90 %.</p>}
  </>;
}
