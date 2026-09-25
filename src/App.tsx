import { useState } from 'react';
import { MapView } from './MapView';
import { species } from './data';
import type { Period } from './data/schema';

export default function App() {
  const [selectedId, setSelectedId] = useState(species[0].id);
  const [period, setPeriod] = useState<Period>('current');
  const selected = species.find(item => item.id === selectedId) ?? species[0];

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="identity"><div className="mark" aria-hidden="true"><span>≈</span></div><div><div className="eyebrow">ATLAS EXPERIMENTAL / 01</div><h1>Océano <em>en Movimiento</em></h1></div></div>
        <div className="header-right"><span className="header-line" /><span>EXPLORAR EL CAMBIO POSIBLE</span><span className="scenario-pill">ESCENARIO&nbsp; SSP2-4.5</span></div>
      </header>

      <main className="workspace">
        <aside className="selector-panel" aria-label="Selección de especie">
          <div className="section-index">01 / EXPLORAR</div>
          <h2>Un océano.<br /><em>Muchas posibilidades.</em></h2>
          <p className="intro">Explora cómo podría cambiar el hábitat adecuado para distintas especies marinas hacia 2050.</p>
          <div className="fine-rule" />
          <label className="field-label" htmlFor="species-select">SELECCIONA UNA ESPECIE</label>
          <select id="species-select" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
            {species.map(item => <option value={item.id} key={item.id}>{item.commonNameEs}</option>)}
          </select>
          <div className="species-list" aria-label="Especies disponibles">
            {species.map((item, index) => <button key={item.id} type="button" className={`species-row ${selected.id === item.id ? 'active' : ''}`} aria-pressed={selected.id === item.id} onClick={() => setSelectedId(item.id)}>
              <span className="species-number">0{index + 1}</span><span className="species-text"><strong>{item.commonNameEs}</strong><small>{item.scientificName}</small></span><span className="species-arrow" aria-hidden="true">↗</span>
            </button>)}
          </div>
          <div className="sidebar-bottom"><span className="asterisk">✳</span><p><strong>Datos de demostración.</strong> Celdas inventadas. No son previsiones científicas ni trayectorias reales.</p></div>
        </aside>

        <section className="map-panel" aria-label="Comparación de hábitat">
          <div className="map-header"><div><div className="section-index">02 / VISUALIZAR</div><h2>El mapa de lo posible</h2></div><div className="coordinates">GLOBAL <span>●</span> 180° O — 180° E</div></div>
          <div className="map-stage">
            <MapView selected={selected} period={period} />
            <div className="period-control" role="group" aria-label="Comparar periodos">
              <button type="button" className={period === 'current' ? 'selected' : ''} aria-pressed={period === 'current'} onClick={() => setPeriod('current')}><span>01</span> Actual</button>
              <span className="period-divider" aria-hidden="true">→</span>
              <button type="button" className={period === 'future' ? 'selected' : ''} aria-pressed={period === 'future'} onClick={() => setPeriod('future')}><span>02</span> 2050</button>
            </div>
          </div>
          <div className="map-bottom"><div className="legend"><span className="legend-title">IDONEIDAD DEL HÁBITAT · ÍNDICE ILUSTRATIVO</span><div className="legend-swatches"><i /><i /><i /></div><span className="legend-values">BAJA <b>→</b> ALTA</span></div><span className="map-hint">Arrastra para mover · desplázate para ampliar</span></div>
        </section>

        <aside className="info-panel" aria-label="Información de la especie">
          <div className="section-index">03 / COMPRENDER</div>
          <div className="info-tag"><span /> ESPECIE SELECCIONADA</div>
          <h2>{selected.commonNameEs}</h2>
          <p className="latin">{selected.scientificName}</p>
          <div className="cyan-rule" />
          <p className="lead">{selected.summaryEs}</p>
          <p className="body-copy">{selected.ecologyEs}</p>
          <div className="metric-block"><div><span>PERIODO</span><strong>{period === 'current' ? 'Actual' : '2050'}</strong></div><div><span>ESCENARIO</span><strong>SSP2-4.5</strong></div></div>
          <div className="info-note"><span className="note-icon">↗</span><div><strong>Cómo leer este mapa</strong><p>Los recuadros muestran valores de idoneidad inventados (0–1). La línea magenta en 2050 indica solo una dirección ilustrativa de cambio en la distribución; no es una ruta GPS de animales.</p></div></div>
          <div className="status-label">● MODO ILUSTRATIVO · SIN VALIDACIÓN CIENTÍFICA</div>
        </aside>
      </main>
      <footer className="site-footer"><span>OCÉANO EN MOVIMIENTO © PROTOTIPO</span><span>Datos sintéticos · Sin afirmaciones científicas</span><span>01 / 03</span></footer>
    </div>
  );
}
