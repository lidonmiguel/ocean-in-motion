import { useState } from 'react';
import { SeaTemperatureMap } from './SeaTemperatureMap';
import { availableYears, formatTemperature, recordsByYear, seaAreas, seaSeries, temperatureMetadata, type TemperatureRecord } from './data/seaTemperatures';

const firstYear = availableYears[0];
const lastYear = availableYears[availableYears.length - 1];

function downloadCsv() {
  const rows = ['año,zona,temperatura_media_c,numero_celdas,origen,zonas_base'];
  const names = new Map(seaAreas.features.map(item => [item.properties.id, item.properties.name]));
  temperatureMetadata.records.forEach(row => rows.push(
    `${row.year},"${names.get(row.areaId)}",${row.celsius},${row.cells},${row.method === 'estimated' ? 'estimada' : 'NOAA'},` +
    `"${row.estimatedFrom?.map(id => names.get(id)).join(' / ') ?? ''}"`
  ));
  const url = URL.createObjectURL(new Blob(['\ufeff', rows.join('\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `temperaturas-mares-${firstYear}-${lastYear}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TemperaturePage({ onBack }: { onBack: () => void }) {
  const [year, setYear] = useState(lastYear);
  const [areaId, setAreaId] = useState('med-west');
  const [worldViewKey, setWorldViewKey] = useState(0);
  const [search, setSearch] = useState('');
  const values = recordsByYear.get(year) ?? new Map<string, TemperatureRecord>();
  const areas = seaAreas.features.filter(item => values.has(item.properties.id))
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'es'));
  const selected = seaAreas.features.find(item => item.properties.id === areaId);
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const visibleAreas = areas.filter(item => normalize(item.properties.name).includes(normalize(search.trim())));
  const record = values.get(areaId);
  const estimated = record?.method === 'estimated';
  const areaNames = new Map(seaAreas.features.map(item => [item.properties.id, item.properties.name]));
  const donorNames = record?.estimatedFrom?.map(id => areaNames.get(id)).filter(Boolean).join(' y ');
  const series = seaSeries(areaId);
  const low = Math.min(...series.map(row => row.celsius));
  const high = Math.max(...series.map(row => row.celsius));
  const points = series.map((row, index) => `${(index / Math.max(1, series.length - 1) * 260).toFixed(1)},${(65 - (row.celsius - low) / Math.max(0.1, high - low) * 55).toFixed(1)}`).join(' ');

  return <div className="app-shell">
    <header className="site-header"><div className="identity"><div className="mark" aria-hidden="true"><span>≈</span></div><div><div className="eyebrow">ATLAS EXPERIMENTAL / 02</div><h1>Océano <em>en Movimiento</em></h1></div></div><div className="header-right"><span>AGUAS SUPERFICIALES</span><span className="scenario-pill">NOAA · {firstYear}–{lastYear}</span></div></header>
    <main className="workspace temperature-workspace">
      <aside className="selector-panel" aria-label="Controles de temperaturas">
        <div className="section-index">01 / EXPLORAR</div>
        <h2>La temperatura<br /><em>de cada mar.</em></h2>
        <p className="intro">Elige un año y pulsa una zona del mapa para ver su temperatura superficial. Las estimaciones se identifican con ≈.</p>
        <button type="button" className="view-switch" onClick={onBack}>← Volver a especies</button>
        <div className="fine-rule" />
        <label className="field-label" htmlFor="temperature-year">AÑO · {year}</label>
        <input id="temperature-year" className="year-slider" type="range" min={firstYear} max={lastYear} value={year} onChange={event => setYear(Number(event.target.value))} />
        <div className="year-ends"><span>{firstYear}</span><span>{lastYear}</span></div>
        <label className="field-label" htmlFor="sea-select">MAR U OCÉANO</label>
        <select id="sea-select" className="temperature-select" value={areaId} onChange={event => setAreaId(event.target.value)}>
          {areas.map(item => <option key={item.properties.id} value={item.properties.id}>{item.properties.name}</option>)}
        </select>
        <label className="field-label" htmlFor="sea-search">BUSCAR MAR U OCÉANO</label>
        <input id="sea-search" className="temperature-select" type="search" placeholder="Ej. Mar Caspio" value={search} onChange={event => setSearch(event.target.value)} />
        <div className="temperature-region-list" role="region" aria-label="Temperaturas por zona en el año seleccionado">
          {visibleAreas.map(item => <button type="button" key={item.properties.id} className={`temperature-region ${areaId === item.properties.id ? 'active' : ''}`} onClick={() => setAreaId(item.properties.id)}><span>{item.properties.name}</span><strong>{formatTemperature(values.get(item.properties.id)!)}</strong></button>)}
          {visibleAreas.length === 0 && <p className="source-note" role="status">No hay zonas con ese nombre.</p>}
        </div>
        <div className="sidebar-bottom"><span className="asterisk">✳</span><p><strong>NOAA o estimación.</strong> Las zonas sin datos NOAA locales muestran una media aproximada de zonas cercanas, ajustada por latitud.</p></div>
      </aside>
      <section className="map-panel" aria-label="Mapa de temperaturas marinas">
        <div className="map-header"><div><div className="section-index">02 / VISUALIZAR</div><h2>Temperatura superficial · {year}</h2></div><button type="button" className="world-view-button" onClick={() => setWorldViewKey(key => key + 1)}>Ver mapa mundial</button></div>
        <div className="map-stage"><SeaTemperatureMap year={year} selectedAreaId={areaId} onSelectArea={setAreaId} worldViewKey={worldViewKey} /></div>
        <div className="map-bottom"><div className="temperature-legend"><span>FRÍA</span><i /><span>CÁLIDA</span><small>−2 °C → 32 °C</small><span className="estimate-key"><i /> ≈ Estimada</span></div><span className="map-hint">Pulsa una zona · arrastra para mover</span></div>
      </section>
      <aside className="info-panel temperature-info" aria-label="Detalle de la zona marítima">
        <div className="section-index">03 / COMPRENDER</div>
        <div className="info-tag"><span /> {estimated ? 'ESTIMACIÓN ANUAL' : 'MEDIA ANUAL NOAA'}</div>
        <h2>{selected?.properties.name ?? 'Selecciona una zona'}</h2>
        <p className="latin">Superficie del mar · {year}</p>
        <div className="cyan-rule" />
        <p className="temperature-value">{record ? formatTemperature(record) : 'Sin datos'}</p>
        <p className="body-copy">{estimated
          ? `Estimación aproximada basada en ${donorNames}. Se promedian sus medias NOAA y se ajustan por latitud. No hay medición local para esta zona en el conjunto publicado; no la uses como dato observado.`
          : `Media ponderada por superficie de ${record?.cells ?? 0} celdas oceánicas NOAA de 2° con los doce meses del año. Cada mes se pondera según sus días.`}</p>
        {series.length > 1 && <><div className="field-label">EVOLUCIÓN · {firstYear}–{lastYear}{estimated ? ' · ESTIMADA' : ''}</div><svg className="temperature-chart" viewBox="0 0 260 80" role="img" aria-label={`Evolución anual ${estimated ? 'estimada' : 'NOAA'} de ${selected?.properties.name}: de ${formatTemperature(series[0])} a ${formatTemperature(series[series.length - 1])}`}><line x1="0" y1="67" x2="260" y2="67" stroke="#4a737a" /><polyline points={points} fill="none" stroke="#88e5db" strokeWidth="2.5" /></svg><div className="year-ends"><span>{firstYear}</span><span>{lastYear}</span></div></>}
        <div className="temperature-history" role="region" aria-label="Tabla de temperatura anual de la zona seleccionada"><table><thead><tr><th>Año</th><th>Temperatura</th></tr></thead><tbody>{series.map(row => <tr key={row.year} className={row.year === year ? 'selected' : ''}><td>{row.year}</td><td>{formatTemperature(row)}</td></tr>)}</tbody></table></div>
        <button type="button" className="view-switch export-button" onClick={downloadCsv}>Descargar tabla completa (CSV) ↓</button>
        <p className="source-note">Datos observados: <a href="https://www.ncei.noaa.gov/products/extended-reconstructed-sst" target="_blank" rel="noreferrer">NOAA ERSSTv6</a>. Zonas: <a href="https://www.marineregions.org/" target="_blank" rel="noreferrer">VLIZ / IHO Sea Areas v3</a>; contorno del Caspio: Natural Earth. ≈ indica una estimación por zonas vecinas y latitud, no una medición local ni una predicción.</p>
      </aside>
    </main>
    <footer className="site-footer"><span>OCÉANO EN MOVIMIENTO © PROTOTIPO</span><span>NOAA ERSSTv6 · IHO / VLIZ CC BY 4.0</span><span>{areas.length} ZONAS</span></footer>
  </div>;
}
