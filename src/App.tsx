import { useState } from 'react';
import { MapView } from './MapView';
import { species } from './data';
import pilot from './data/observations/loggerhead-west-med.json';

const groups = [
  { id: 'fish', label: 'PECES' },
  { id: 'cetacean', label: 'CETÁCEOS' },
  { id: 'reptile', label: 'REPTILES' },
  { id: 'other', label: 'OTRAS ESPECIES' }
] as const;

export default function App() {
  const [selectedId, setSelectedId] = useState('loggerhead-turtle');
  const selected = species.find(item => item.id === selectedId) ?? species[0];
  const realLayer = selected.id === 'loggerhead-turtle';

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="identity"><div className="mark" aria-hidden="true"><span>≈</span></div><div><div className="eyebrow">ATLAS EXPERIMENTAL / 01</div><h1>Océano <em>en Movimiento</em></h1></div></div>
        <div className="header-right"><span className="header-line" /><span>{realLayer ? 'OBSERVACIONES DOCUMENTADAS' : 'EXPLORAR EL CAMBIO POSIBLE'}</span><span className="scenario-pill">{realLayer ? 'OBIS · 2013–2017' : 'ESCENARIO  SSP2-4.5'}</span></div>
      </header>

      <main className="workspace">
        <aside className="selector-panel" aria-label="Selección de especie">
          <div className="section-index">01 / EXPLORAR</div>
          <h2>Un océano.<br /><em>Muchas posibilidades.</em></h2>
          <p className="intro">La tortuga boba muestra avistamientos reales de OBIS. Las demás especies siguen siendo ejemplos visuales de cómo podría verse un mapa futuro.</p>
          <div className="fine-rule" />
          <label className="field-label" htmlFor="species-select">SELECCIONA UNA ESPECIE</label>
          <select id="species-select" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
            {species.map(item => <option value={item.id} key={item.id}>{item.commonNameEs}</option>)}
          </select>
          <div className="species-list" aria-label="Especies disponibles">
            {groups.filter(group => species.some(item => group.id === 'other' ? !item.group : item.group === group.id)).map(group => <div className="species-group" key={group.id}>
              <div className="species-group-label">{group.label}</div>
              {species.filter(item => group.id === 'other' ? !item.group : item.group === group.id).map(item => <button key={item.id} type="button" className={`species-row ${selected.id === item.id ? 'active' : ''}`} aria-pressed={selected.id === item.id} onClick={() => setSelectedId(item.id)}>
                <span className="species-number">{String(species.indexOf(item) + 1).padStart(2, '0')}</span><span className="species-text"><strong>{item.commonNameEs}</strong><small>{item.scientificName}</small></span><span className="species-arrow" aria-hidden="true">↗</span>
              </button>)}
            </div>)}
          </div>
          <div className="sidebar-bottom"><span className="asterisk">✳</span><p>{realLayer ? <><strong>Datos observados.</strong> Puntos de un solo transecto de ferry, con gran incertidumbre espacial. No describen toda la distribución.</> : <><strong>Datos de demostración.</strong> Celdas inventadas. No son previsiones científicas ni trayectorias reales.</>}</p></div>
        </aside>

        <section className="map-panel" aria-label="Comparación de hábitat">
          <div className="map-header"><div><div className="section-index">02 / VISUALIZAR</div><h2>{realLayer ? 'Avistamientos en el Mediterráneo occidental' : 'Un océano en movimiento'}</h2></div><div className="coordinates">{realLayer ? pilot.period : <>ACTUAL <span>→</span> 2050</>}</div></div>
          <div className="map-stage">
            <MapView selected={selected} />
            {realLayer ? <div className="flow-key real-key" aria-label="Los puntos muestran avistamientos documentados, con ubicación aproximada"><span><i className="flow-key-current" /> {pilot.summary.count} avistamientos · ubicación aproximada</span></div> : <div className="flow-key" aria-label="Turquesa: hábitat actual; rosa: hábitat en 2050">
              <span><i className="flow-key-current" /> Actual</span>
              <b aria-hidden="true">→</b>
              <span><i className="flow-key-future" /> 2050</span>
              <small>TRAMA ILUSTRATIVA</small>
            </div>}
          </div>
          <div className="map-bottom"><div className="legend">{realLayer ? <span className="legend-title">OBIS · {pilot.period} · OBSERVACIONES, NO PREDICCIÓN</span> : <><span className="legend-title">IDONEIDAD DEL HÁBITAT · ÍNDICE ILUSTRATIVO</span><div className="legend-swatches"><i /><i /><i /></div><span className="legend-values">BAJA <b>→</b> ALTA</span></>}</div><span className="map-hint">Arrastra para mover · desplázate para ampliar</span></div>
        </section>

        <aside className="info-panel" aria-label="Información de la especie">
          <div className="section-index">03 / COMPRENDER</div>
          <div className="info-tag"><span /> ESPECIE SELECCIONADA</div>
          <h2>{selected.commonNameEs}</h2>
          <p className="latin">{selected.scientificName}</p>
          <div className="cyan-rule" />
          <p className="lead">{selected.summaryEs}</p>
          <p className="body-copy">{realLayer ? 'Avistamientos visuales desde ferris en el trayecto Barcelona–Civitavecchia. Cada punto representa un registro de presencia: la falta de puntos no significa ausencia de tortugas.' : selected.ecologyEs}</p>
          <div className="metric-block"><div><span>{realLayer ? 'REGISTROS' : 'PERIODOS'}</span><strong>{realLayer ? pilot.summary.count : 'Actual → 2050'}</strong></div><div><span>{realLayer ? 'PERIODO' : 'ESCENARIO'}</span><strong>{realLayer ? pilot.period : 'SSP2-4.5'}</strong></div></div>
          {realLayer ? <div className="info-note"><span className="note-icon">◎</span><div><strong>Cómo leer estos puntos</strong><p>La fuente declara entre {pilot.summary.uncertaintyKmRange[0]} y {pilot.summary.uncertaintyKmRange[1]} km de incertidumbre en las coordenadas. El muestreo sigue una ruta de ferry; estos puntos no estiman abundancia, distribución total ni movimientos futuros.</p></div></div> : <div className="info-note"><span className="note-icon">↗</span><div><strong>Cómo leer este flujo</strong><p>Cada trazo va de su celda actual a la pareja de 2050 por agua. La curvatura es visual y se reduce junto a la costa para no tocar tierra. Son datos sintéticos: el dibujo no es una ruta animal ni una predicción de navegación.</p></div></div>}
          {realLayer ? <div className="source-note"><strong>Fuente y derechos</strong><p><a href={pilot.source.url} target="_blank" rel="noreferrer">{pilot.source.citation}</a> · datos vía OBIS, <a href={pilot.source.licenseUrl} target="_blank" rel="noreferrer">CC BY 4.0</a>. Se han seleccionado y representado los registros; extracto consultado el {pilot.source.accessedAtUtc.slice(0, 10)}.</p></div> : null}
          <div className="status-label">● {realLayer ? 'CAPA DE OBSERVACIONES · SIN PROYECCIÓN A 2050' : 'MODO ILUSTRATIVO · SIN VALIDACIÓN CIENTÍFICA'}</div>
        </aside>
      </main>
      <footer className="site-footer"><span>OCÉANO EN MOVIMIENTO © PROTOTIPO</span><span>{realLayer ? 'Observaciones: OBIS / ISPRA · CC BY 4.0' : 'Datos sintéticos · Sin afirmaciones científicas'}</span><span>{String(species.findIndex(item => item.id === selected.id) + 1).padStart(2, '0')} / {String(species.length).padStart(2, '0')}</span></footer>
    </div>
  );
}
