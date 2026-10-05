import { useState } from 'react';
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
  link.download = `temperaturas-mares-${firstYear}-${timelineYears.at(-1)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TemperaturePage({ onBack, initialYear = lastYear, initialAreaId = 'med-west' }: { onBack: () => void; initialYear?: number; initialAreaId?: string }) {
  const [year, setYear] = useState(initialYear);
  const [areaId, setAreaId] = useState(initialAreaId);
  const forecastMode = year > lastYear;
  const [worldViewKey, setWorldViewKey] = useState(0);
  const [search, setSearch] = useState('');
  const [showCooling, setShowCooling] = useState(true);
  const [motionPaused, setMotionPaused] = useState(false);
  const values = timelineByYear.get(year) ?? new Map<string, TemperatureRecord>();
  const areas = seaAreas.features.filter(item => values.has(item.properties.id))
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'es'));
  const selected = seaAreas.features.find(item => item.properties.id === areaId);
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const visibleAreas = areas.filter(item => normalize(item.properties.name).includes(normalize(search.trim())));
  const record = values.get(areaId);
  const estimated = record?.method === 'estimated';
  const derivedForecast = record?.forecastBasis === 'estimated-history';
  const areaNames = new Map(seaAreas.features.map(item => [item.properties.id, item.properties.name]));
  const donorNames = record?.estimatedFrom?.map(id => areaNames.get(id)).filter(Boolean).join(' y ');
  const series = timelineSeries(areaId);
  const rangeEnd = timelineYears.at(-1)!;
  type Quality = { mae: number; coverage: number; n: number };
  const quality = (forecastMetadata.testByHorizon as Record<string, Quality>)[String(year-lastYear)];
  const areaQuality = (forecastMetadata.testByArea as Record<string, Quality>)[areaId];

  return <div className="app-shell">
    <header className="site-header"><div className="identity"><div className="mark" aria-hidden="true"><span>≈</span></div><div><div className="eyebrow">ATLAS EXPERIMENTAL / 02</div><h1>Océano <em>en Movimiento</em></h1></div></div><div className="header-right"><span>AGUAS SUPERFICIALES</span><span className="scenario-pill">HISTÓRICO Y PREVISIÓN · {firstYear}–{rangeEnd}</span></div></header>
    <main className="workspace temperature-workspace">
      <aside className="selector-panel" aria-label="Controles de temperaturas">
        <div className="section-index">01 / EXPLORAR</div>
        <h2>La temperatura<br /><em>de cada mar.</em></h2>
        <p className="intro">Explora de 1982 a 2030 en una misma serie. ≈ indica histórico estimado y ↗ predicción desde 2026.</p>
        <button type="button" className="view-switch" onClick={onBack}>← Volver a especies</button>
        <div className="fine-rule" />
        <label className="field-label" htmlFor="temperature-year">AÑO · {year} · {forecastMode ? 'PREDICCIÓN' : 'HISTÓRICO'}</label>
        <input id="temperature-year" className="year-slider" type="range" min={firstYear} max={rangeEnd} value={year} onChange={event => setYear(Number(event.target.value))} />
        <div className="year-ends"><span>{firstYear}</span><span>{rangeEnd}</span></div>
        <p className="timeline-note">Histórico hasta 2025 · predicción 2026–2030 en las 102 zonas.</p>
        <label className="cooling-toggle"><input type="checkbox" checked={showCooling} onChange={event => setShowCooling(event.target.checked)} /><span>Mostrar recorridos hacia mares más fríos</span></label>
        {showCooling && <button type="button" className="view-switch cooling-pause" aria-pressed={motionPaused} onClick={() => setMotionPaused(paused => !paused)}>{motionPaused ? 'Reanudar recorridos' : 'Pausar recorridos'}</button>}
        <p className="cooling-note">Desde su posición, cada punto busca el mar más cercano que sea más frío y accesible por agua. Al llegar, vuelve a buscar. Sin otro más fresco, gira y se desvanece. Es una animación ilustrativa, no una ruta de animales ni una corriente real.</p>
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
        <div className="sidebar-bottom"><span className="asterisk">✳</span><p><strong>Una serie, dos periodos.</strong> Histórico NOAA o estimado hasta 2025; desde 2026, previsiones experimentales. Las zonas estimadas conservan sus zonas base.</p></div>
      </aside>
      <section className="map-panel" aria-label="Mapa de temperaturas marinas">
        <div className="map-header"><div><div className="section-index">02 / VISUALIZAR</div><h2>Temperatura superficial · {year}</h2></div><button type="button" className="world-view-button" onClick={() => setWorldViewKey(key => key + 1)}>Ver mapa mundial</button></div>
        <div className="map-stage"><SeaTemperatureMap year={year} selectedAreaId={areaId} onSelectArea={setAreaId} worldViewKey={worldViewKey} values={values} forecastMode={forecastMode} showCooling={showCooling} motionPaused={motionPaused} /></div>
        <div className="map-bottom"><div className="temperature-legend"><span>FRÍA</span><i /><span>CÁLIDA</span><small>−2 °C → 32 °C</small><span className="estimate-key"><i /> {forecastMode ? '↗ Predicción' : '≈ Estimada'}</span></div><span className="map-hint">Pulsa una zona · arrastra para mover</span></div>
      </section>
      <aside className="info-panel temperature-info" aria-label="Detalle de la zona marítima">
        <div className="section-index">03 / COMPRENDER</div>
        <div className="info-tag"><span /> {forecastMode ? derivedForecast ? 'PREDICCIÓN · BASE ESTIMADA' : 'PREDICCIÓN · BASE NOAA' : estimated ? 'ESTIMACIÓN ANUAL' : 'MEDIA ANUAL NOAA'}</div>
        <h2>{selected?.properties.name ?? 'Selecciona una zona'}</h2>
        <p className="latin">Superficie del mar · {year}</p>
        <div className="cyan-rule" />
        <p className="temperature-value">{record ? formatTemperature(record) : 'Sin datos'}</p>
        {forecastMode && record && <section className="forecast-evidence" aria-label="Calidad de la predicción">
          <p><strong>{forecastModelLabel}</strong></p>
          <p>Histórico hasta 2025 · horizonte {year-lastYear} {year-lastYear === 1 ? 'año' : 'años'}.</p>
          {forecastMetadata.model === 'persistence' && <p>Conserva el valor de 2025: fue la referencia con menor error en las 22 zonas NOAA evaluadas.</p>}
          {derivedForecast ? <>
            <p>Parte del histórico estimado de esta zona y traslada el cambio previsto de {donorNames}.</p>
            <p>Rango derivado de las zonas base: <strong>{record.lower?.toFixed(1)} a {record.upper?.toFixed(1)} °C</strong>. Sin cobertura local validada; no incluye toda la incertidumbre de la estimación histórica.</p>
            <p>Sin prueba con mediciones locales: no se asigna un MAE ni un intervalo calibrado del 90 % a esta zona.</p>
          </> : <>
            <p>Intervalo nominal 90 %: <strong>{record.lower?.toFixed(1)} a {record.upper?.toFixed(1)} °C</strong>. Su cobertura futura no está garantizada.</p>
            <p>Prueba 2021–2025, horizonte {year-lastYear}: MAE {quality?.mae.toFixed(2)} °C · cobertura {(100*(quality?.coverage ?? 0)).toFixed(0)} % en {quality?.n} zonas NOAA.</p>
            <p>Error de esta zona en los cinco años de prueba: {areaQuality?.mae.toFixed(2)} °C de MAE.</p>
          </>}
          <a href="https://github.com/lidonmiguel/ocean-in-motion/blob/main/reports/temperature/REPORT.md" target="_blank" rel="noreferrer">Evaluación y limitaciones ↗</a>
        </section>}
        {!forecastMode && <p className="body-copy">{estimated
          ? `Estimación aproximada basada en ${donorNames}. Se promedian sus medias NOAA y se ajustan por latitud. No hay medición local para esta zona en el conjunto publicado; no la uses como dato observado.`
          : `Media ponderada por superficie de ${record?.cells ?? 0} celdas oceánicas NOAA de 2° con los doce meses del año. Cada mes se pondera según sus días.`}</p>}
        <TemperatureHistoryChart areaId={areaId} selectedYear={year} />
        <div className="temperature-history" role="region" aria-label="Tabla de temperatura anual de la zona seleccionada"><table><thead><tr><th>Año</th><th>Temperatura</th></tr></thead><tbody>{series.map(row => <tr key={row.year} className={row.year === year ? 'selected' : ''}><td>{row.year}{row.method === 'forecast' ? ' · pred.' : ''}</td><td>{formatTemperature(row)}</td></tr>)}</tbody></table></div>
        <button type="button" className="view-switch export-button" onClick={downloadCsv}>Descargar histórico y predicciones (CSV) ↓</button>
        <p className="source-note">Datos observados: <a href="https://www.ncei.noaa.gov/products/extended-reconstructed-sst" target="_blank" rel="noreferrer">NOAA ERSSTv6</a>. Zonas: <a href="https://www.marineregions.org/" target="_blank" rel="noreferrer">VLIZ / IHO Sea Areas v3</a>; contorno del Caspio: Natural Earth. ≈ indica una estimación por zonas vecinas y latitud, no una medición local ni una predicción.</p>
      </aside>
    </main>
    <footer className="site-footer"><span>OCÉANO EN MOVIMIENTO © PROTOTIPO</span><span>HISTÓRICO 1982–2025 · PREVISIÓN EXPERIMENTAL 2026–2030</span><span>{areas.length} ZONAS</span></footer>
  </div>;
}
