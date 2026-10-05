import { useState } from 'react';
import { forecastMetadata, timelineByYear, timelineSeries, timelineYears } from './data/temperatureForecasts';
import { availableYears } from './data/seaTemperatures';
import { buildComparisonCsv, comparisonProvenance, comparisonRegionById, comparisonRegions, comparisonSummary, comparisonValue, normalizeRegionName, referencePeriod, type ComparisonMetric, type RegionKind } from './data/temperatureComparison';

const colors = ['#82e6d8', '#ffadd0', '#f6c177', '#a7b7ff', '#6ec8ff'];
const firstYear = timelineYears[0];
const lastYear = timelineYears.at(-1)!;
const historicalEnd = availableYears.at(-1)!;
const number = (value: number | undefined, signed = false) => value === undefined ? 'Incomplete reference period' : `${signed && value > 0 ? '+' : ''}${value.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} °C`;
type Selection = { id: string; color: string };

export function TemperatureComparison({ areaId, year, onYearChange }: { areaId: string; year: number; onYearChange: (year: number) => void }) {
  const [selection, setSelection] = useState<Selection[]>(() => [...new Set([areaId, 'atlantic-north', 'caspian', 'med-west'])].slice(0, 3).map((id, index) => ({ id, color: colors[index] })));
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<RegionKind | 'all'>('all');
  const [source, setSource] = useState('all');
  const [metric, setMetric] = useState<ComparisonMetric>('temperature');
  const [start, setStart] = useState(firstYear);
  const [end, setEnd] = useState(lastYear);
  const [hoverYear, setHoverYear] = useState<number>();
  const [tableOpen, setTableOpen] = useState(false);
  const series = selection.map(item => ({ ...item, region: comparisonRegionById.get(item.id)!, ...comparisonSummary(item.id), rows: timelineSeries(item.id) }));
  const candidates = comparisonRegions.filter(region => (kind === 'all' || region.kind === kind)
    && (source === 'all' || region.estimated === (source === 'estimated'))
    && normalizeRegionName(region.name).includes(normalizeRegionName(search)));
  function add(id: string) {
    if (selection.length >= 5 || selection.some(item => item.id === id)) return;
    setSelection([...selection, { id, color: colors.find(color => !selection.some(item => item.color === color))! }]);
  }
  function download() {
    const url = URL.createObjectURL(new Blob(['\ufeff', buildComparisonCsv(selection.map(item => item.id), start, end)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `temperature-comparison-${start}-${end}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const W = 1000, H = 360, left = 65, right = 25, top = 36, bottom = 45;
  const plotWidth = W - left - right, plotHeight = H - top - bottom;
  const plotted = series.flatMap(item => item.rows.filter(row => row.year >= start && row.year <= end).map(row => comparisonValue(row, metric, item.baseline))).filter((value): value is number => value !== undefined);
  const minValue = Math.min(...plotted, ...(metric === 'anomaly' ? [0] : []));
  const maxValue = Math.max(...plotted, ...(metric === 'anomaly' ? [0] : []));
  const padding = Math.max(.15, (maxValue - minValue) * .12);
  const low = minValue - padding, high = maxValue + padding;
  const x = (value: number) => left + (value - start) / (end - start) * plotWidth;
  const y = (value: number) => top + (high - value) / (high - low) * plotHeight;
  const ticks = [...new Set([start, ...timelineYears.filter(value => value > start && value < end && value % 10 === 0), end])];
  const inspectedYear = hoverYear ?? Math.max(start, Math.min(end, year));
  const pointString = (rows: typeof series[number]['rows'], baseline?: number) => rows.filter(row => row.year >= start && row.year <= end).flatMap(row => {
    const value = comparisonValue(row, metric, baseline);
    return value === undefined ? [] : [`${x(row.year)},${y(value)}`];
  }).join(' ');
  const ranking = series.map(item => ({ ...item, row: timelineByYear.get(year)?.get(item.id) })).filter(item => item.row !== undefined)
    .map(item => ({ ...item, value: comparisonValue(item.row!, metric, item.baseline) })).filter(item => item.value !== undefined)
    .sort((a, b) => b.value! - a.value!);
  const barMin = Math.min(0, ...ranking.map(item => item.value!)), barMax = Math.max(0, ...ranking.map(item => item.value!));
  const barSpan = Math.max(.1, barMax - barMin), zero = -barMin / barSpan * 100;
  return <section className="comparison-section" aria-labelledby="comparison-title">
    <div className="comparison-heading"><div><div className="section-index">04 / COMPARE</div><h2 id="comparison-title">Every sea has <em>a story.</em></h2><p>Compare temperatures and changes in one series · history 1982–2025 and forecasts 2026–2030.</p></div><button type="button" className="world-view-button" onClick={download}>Download comparison (CSV) ↓</button></div>
    <div className="comparison-picker">
      <div><label htmlFor="comparison-search">Find a region</label><input id="comparison-search" type="search" placeholder="E.g. Mediterranean, Caspian…" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <div><label htmlFor="comparison-kind">Region type</label><select id="comparison-kind" value={kind} onChange={event => setKind(event.target.value as RegionKind | 'all')}><option value="all">All regions</option><option value="ocean">Oceans</option><option value="sea">Seas</option><option value="other">Gulfs, bays and other regions</option></select></div>
      <div><label htmlFor="comparison-source">Historical basis</label><select id="comparison-source" value={source} onChange={event => setSource(event.target.value)}><option value="all">NOAA and estimates</option><option value="noaa">NOAA reconstruction only</option><option value="estimated">Estimates only</option></select></div>
      <button type="button" className="world-view-button" disabled={selection.length >= 5 || selection.some(item => item.id === areaId)} onClick={() => add(areaId)}>Add map region</button>
    </div>
    <div className="comparison-candidates" role="region" aria-label="Add regions to the comparison" tabIndex={0}>{candidates.map(region => <button type="button" key={region.id} disabled={selection.length >= 5 || selection.some(item => item.id === region.id)} onClick={() => add(region.id)}>{region.name}<span>{region.estimated ? '≈ Estimated' : 'NOAA'}</span></button>)}{candidates.length === 0 && <p role="status">No regions match these filters.</p>}</div>
    <p className="comparison-help">{selection.length}/5 regions · Filters apply to the picker; selected regions remain. Choose at least two to compare.</p>
    <div className="comparison-chips" aria-label="Compared regions">{series.map(item => <div key={item.id} style={{ borderColor: item.color }}><i style={{ background: item.color }} /><span>{item.region.name}<small>{item.region.estimated ? '≈ Estimated history' : 'Reconstructed NOAA history'}</small></span><button type="button" aria-label={`Remove ${item.region.name}`} disabled={selection.length <= 2} onClick={() => setSelection(selection.filter(region => region.id !== item.id))}>×</button></div>)}</div>
    <div className="comparison-toolbar"><div className="comparison-metric" role="group" aria-label="Comparison metric"><button type="button" aria-pressed={metric === 'temperature'} onClick={() => setMetric('temperature')}>Temperature · °C</button><button type="button" aria-pressed={metric === 'anomaly'} onClick={() => setMetric('anomaly')}>Anomaly · °C</button></div><div className="comparison-period"><label htmlFor="comparison-start">From</label><select id="comparison-start" value={start} onChange={event => { setStart(Number(event.target.value)); setHoverYear(undefined); }}>{timelineYears.filter(value => value < end).map(value => <option key={value}>{value}</option>)}</select><label htmlFor="comparison-end">To</label><select id="comparison-end" value={end} onChange={event => { setEnd(Number(event.target.value)); setHoverYear(undefined); }}>{timelineYears.filter(value => value > start).map(value => <option key={value}>{value}</option>)}</select><button type="button" onClick={() => { setStart(firstYear); setEnd(lastYear); setHoverYear(undefined); }}>Full period</button></div></div>
    <div className="comparison-chart-card">
      <div className="comparison-chart-heading"><h3>{metric === 'temperature' ? 'Surface temperature over time' : 'Change from each region’s own mean'}</h3><span>{start}–{end} · °C</span></div>
      <p className="comparison-help">{metric === 'anomaly' ? `Anomaly = annual temperature − the region’s own ${referencePeriod.join('–')} mean.` : 'Annual surface water temperature means.'} Solid line: history · dashed line: forecast. Click the chart to change the map year.</p>
      <div className="comparison-chart-scroll" tabIndex={0} role="region" aria-label="Time-series chart; scroll horizontally on small screens"><svg className="comparison-chart" viewBox={`0 0 ${W} ${H}`} role="img" tabIndex={0} onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setHoverYear(Math.max(start, Math.min(end, inspectedYear + (event.key === 'ArrowRight' ? 1 : -1)))); }
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onYearChange(inspectedYear); }
        if (event.key === 'Escape') setHoverYear(undefined);
      }} aria-label={`Comparison of ${metric === 'temperature' ? 'temperatures' : 'anomalies'} across ${selection.length} regions between ${start} and ${end}. Arrow keys inspect years; Enter selects the map year.`} onPointerMove={event => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const localX = (event.clientX - bounds.left) / bounds.width * W;
        setHoverYear(Math.max(start, Math.min(end, Math.round(start + (localX - left) / plotWidth * (end - start)))));
      }} onPointerLeave={() => setHoverYear(undefined)} onClick={() => onYearChange(inspectedYear)}>
        <title>{`Annual series for ${series.map(item => item.region.name).join(', ')}. Values are available in the accessible table.`}</title>
        {end > historicalEnd && <rect x={x(Math.max(start, historicalEnd + .5))} y={top} width={W - right - x(Math.max(start, historicalEnd + .5))} height={plotHeight} fill="#f6c177" fillOpacity=".055" />}
        {Array.from({ length: 5 }, (_, index) => low + (high - low) * index / 4).map(value => <g key={value}><line x1={left} x2={W - right} y1={y(value)} y2={y(value)} stroke="#284752" /><text x={left - 12} y={y(value) + 4} textAnchor="end">{value.toFixed(1)}</text></g>)}
        {metric === 'anomaly' && <line x1={left} x2={W - right} y1={y(0)} y2={y(0)} stroke="#94b9bd" strokeDasharray="3 4" />}
        {ticks.map(value => <text key={value} x={x(value)} y={H - 16} textAnchor="middle">{value}</text>)}
        {start <= historicalEnd && end > historicalEnd && <line x1={x(historicalEnd + .5)} x2={x(historicalEnd + .5)} y1={top} y2={H - bottom} stroke="#c4a575" strokeDasharray="3 5" />}
        {end > historicalEnd && <text x={W - right} y={19} textAnchor="end" className="prediction-label">FORECAST FROM 2026</text>}
        {series.map(item => <g key={item.id}><polyline points={pointString(item.rows.filter(row => row.method !== 'forecast'), item.baseline)} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinejoin="round" /><polyline points={pointString(item.rows.filter(row => row.year >= historicalEnd), item.baseline)} fill="none" stroke={item.color} strokeWidth="2.5" strokeDasharray="6 5" strokeLinejoin="round" /></g>)}
        <line x1={x(inspectedYear)} x2={x(inspectedYear)} y1={top} y2={H - bottom} stroke="#b5d9d5" strokeOpacity=".65" />
        {series.map(item => { const row = item.rows.find(row => row.year === inspectedYear); const value = row && comparisonValue(row, metric, item.baseline); return value === undefined ? null : <circle key={item.id} cx={x(inspectedYear)} cy={y(value)} r="4.5" fill={item.color} stroke="#092330" strokeWidth="2" />; })}
      </svg></div>
      <div className="comparison-inspection" aria-live="polite"><strong>{inspectedYear} · {inspectedYear > historicalEnd ? 'Forecast' : 'History'}</strong>{series.map(item => { const row = item.rows.find(row => row.year === inspectedYear); return row && <div key={item.id}><i style={{ background: item.color }} /><span>{item.region.name}</span><b>{number(comparisonValue(row, metric, item.baseline), metric === 'anomaly')}</b><small>{comparisonProvenance(row)}</small></div>; })}</div>
    </div>
    <div className="comparison-lower"><div className="comparison-chart-card"><div className="comparison-chart-heading"><h3>Comparison in {year}</h3><span>{year > historicalEnd ? '↗ FORECAST' : 'HISTORY'}</span></div><label className="comparison-year-label" htmlFor="comparison-year">Year shared with the map · {year}</label><input id="comparison-year" type="range" min={firstYear} max={lastYear} value={year} onChange={event => onYearChange(Number(event.target.value))} /><div className="comparison-bars" role="list" aria-label={`Regions sorted by ${metric === 'temperature' ? 'temperature' : 'anomaly'} in ${year}`}>{ranking.map(item => <div key={item.id} role="listitem"><div className="comparison-bar-caption"><span>{item.region.name}</span><strong>{number(item.value, metric === 'anomaly')}</strong></div><div className="comparison-bar-track"><i className="comparison-bar-zero" style={{ left: `${zero}%` }} /><span style={{ left: `${Math.min(zero, (item.value! - barMin) / barSpan * 100)}%`, width: `${Math.abs(item.value!) / barSpan * 100}%`, background: item.color }} /></div><small>{comparisonProvenance(item.row!)}</small></div>)}</div><p className="comparison-help">{metric === 'anomaly' ? 'Bars start at zero; negative values indicate a year cooler than the reference.' : 'Bars start at 0 °C and are sorted from warmest to coolest.'}</p></div>
    <div className="comparison-chart-card"><div className="comparison-chart-heading"><h3>Historical change</h3><span>10-YEAR MEANS</span></div><p className="comparison-help">Mean 2016–2025 minus mean 1982–1991. Excludes forecasts; this is not an annual rate.</p><div className="comparison-summaries">{series.map(item => { const row = timelineByYear.get(year)!.get(item.id)!; return <article key={item.id} style={{ borderLeftColor: item.color }}><h4>{item.region.name}</h4><strong>{number(item.change, true)}</strong><dl><div><dt>Temperature · {year}</dt><dd>{number(row.celsius)}</dd></div><div><dt>Anomaly · {year}</dt><dd>{number(comparisonValue(row, 'anomaly', item.baseline), true)}</dd></div><div><dt>Mean · 1982–2010</dt><dd>{number(item.baseline)}</dd></div></dl><small>{comparisonProvenance(row)}{item.region.estimated ? ' · The change is also estimated.' : ''}</small></article>; })}</div></div></div>
    <button type="button" className="world-view-button comparison-table-toggle" aria-expanded={tableOpen} aria-controls="comparison-table" onClick={() => setTableOpen(!tableOpen)}>{tableOpen ? 'Hide' : 'Show'} comparison table</button>
    {tableOpen && <div id="comparison-table" className="comparison-table" role="region" aria-label="Comparison values" tabIndex={0}><table><caption>Selected regions · {start}–{end} · anomalies relative to 1982–2010</caption><thead><tr><th>Year</th><th>Region</th><th>Temperature</th><th>Anomaly</th><th>Provenance</th></tr></thead><tbody>{timelineYears.filter(value => value >= start && value <= end).flatMap(value => series.map(item => { const row = item.rows.find(record => record.year === value)!; return <tr key={`${item.id}-${value}`}><td>{value}</td><th scope="row">{item.region.name}</th><td>{number(row.celsius)}</td><td>{number(comparisonValue(row, 'anomaly', item.baseline), true)}</td><td>{comparisonProvenance(row)}</td></tr>; }))}</tbody></table></div>}
    <p className="comparison-method">{comparisonRegions.filter(region => !region.estimated).length} regions have reconstructed NOAA histories and {comparisonRegions.filter(region => region.estimated).length} have estimates. Each anomaly uses its region’s own historical reference, excluding forecasts. Estimated regions do not provide independent local measurements. Filters group regions by their published names and boundaries; they do not aggregate seas into ocean totals. {forecastMetadata.model === 'persistence' && 'The selected forecast preserves the 2025 value, so its lines are flat: this does not mean warming will stop. '}<a href="https://github.com/lidonmiguel/ocean-in-motion/blob/main/docs/temperature-comparison.md" target="_blank" rel="noreferrer">Method and sources ↗</a></p>
  </section>;
}
