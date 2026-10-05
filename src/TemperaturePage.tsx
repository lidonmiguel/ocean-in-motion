import { useState } from 'react';
import { TemperatureComparison } from './TemperatureComparison';
import { TemperatureHistoryChart } from './TemperatureHistoryChart';
import { buildTemperatureCsv, forecastMetadata, forecastModelLabel, timelineByYear, timelineSeries, timelineYears } from './data/temperatureForecasts';
import { SeaTemperatureMap } from './SeaTemperatureMap';
import { availableYears, formatTemperature, seaAreas, type TemperatureRecord } from './data/seaTemperatures';

const firstYear = availableYears[0];
const lastYear = availableYears[availableYears.length - 1];

function downloadCsv() {
  const url = URL.createObjectURL(new Blob(['\ufeff', buildTemperatureCsv()], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `sea-temperatures-${firstYear}-${timelineYears.at(-1)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TemperaturePage({ initialYear = lastYear, initialAreaId = 'med-west' }: { initialYear?: number; initialAreaId?: string } = {}) {
  const [year, setYear] = useState(initialYear);
  const [areaId, setAreaId] = useState(initialAreaId);
  const forecastMode = year > lastYear;
  const [worldViewKey, setWorldViewKey] = useState(0);
  const [search, setSearch] = useState('');
  const [showCooling, setShowCooling] = useState(true);
  const [motionPaused, setMotionPaused] = useState(false);
  const values = timelineByYear.get(year) ?? new Map<string, TemperatureRecord>();
  const areas = seaAreas.features.filter(item => values.has(item.properties.id))
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'en'));
  const selected = seaAreas.features.find(item => item.properties.id === areaId);
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en');
  const visibleAreas = areas.filter(item => normalize(item.properties.name).includes(normalize(search.trim())));
  const record = values.get(areaId);
  const estimated = record?.method === 'estimated';
  const derivedForecast = record?.forecastBasis === 'estimated-history';
  const areaNames = new Map(seaAreas.features.map(item => [item.properties.id, item.properties.name]));
  const donorNames = record?.estimatedFrom?.map(id => areaNames.get(id)).filter(Boolean).join(' and ');
  const series = timelineSeries(areaId);
  const rangeEnd = timelineYears.at(-1)!;
  type Quality = { mae: number; coverage: number; n: number };
  const quality = (forecastMetadata.testByHorizon as Record<string, Quality>)[String(year-lastYear)];
  const areaQuality = (forecastMetadata.testByArea as Record<string, Quality>)[areaId];

  return <div className="app-shell">
    <header className="site-header"><div className="identity"><div className="mark" aria-hidden="true"><span>≈</span></div><div><div className="eyebrow">EXPERIMENTAL ATLAS / 01</div><h1>Ocean <em>in Motion</em></h1></div></div><div className="header-right"><span>SURFACE WATERS</span><span className="scenario-pill">HISTORY AND FORECAST · {firstYear}–{rangeEnd}</span></div></header>
    <main className="workspace temperature-workspace">
      <aside className="selector-panel" aria-label="Temperature controls">
        <div className="section-index">01 / EXPLORE</div>
        <h2>The temperature<br /><em>of every sea.</em></h2>
        <p className="intro">Explore 1982–2030 in one continuous series. ≈ marks estimated history and ↗ marks forecasts from 2026.</p>
        <div className="fine-rule" />
        <label className="field-label" htmlFor="temperature-year">YEAR · {year} · {forecastMode ? 'FORECAST' : 'HISTORY'}</label>
        <input id="temperature-year" className="year-slider" type="range" min={firstYear} max={rangeEnd} value={year} onChange={event => setYear(Number(event.target.value))} />
        <div className="year-ends"><span>{firstYear}</span><span>{rangeEnd}</span></div>
        <p className="timeline-note">History through 2025 · forecasts for 2026–2030 in all 102 regions.</p>
        <label className="cooling-toggle"><input type="checkbox" checked={showCooling} onChange={event => setShowCooling(event.target.checked)} /><span>Show paths toward cooler seas</span></label>
        {showCooling && <button type="button" className="view-switch cooling-pause" aria-pressed={motionPaused} onClick={() => setMotionPaused(paused => !paused)}>{motionPaused ? 'Resume paths' : 'Pause paths'}</button>}
        <p className="cooling-note">Lines start from different parts of each region. From its position, each line finds the nearest cooler sea among neighbors touching its current region. On arrival, it compares only the new region’s neighbors. Without a cooler neighbor, it loops locally and fades away. This is an illustrative animation, not a real current or a physical simulation.</p>
        <label className="field-label" htmlFor="sea-select">SEA OR OCEAN</label>
        <select id="sea-select" className="temperature-select" value={areaId} onChange={event => setAreaId(event.target.value)}>
          {areas.map(item => <option key={item.properties.id} value={item.properties.id}>{item.properties.name}</option>)}
        </select>
        <label className="field-label" htmlFor="sea-search">FIND A SEA OR OCEAN</label>
        <input id="sea-search" className="temperature-select" type="search" placeholder="E.g. Caspian Sea" value={search} onChange={event => setSearch(event.target.value)} />
        <div className="temperature-region-list" role="region" aria-label="Regional temperatures in the selected year">
          {visibleAreas.map(item => <button type="button" key={item.properties.id} className={`temperature-region ${areaId === item.properties.id ? 'active' : ''}`} onClick={() => setAreaId(item.properties.id)}><span>{item.properties.name}</span><strong>{formatTemperature(values.get(item.properties.id)!)}</strong></button>)}
          {visibleAreas.length === 0 && <p className="source-note" role="status">No regions match that name.</p>}
        </div>
        <div className="sidebar-bottom"><span className="asterisk">✳</span><p><strong>One series, two periods.</strong> NOAA-derived or estimated history through 2025; experimental forecasts from 2026. Estimated regions retain their donor regions.</p></div>
      </aside>
      <section className="map-panel" aria-label="Marine temperature map">
        <div className="map-header"><div><div className="section-index">02 / VIEW</div><h2>Surface temperature · {year}</h2></div><button type="button" className="world-view-button" onClick={() => setWorldViewKey(key => key + 1)}>View world map</button></div>
        <div className="map-stage"><SeaTemperatureMap year={year} selectedAreaId={areaId} onSelectArea={setAreaId} worldViewKey={worldViewKey} values={values} forecastMode={forecastMode} showCooling={showCooling} motionPaused={motionPaused} /></div>
        <div className="map-bottom"><div className="temperature-legend"><span>COLD</span><i /><span>WARM</span><small>−2 °C → 32 °C</small><span className="estimate-key"><i /> {forecastMode ? '↗ Forecast' : '≈ Estimated'}</span></div><span className="map-hint">Click a region · drag to pan</span></div>
      </section>
      <aside className="info-panel temperature-info" aria-label="Marine region details">
        <div className="section-index">03 / UNDERSTAND</div>
        <div className="info-tag"><span /> {forecastMode ? derivedForecast ? 'FORECAST · ESTIMATED BASIS' : 'FORECAST · NOAA BASIS' : estimated ? 'ANNUAL ESTIMATE' : 'ANNUAL NOAA MEAN'}</div>
        <h2>{selected?.properties.name ?? 'Select a region'}</h2>
        <p className="latin">Sea surface · {year}</p>
        <div className="cyan-rule" />
        <p className="temperature-value">{record ? formatTemperature(record) : 'No data'}</p>
        {forecastMode && record && <section className="forecast-evidence" aria-label="Forecast quality">
          <p><strong>{forecastModelLabel}</strong></p>
          <p>History through 2025 · horizon {year-lastYear} {year-lastYear === 1 ? 'year' : 'years'}.</p>
          {forecastMetadata.model === 'persistence' && <p>Preserves the 2025 value: this baseline had the lowest development error across the {Object.keys(forecastMetadata.testByArea).length} evaluated NOAA regions.</p>}
          {derivedForecast ? <>
            <p>Starts from this region’s estimated history and applies the forecast change from {donorNames}.</p>
            <p>Donor-derived range: <strong>{record.lower?.toFixed(1)} to {record.upper?.toFixed(1)} °C</strong>. No validated local coverage; the range does not capture all historical estimation uncertainty.</p>
            <p>No evaluation against local measurements: no MAE or calibrated 90% interval is assigned to this region.</p>
          </> : <>
            <p>Nominal 90% interval: <strong>{record.lower?.toFixed(1)} to {record.upper?.toFixed(1)} °C</strong>. Future coverage is not guaranteed.</p>
            <p>Test 2021–2025, horizon {year-lastYear}: MAE {quality?.mae.toFixed(2)} °C · coverage {(100*(quality?.coverage ?? 0)).toFixed(0)}% across {quality?.n} NOAA regions.</p>
            <p>Error for this region over the five test years: {areaQuality?.mae.toFixed(2)} °C MAE.</p>
          </>}
          <a href="https://github.com/lidonmiguel/ocean-in-motion/blob/main/reports/temperature/REPORT.md" target="_blank" rel="noreferrer">Evaluation and limitations ↗</a>
        </section>}
        {!forecastMode && <p className="body-copy">{estimated
          ? `Approximate estimate based on ${donorNames}. Their NOAA means are averaged and adjusted for latitude. The published dataset has no local measurement for this region; do not treat it as an observation.`
          : `Area-weighted mean of ${record?.cells ?? 0} NOAA ocean cells at 2° resolution with all twelve months present. Each month is weighted by its number of days.`}</p>}
        <TemperatureHistoryChart areaId={areaId} selectedYear={year} />
        <div className="temperature-history" role="region" aria-label="Annual temperature table for the selected region"><table><thead><tr><th>Year</th><th>Temperature</th></tr></thead><tbody>{series.map(row => <tr key={row.year} className={row.year === year ? 'selected' : ''}><td>{row.year}{row.method === 'forecast' ? ' · forecast' : ''}</td><td>{formatTemperature(row)}</td></tr>)}</tbody></table></div>
        <button type="button" className="view-switch export-button" onClick={downloadCsv}>Download history and forecasts (CSV) ↓</button>
        <p className="source-note">Reconstructed data: <a href="https://www.ncei.noaa.gov/products/extended-reconstructed-sst" target="_blank" rel="noreferrer">NOAA ERSSTv6</a>. Regions: <a href="https://www.marineregions.org/" target="_blank" rel="noreferrer">VLIZ / IHO Sea Areas v3</a>; Caspian outline: Natural Earth. ≈ indicates an estimate based on neighboring regions and latitude, not a local measurement or a forecast.</p>
      </aside>
    </main>
    <TemperatureComparison areaId={areaId} year={year} onYearChange={setYear} />
    <footer className="site-footer"><span>OCEAN IN MOTION © PROTOTYPE</span><span>HISTORY 1982–2025 · EXPERIMENTAL FORECAST 2026–2030</span><span>{areas.length} REGIONS</span></footer>
  </div>;
}
