import { useState } from 'react';
import { MapView } from './MapView';
import { species } from './data';
import model from './data/model/loggerhead-mediterranean.json';

const groups = [
  { id: 'fish', label: 'PECES' },
  { id: 'cetacean', label: 'CETÁCEOS' },
  { id: 'reptile', label: 'REPTILES' },
  { id: 'other', label: 'OTRAS ESPECIES' }
] as const;

export default function App() {
  const [selectedId, setSelectedId] = useState('loggerhead-turtle');
  const [showModel, setShowModel] = useState(false);
  const selected = species.find(item => item.id === selectedId) ?? species[0];
  const realLayer = selected.id === 'loggerhead-turtle' && showModel;
  const chooseSpecies = (id: string) => { setSelectedId(id); setShowModel(false); };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="identity"><div className="mark" aria-hidden="true"><span>≈</span></div><div><div className="eyebrow">ATLAS EXPERIMENTAL / 01</div><h1>Océano <em>en Movimiento</em></h1></div></div>
        <div className="header-right"><span className="header-line" /><span>{realLayer ? 'DISTRIBUCIÓN MODELADA' : 'EXPLORAR EL CAMBIO POSIBLE'}</span><span className="scenario-pill">{realLayer ? 'MODELO · 2003–2018' : 'ESCENARIO  SSP2-4.5'}</span></div>
      </header>

      <main className="workspace">
        <aside className="selector-panel" aria-label="Selección de especie">
          <div className="section-index">01 / EXPLORAR</div>
          <h2>Un océano.<br /><em>Muchas posibilidades.</em></h2>
          <p className="intro">Explora los flujos visuales de cada especie. Para la tortuga boba también puedes consultar una capa real de distribución modelada en el Mediterráneo.</p>
          <div className="fine-rule" />
          <label className="field-label" htmlFor="species-select">SELECCIONA UNA ESPECIE</label>
          <select id="species-select" value={selectedId} onChange={event => chooseSpecies(event.target.value)}>
            {species.map(item => <option value={item.id} key={item.id}>{item.commonNameEs}</option>)}
          </select>
          <div className="species-list" aria-label="Especies disponibles">
            {groups.filter(group => species.some(item => group.id === 'other' ? !item.group : item.group === group.id)).map(group => <div className="species-group" key={group.id}>
              <div className="species-group-label">{group.label}</div>
              {species.filter(item => group.id === 'other' ? !item.group : item.group === group.id).map(item => <button key={item.id} type="button" className={`species-row ${selected.id === item.id ? 'active' : ''}`} aria-pressed={selected.id === item.id} onClick={() => chooseSpecies(item.id)}>
                <span className="species-number">{String(species.indexOf(item) + 1).padStart(2, '0')}</span><span className="species-text"><strong>{item.commonNameEs}</strong><small>{item.scientificName}</small></span><span className="species-arrow" aria-hidden="true">↗</span>
              </button>)}
            </div>)}
          </div>
          <div className="sidebar-bottom"><span className="asterisk">✳</span><p>{realLayer ? <><strong>Modelo publicado.</strong> Las zonas combinan transectos y variables ambientales. No son rutas ni un pronóstico de 2050.</> : <><strong>Datos de demostración.</strong> Celdas inventadas. No son previsiones científicas ni trayectorias reales.</>}</p></div>
        </aside>

        <section className="map-panel" aria-label="Comparación de hábitat">
          <div className="map-header"><div><div className="section-index">02 / VISUALIZAR</div><h2>{realLayer ? 'Zonas estimadas en el Mediterráneo' : 'Un océano en movimiento'}</h2></div><div className="map-header-actions">{selected.id === 'loggerhead-turtle' && <button className="view-switch" type="button" onClick={() => setShowModel(value => !value)}>{realLayer ? '← Volver al flujo' : 'Ver modelo científico →'}</button>}<div className="coordinates">{realLayer ? '2003–2018' : <>ACTUAL <span>→</span> 2050</>}</div></div></div>
          <div className="map-stage">
            <MapView selected={selected} showModel={realLayer} />
            {realLayer ? <div className="flow-key real-key" aria-label="Colores: abundancia relativa modelada de menor a mayor"><span><i className="density-key" /> Zonas modeladas · menor → mayor</span></div> : <div className="flow-key" aria-label="Turquesa: hábitat actual; rosa: hábitat en 2050">
              <span><i className="flow-key-current" /> Actual</span>
              <b aria-hidden="true">→</b>
              <span><i className="flow-key-future" /> 2050</span>
              <small>TRAMA ILUSTRATIVA</small>
            </div>}
          </div>
          <div className="map-bottom"><div className="legend">{realLayer ? <span className="legend-title">ABUNDANCIA RELATIVA MODELADA · SIN COLOR = SIN ESTIMACIÓN</span> : <><span className="legend-title">IDONEIDAD DEL HÁBITAT · ÍNDICE ILUSTRATIVO</span><div className="legend-swatches"><i /><i /><i /></div><span className="legend-values">BAJA <b>→</b> ALTA</span></>}</div><span className="map-hint">Arrastra para mover · desplázate para ampliar</span></div>
        </section>

        <aside className="info-panel" aria-label="Información de la especie">
          <div className="section-index">03 / COMPRENDER</div>
          <div className="info-tag"><span /> ESPECIE SELECCIONADA</div>
          <h2>{selected.commonNameEs}</h2>
          <p className="latin">{selected.scientificName}</p>
          <div className="cyan-rule" />
          <p className="lead">{selected.summaryEs}</p>
          <p className="body-copy">{realLayer ? 'Estimación media anual basada en transectos aéreos y desde barcos entre 2003 y 2018. Los colores comparan valores relativos del modelo; no son ubicaciones exactas ni límites de hábitat.' : selected.ecologyEs}</p>
          <div className="metric-block"><div><span>{realLayer ? 'ÁMBITO' : 'PERIODOS'}</span><strong>{realLayer ? 'Mediterráneo' : 'Actual → 2050'}</strong></div><div><span>{realLayer ? 'PERIODO' : 'ESCENARIO'}</span><strong>{realLayer ? '2003–2018' : 'SSP2-4.5'}</strong></div></div>
          {realLayer ? <div className="info-note"><span className="note-icon">◎</span><div><strong>Cómo leer estas zonas</strong><p>Más claro significa un valor relativo más alto en el modelo. En lugares sin muestreo se extrapoló; zonas sin color carecen de estimación. La fuente advierte posibles diferencias de ubicación y valor al reproyectar el modelo. Esto no predice 2050 ni rutas de animales.</p></div></div> : <div className="info-note"><span className="note-icon">↗</span><div><strong>Cómo leer este flujo</strong><p>Cada trazo va de su celda actual a la pareja de 2050 por agua. La curvatura es visual y se reduce junto a la costa para no tocar tierra. Son datos sintéticos: el dibujo no es una ruta animal ni una predicción de navegación.</p></div></div>}
          {realLayer ? <div className="source-note"><strong>Fuente del modelo</strong><p><a href={model.source.modelUrl} target="_blank" rel="noreferrer">{model.source.citation}</a> · <a href={model.source.url} target="_blank" rel="noreferrer">datos reproyectados por EMODnet Biology</a>. <a href={model.source.publicationUrl} target="_blank" rel="noreferrer">Estudio y método</a>. Distribución pública con atribución.</p></div> : null}
          <div className="status-label">● {realLayer ? 'DISTRIBUCIÓN MODELADA · SIN PROYECCIÓN A 2050' : 'MODO ILUSTRATIVO · SIN VALIDACIÓN CIENTÍFICA'}</div>
        </aside>
      </main>
      <footer className="site-footer"><span>OCÉANO EN MOVIMIENTO © PROTOTIPO</span><span>{realLayer ? 'Modelo: Sparks y DiMatteo / NUWC · EMODnet Biology' : 'Datos sintéticos · Sin afirmaciones científicas'}</span><span>{String(species.findIndex(item => item.id === selected.id) + 1).padStart(2, '0')} / {String(species.length).padStart(2, '0')}</span></footer>
    </div>
  );
}
