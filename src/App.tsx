import { useState } from 'react';
import { MapView } from './MapView';
import { species } from './data';
import { categories, categorySpeciesColors } from './data/categoryViews';

const groups = [
  { id: 'fish', label: 'PECES' },
  { id: 'cetacean', label: 'MAMÍFEROS MARINOS' },
  { id: 'reptile', label: 'REPTILES MARINOS' },
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
  const [showBoxes, setShowBoxes] = useState(true);
  const category = categories.find(item => item.selectionId === selectedId);
  const selected = category?.view ?? species.find(item => item.id === selectedId) ?? species[0];
  const selectView = (id: string) => { setSelectedId(id); setFocusBoxId(null); };
  const observationLayer = selected.provenance === 'observation-demo';
  const observations = selected.occurrence;
  const sourceCount = observations?.sources.length ?? 0;
  const visualDestinations = selected.habitat.future.length;
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
          <p className="intro">Cada caja actual agrupa avistamientos regionales. Los destinos rosas quedan fuera de las zonas observadas de la especie, pero siguen siendo una simulación visual, no una predicción.</p>
          <div className="fine-rule" />
          <label className="field-label" htmlFor="species-select">SELECCIONA ESPECIE O GRUPO</label>
          <select id="species-select" value={selectedId} onChange={event => selectView(event.target.value)}>
            {categories.map(item => <option value={item.selectionId} key={item.selectionId}>{item.label}</option>)}
            {species.map(item => <option value={item.id} key={item.id}>{item.commonNameEs}</option>)}
          </select>
          <div className="species-list" aria-label="Especies disponibles">
            {groups.filter(group => species.some(item => group.id === 'other' ? !item.group : item.group === group.id)).map(group => <div className="species-group" key={group.id}>
              <div className="species-group-heading"><div className="species-group-label">{group.label}</div>{categories.filter(item => item.group === group.id).map(item => <button key={item.selectionId} type="button" className={`category-select ${category?.selectionId === item.selectionId ? 'active' : ''}`} aria-pressed={category?.selectionId === item.selectionId} onClick={() => selectView(item.selectionId)}>Ver todos ↗</button>)}</div>
              {species.filter(item => group.id === 'other' ? !item.group : item.group === group.id).map(item => <button key={item.id} type="button" className={`species-row ${selected.id === item.id ? 'active' : ''}`} aria-pressed={selected.id === item.id} onClick={() => selectView(item.id)}>
                <span className="species-number">{String(species.indexOf(item) + 1).padStart(2, '0')}</span><span className="species-text"><strong>{item.commonNameEs}</strong><small>{item.scientificName}</small></span><span className="species-arrow" aria-hidden="true">↗</span>
              </button>)}
            </div>)}
          </div>
          <div className="sidebar-bottom"><span className="asterisk">✳</span><p>{observationLayer ? <><strong>Origen real, destino ilustrativo.</strong> {sourceCount === 1 ? 'La caja actual se calcula' : 'Las cajas actuales se calculan'} con OBIS. El desplazamiento no se ha predicho con un modelo.</> : <><strong>Datos de demostración.</strong> Celdas inventadas. No son previsiones científicas ni trayectorias reales.</>}</p></div>
        </aside>

        <section className="map-panel" aria-label="Comparación de hábitat">
          <div className="map-header"><div><div className="section-index">02 / VISUALIZAR</div><h2>{observationLayer ? 'Avistamientos y simulación visual' : 'Un océano en movimiento'}</h2></div><label className="box-toggle"><input type="checkbox" checked={showBoxes} onChange={event => setShowBoxes(event.target.checked)} /><span>Mostrar cajas</span></label><div className="coordinates">{observationLayer ? <>REGISTROS <span>→</span> SIMULACIÓN</> : <>ACTUAL <span>→</span> 2050</>}</div></div>
          <div className="map-stage">
            <MapView selected={selected} focusBoxId={focusBoxId} showBoxes={showBoxes} />
            <div className="flow-key" aria-label={observationLayer ? `${showBoxes ? 'Cajas de color con registros' : 'Centros de zonas con registros'}; rosa: destino simulado` : 'Turquesa: hábitat actual; rosa: hábitat en 2050'}>
              <span><i className="flow-key-current" /> {observationLayer ? showBoxes ? 'Zonas con registros' : 'Centros de zonas' : 'Actual'}</span>
              <b aria-hidden="true">→</b>
              <span><i className="flow-key-future" /> {observationLayer ? 'Simulación' : '2050'}</span>
              <small>{observationLayer ? 'FUTURO NO PREDICHO' : 'TRAMA ILUSTRATIVA'}</small>
            </div>
          </div>
          <div className="map-bottom"><div className="legend">{observationLayer ? <span className="legend-title">{sourceCount} {sourceCount === 1 ? 'ZONA' : 'ZONAS'} {showBoxes ? '' : 'OCULTAS'} · {observations?.count} REGISTROS · {visualDestinations} DESTINOS ILUSTRATIVOS</span> : <><span className="legend-title">IDONEIDAD DEL HÁBITAT · ÍNDICE ILUSTRATIVO</span><div className="legend-swatches"><i /><i /><i /></div><span className="legend-values">BAJA <b>→</b> ALTA</span></>}</div><span className="map-hint">Arrastra para mover · desplázate para ampliar</span></div>
        </section>

        <aside className="info-panel" aria-label="Información de la especie">
          <div className="section-index">03 / COMPRENDER</div>
          <div className="info-tag"><span /> {category ? 'GRUPO SELECCIONADO' : 'ESPECIE SELECCIONADA'}</div>
          <h2>{selected.commonNameEs}</h2>
          <p className="latin">{category ? `${category.members.length} especies` : selected.scientificName}</p>
          <div className="cyan-rule" />
          <p className="lead">{selected.summaryEs}</p>
          <p className="body-copy">{selected.ecologyEs}</p>
          <div className="metric-block"><div><span>{observationLayer ? 'REGISTROS' : 'PERIODOS'}</span><strong>{observationLayer ? observations?.count : 'Actual → 2050'}</strong></div><div><span>{observationLayer ? 'PERIODO' : 'ESCENARIO'}</span><strong>{observationLayer ? selected.periods.current : 'SSP2-4.5'}</strong></div></div>
          {category && <div className="category-key" aria-label="Colores de las especies">{category.members.map(member => <span key={member.id}><i style={{ backgroundColor: `rgb(${categorySpeciesColors[member.id].join(',')})` }} />{member.commonNameEs}</span>)}</div>}
          {observationLayer ? <div className="info-note"><span className="note-icon">◎</span><div><strong>{showBoxes ? `Cómo leer ${sourceCount === 1 ? 'esta caja' : 'estas cajas'}` : 'Cajas ocultas'}</strong><p>{showBoxes ? `${boxLabel} ${observations?.count} registros en zonas documentadas. Cada caja resume posiciones notificadas, no todo el hábitat.` : 'Los puntos marcan centros de zonas con registros; los trazos siguen visibles. Puedes mostrar las cajas de nuevo.'} Los destinos rosas evitan las zonas actuales de esa especie; son ilustrativos y algunas zonas no tienen destino visual.{category ? ' Las especies se muestran juntas, sin inferir que comparten hábitat.' : ''}</p></div></div> : <div className="info-note"><span className="note-icon">↗</span><div><strong>Cómo leer este flujo</strong><p>Cada trazo conecta dos celdas por agua. No es la ruta de un animal.</p></div></div>}
          {observationLayer && observations && <div className="source-note"><strong>Zonas documentadas</strong>{sourceCount > 1 && <button type="button" className="all-regions" onClick={() => setFocusBoxId(null)} disabled={!focusBoxId}>Ver todas</button>}<div className="source-regions" role="region" aria-label="Zonas documentadas">{observations.sources.map(source => <div className="source-region" key={source.boxId}><button type="button" className="source-region-button" aria-pressed={focusBoxId === source.boxId} onClick={() => setFocusBoxId(source.boxId)}>{source.region} ↗</button><span>{source.count} {source.count === 1 ? 'registro' : 'registros'} · {coordinateUncertainty(source.coordinateUncertaintyKmRange)}{source.simulationOffsetDeg === null ? ' · sin destino ilustrativo' : ''}</span></div>)}</div><details><summary>Fuentes y licencias</summary>{observations.sources.filter((source, index, sources) => sources.findIndex(other => other.datasetId === source.datasetId) === index).map(source => <p key={source.datasetId}><a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.citation}</a> · {source.license}.</p>)}</details></div>}
          <div className="status-label">● {observationLayer ? `ZONAS DE AVISTAMIENTOS REALES · ${showBoxes ? 'CAJAS VISIBLES' : 'CAJAS OCULTAS'} · FUTURO SIMULADO` : 'MODO ILUSTRATIVO · SIN VALIDACIÓN CIENTÍFICA'}</div>
        </aside>
      </main>
      <footer className="site-footer"><span>OCÉANO EN MOVIMIENTO © PROTOTIPO</span><span>{observationLayer ? 'Avistamientos: OBIS · Futuro ilustrativo' : 'Sin afirmaciones científicas'}</span><span>{category ? category.shortLabel.toUpperCase() : `${String(species.findIndex(item => item.id === selected.id) + 1).padStart(2, '0')} / ${String(species.length).padStart(2, '0')}`}</span></footer>
    </div>
  );
}
