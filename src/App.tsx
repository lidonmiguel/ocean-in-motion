import { useState } from 'react';
import { MapView } from './MapView';
import { species } from './data';

const groups = [
  { id: 'fish', label: 'PECES' },
  { id: 'cetacean', label: 'CETÁCEOS' },
  { id: 'reptile', label: 'REPTILES' },
  { id: 'other', label: 'OTRAS ESPECIES' }
] as const;

function coordinateUncertainty(range: [number, number] | null): string {
  if (!range) return 'Incertidumbre espacial no declarada.';
  if (range[1] < 1) {
    const [low, high] = range.map(value => Math.round(value * 1000));
    return `Incertidumbre declarada: ${low === high ? low : `${low}–${high}`} m.`;
  }
  return `Incertidumbre declarada: ${range[0] === range[1] ? range[0] : `${range[0]}–${range[1]}`} km.`;
}

export default function App() {
  const [selectedId, setSelectedId] = useState('loggerhead-turtle');
  const [focusBoxId, setFocusBoxId] = useState<string | null>(null);
  const selected = species.find(item => item.id === selectedId) ?? species[0];
  const observationLayer = selected.provenance === 'observation-demo';
  const observations = selected.occurrence;
  const sourceCount = observations?.sources.length ?? 0;
  const boxLabel = sourceCount === 1 ? 'Una caja engloba' : `${sourceCount} cajas engloban`;

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="identity"><div className="mark" aria-hidden="true"><span>≈</span></div><div><div className="eyebrow">ATLAS EXPERIMENTAL / 01</div><h1>Océano <em>en Movimiento</em></h1></div></div>
        <div className="header-right"><span className="header-line" /><span>{observationLayer ? 'AVISTAMIENTOS DOCUMENTADOS' : 'EXPLORAR EL CAMBIO POSIBLE'}</span><span className="scenario-pill">{observationLayer ? `OBIS · ${selected.periods.current}` : 'ESCENARIO  SSP2-4.5'}</span></div>
      </header>

      <main className="workspace">
        <aside className="selector-panel" aria-label="Selección de especie">
          <div className="section-index">01 / EXPLORAR</div>
          <h2>Un océano.<br /><em>Muchas posibilidades.</em></h2>
          <p className="intro">Cada caja turquesa agrupa posiciones de avistamientos cercanos. Las cajas rosas y los flujos son una simulación visual: todavía no predicen el futuro.</p>
          <div className="fine-rule" />
          <label className="field-label" htmlFor="species-select">SELECCIONA UNA ESPECIE</label>
          <select id="species-select" value={selectedId} onChange={event => { setSelectedId(event.target.value); setFocusBoxId(null); }}>
            {species.map(item => <option value={item.id} key={item.id}>{item.commonNameEs}</option>)}
          </select>
          <div className="species-list" aria-label="Especies disponibles">
            {groups.filter(group => species.some(item => group.id === 'other' ? !item.group : item.group === group.id)).map(group => <div className="species-group" key={group.id}>
              <div className="species-group-label">{group.label}</div>
              {species.filter(item => group.id === 'other' ? !item.group : item.group === group.id).map(item => <button key={item.id} type="button" className={`species-row ${selected.id === item.id ? 'active' : ''}`} aria-pressed={selected.id === item.id} onClick={() => { setSelectedId(item.id); setFocusBoxId(null); }}>
                <span className="species-number">{String(species.indexOf(item) + 1).padStart(2, '0')}</span><span className="species-text"><strong>{item.commonNameEs}</strong><small>{item.scientificName}</small></span><span className="species-arrow" aria-hidden="true">↗</span>
              </button>)}
            </div>)}
          </div>
          <div className="sidebar-bottom"><span className="asterisk">✳</span><p>{observationLayer ? <><strong>Origen real, destino ilustrativo.</strong> {sourceCount === 1 ? 'La caja actual se calcula' : 'Las cajas actuales se calculan'} con OBIS. El desplazamiento no se ha predicho con un modelo.</> : <><strong>Datos de demostración.</strong> Celdas inventadas. No son previsiones científicas ni trayectorias reales.</>}</p></div>
        </aside>

        <section className="map-panel" aria-label="Comparación de hábitat">
          <div className="map-header"><div><div className="section-index">02 / VISUALIZAR</div><h2>{observationLayer ? 'Avistamientos y simulación visual' : 'Un océano en movimiento'}</h2></div><div className="coordinates">{observationLayer ? <>REGISTROS <span>→</span> SIMULACIÓN</> : <>ACTUAL <span>→</span> 2050</>}</div></div>
          <div className="map-stage">
            <MapView selected={selected} focusBoxId={focusBoxId} />
            <div className="flow-key" aria-label={observationLayer ? 'Turquesa: caja que engloba los registros; rosa: caja simulada' : 'Turquesa: hábitat actual; rosa: hábitat en 2050'}>
              <span><i className="flow-key-current" /> {observationLayer ? 'Avistamientos' : 'Actual'}</span>
              <b aria-hidden="true">→</b>
              <span><i className="flow-key-future" /> {observationLayer ? 'Simulación' : '2050'}</span>
              <small>{observationLayer ? 'FUTURO NO PREDICHO' : 'TRAMA ILUSTRATIVA'}</small>
            </div>
          </div>
          <div className="map-bottom"><div className="legend">{observationLayer ? <span className="legend-title">{sourceCount} {sourceCount === 1 ? 'CAJA' : 'CAJAS'} · {observations?.count} REGISTROS · DESTINO ILUSTRATIVO</span> : <><span className="legend-title">IDONEIDAD DEL HÁBITAT · ÍNDICE ILUSTRATIVO</span><div className="legend-swatches"><i /><i /><i /></div><span className="legend-values">BAJA <b>→</b> ALTA</span></>}</div><span className="map-hint">Arrastra para mover · desplázate para ampliar</span></div>
        </section>

        <aside className="info-panel" aria-label="Información de la especie">
          <div className="section-index">03 / COMPRENDER</div>
          <div className="info-tag"><span /> ESPECIE SELECCIONADA</div>
          <h2>{selected.commonNameEs}</h2>
          <p className="latin">{selected.scientificName}</p>
          <div className="cyan-rule" />
          <p className="lead">{selected.summaryEs}</p>
          <p className="body-copy">{selected.ecologyEs}</p>
          <div className="metric-block"><div><span>{observationLayer ? 'REGISTROS' : 'PERIODOS'}</span><strong>{observationLayer ? observations?.count : 'Actual → 2050'}</strong></div><div><span>{observationLayer ? 'PERIODO' : 'ESCENARIO'}</span><strong>{observationLayer ? selected.periods.current : 'SSP2-4.5'}</strong></div></div>
          {observationLayer ? <div className="info-note"><span className="note-icon">◎</span><div><strong>Cómo leer {sourceCount === 1 ? 'esta caja' : 'estas cajas'}</strong><p>{boxLabel} {observations?.count} registros en zonas documentadas. Cada caja resume posiciones notificadas, no todo el hábitat. Las rosas ilustran destinos que no proceden de OBIS ni de una predicción.</p></div></div> : <div className="info-note"><span className="note-icon">↗</span><div><strong>Cómo leer este flujo</strong><p>Cada trazo conecta dos celdas por agua. No es la ruta de un animal.</p></div></div>}
          {observationLayer && observations && <div className="source-note"><strong>Zonas documentadas</strong>{sourceCount > 1 && <button type="button" className="all-regions" onClick={() => setFocusBoxId(null)} disabled={!focusBoxId}>Ver todas</button>}{observations.sources.map(source => <div className="source-region" key={source.boxId}><button type="button" className="source-region-button" aria-pressed={focusBoxId === source.boxId} onClick={() => setFocusBoxId(source.boxId)}>{source.region} ↗</button><span>{source.count} {source.count === 1 ? 'registro' : 'registros'} · {coordinateUncertainty(source.coordinateUncertaintyKmRange)}</span></div>)}<details><summary>Fuentes y licencias</summary>{observations.sources.filter((source, index, sources) => sources.findIndex(other => other.datasetId === source.datasetId) === index).map(source => <p key={source.datasetId}><a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.citation}</a> · {source.license}.</p>)}</details></div>}
          <div className="status-label">● {observationLayer ? `${sourceCount === 1 ? 'CAJA' : 'CAJAS'} DE AVISTAMIENTOS REALES · FUTURO SIMULADO` : 'MODO ILUSTRATIVO · SIN VALIDACIÓN CIENTÍFICA'}</div>
        </aside>
      </main>
      <footer className="site-footer"><span>OCÉANO EN MOVIMIENTO © PROTOTIPO</span><span>{observationLayer ? 'Avistamientos: OBIS · Futuro ilustrativo' : 'Sin afirmaciones científicas'}</span><span>{String(species.findIndex(item => item.id === selected.id) + 1).padStart(2, '0')} / {String(species.length).padStart(2, '0')}</span></footer>
    </div>
  );
}
