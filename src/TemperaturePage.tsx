import { useState } from 'react';
import { SeaTemperatureMap } from './SeaTemperatureMap';
import { availableYears, recordsByYear, seaAreas, seaSeries, temperatureMetadata } from './data/seaTemperatures';

const firstYear = availableYears[0];
const lastYear = availableYears[availableYears.length - 1];

function downloadCsv() {
  const rows = ['año,zona,temperatura_media_c,numero_celdas'];
  const names = new Map(seaAreas.features.map(item => [item.properties.id, item.properties.name]));
  temperatureMetadata.records.forEach(row => rows.push(`${row.year},"${names.get(row.areaId)}",${row.celsius},${row.cells}`));
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
  const values = recordsByYear.get(year) ?? new Map();
  const areas = seaAreas.features.filter(item => values.has(item.properties.id));
  const selected = seaAreas.features.find(item => item.properties.id === areaId);
  const record = values.get(areaId);
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
        <p className="intro">Elige un año y pulsa una zona del mapa para ver su media superficial y cómo ha cambiado.</p>
        <button type="button" className="view-switch" onClick={onBack}>← Volver a especies</button>
        <div className="fine-rule" />
        <label className="field-label" htmlFor="temperature-year">AÑO · {year}</label>
        <input id="temperature-year" className="year-slider" type="range" min={firstYear} max={lastYear} value={year} onChange={event => setYear(Number(event.target.value))} />
        <div className="year-ends"><span>{firstYear}</span><span>{lastYear}</span></div>
        <label className="field-label" htmlFor="sea-select">MAR U OCÉANO</label>
        <select id="sea-select" className="temperature-select" value={areaId} onChange={event => setAreaId(event.target.value)}>
          {areas.map(item => <option key={item.properties.id} value={item.properties.id}>{item.properties.name}</option>)}
        </select>
        <div className="temperature-region-list" role="region" aria-label="Temperaturas por zona en el año seleccionado">
          {areas.map(item => <button type="button" key={item.properties.id} className={`temperature-region ${areaId === item.properties.id ? 'active' : ''}`} onClick={() => setAreaId(item.properties.id)}><span>{item.properties.name}</span><strong>{values.get(item.properties.id)!.celsius.toFixed(2)} °C</strong></button>)}
        </div>
        <div className="sidebar-bottom"><span className="asterisk">✳</span><p><strong>Medias observadas reconstruidas.</strong> La cuadrícula de 2° suaviza cambios locales. Los mares pequeños pueden carecer de suficiente cobertura.</p></div>
      </aside>
      <section className="map-panel" aria-label="Mapa de temperaturas marinas">
        <div className="map-header"><div><div className="section-index">02 / VISUALIZAR</div><h2>Temperatura superficial · {year}</h2></div><button type="button" className="world-view-button" onClick={() => setWorldViewKey(key => key + 1)}>Ver mapa mundial</button></div>
        <div className="map-stage"><SeaTemperatureMap year={year} selectedAreaId={areaId} onSelectArea={setAreaId} worldViewKey={worldViewKey} /></div>
        <div className="map-bottom"><div className="temperature-legend"><span>FRÍA</span><i /><span>CÁLIDA</span><small>−2 °C → 32 °C</small><span className="no-data-key"><i /> Sin datos de esta zona</span></div><span className="map-hint">Pulsa una zona · arrastra para mover</span></div>
      </section>
      <aside className="info-panel temperature-info" aria-label="Detalle de la zona marítima">
        <div className="section-index">03 / COMPRENDER</div>
        <div className="info-tag"><span /> TEMPERATURA MEDIA ANUAL</div>
        <h2>{selected?.properties.name ?? 'Selecciona una zona'}</h2>
        <p className="latin">Superficie del mar · {year}</p>
        <div className="cyan-rule" />
        <p className="temperature-value">{record ? `${record.celsius.toFixed(2)} °C` : 'Sin datos'}</p>
        <p className="body-copy">Media ponderada por superficie de {record?.cells ?? 0} celdas oceánicas de 2° con los doce meses del año. Cada mes se pondera según su número de días.</p>
        {series.length > 1 && <><div className="field-label">EVOLUCIÓN · {firstYear}–{lastYear}</div><svg className="temperature-chart" viewBox="0 0 260 80" role="img" aria-label={`Evolución anual de ${selected?.properties.name}: de ${series[0].celsius.toFixed(2)} a ${series[series.length - 1].celsius.toFixed(2)} grados Celsius`}><line x1="0" y1="67" x2="260" y2="67" stroke="#4a737a" /><polyline points={points} fill="none" stroke="#88e5db" strokeWidth="2.5" /></svg><div className="year-ends"><span>{firstYear}</span><span>{lastYear}</span></div></>}
        <div className="temperature-history" role="region" aria-label="Tabla de temperatura anual de la zona seleccionada"><table><thead><tr><th>Año</th><th>Temperatura</th></tr></thead><tbody>{series.map(row => <tr key={row.year} className={row.year === year ? 'selected' : ''}><td>{row.year}</td><td>{row.celsius.toFixed(2)} °C</td></tr>)}</tbody></table></div>
        <button type="button" className="view-switch export-button" onClick={downloadCsv}>Descargar tabla completa (CSV) ↓</button>
        <p className="source-note">Datos: <a href="https://www.ncei.noaa.gov/products/extended-reconstructed-sst" target="_blank" rel="noreferrer">NOAA ERSSTv6</a>. Zonas: <a href="https://www.marineregions.org/" target="_blank" rel="noreferrer">VLIZ / IHO Sea Areas v3</a>. Son temperaturas en °C, no anomalías ni predicciones.</p>
      </aside>
    </main>
    <footer className="site-footer"><span>OCÉANO EN MOVIMIENTO © PROTOTIPO</span><span>NOAA ERSSTv6 · IHO / VLIZ CC BY 4.0</span><span>{areas.length} ZONAS</span></footer>
  </div>;
}
