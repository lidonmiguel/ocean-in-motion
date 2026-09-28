import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { MapLibreOverlay } from '@deck.gl/maplibre';
import { GeoJsonLayer, PathLayer, PolygonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { feature } from 'topojson-client';
import world from 'world-atlas/land-110m.json';
import { displayAreas, suitabilityColor, type DisplayCell } from './data/mapData';
import { displayFlows, displayStreamlines, flowSection, visibleFlowWindow, type DisplayFlow } from './data/flowData';
import { categorySpeciesColors, categorySpeciesId } from './data/categoryViews';
import { mapPresentation, type MapPresentation } from './data/mapPresentation';
import type { SpeciesDataset } from './data/schema';
import 'maplibre-gl/dist/maplibre-gl.css';

const topology = world as unknown as Parameters<typeof feature>[0];
const land = feature(topology, topology.objects.land);
const fallbackWidth = 1200;
const fallbackHeight = 560;

function fallbackLandPath(position: (longitude: number, latitude: number) => [number, number]): string {
  const features = land.type === 'FeatureCollection' ? land.features : [land];
  const ringPath = (ring: number[][]) => ring.map(([lon, lat], index) => {
    const [x, y] = position(lon, lat);
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join('') + 'Z';
  return features.flatMap(item => {
    if (item.geometry?.type === 'Polygon') return item.geometry.coordinates.map(ringPath);
    if (item.geometry?.type === 'MultiPolygon') return item.geometry.coordinates.flatMap(polygon => polygon.map(ringPath));
    return [];
  }).join('');
}

function illustrativeFallback(presentation: MapPresentation, focusBoxId: string | null, streamlines: DisplayFlow[]) {
  const currentAreas = presentation.kind === 'observations' ? presentation.observedAreas : presentation.currentHabitat;
  const destinationAreas = presentation.kind === 'observations' ? presentation.illustrativeDestinations : presentation.futureHabitat;
  const cells = [...currentAreas, ...destinationAreas].filter(cell => !focusBoxId || cell.id === focusBoxId);
  const margin = focusBoxId ? 1 : 6;
  const west = Math.min(...cells.map(cell => cell.center[0] - cell.widthDeg / 2)) - margin;
  const east = Math.max(...cells.map(cell => cell.center[0] + cell.widthDeg / 2)) + margin;
  const south = Math.min(...cells.map(cell => cell.center[1] - cell.heightDeg / 2)) - (focusBoxId ? 1 : 5);
  const north = Math.max(...cells.map(cell => cell.center[1] + cell.heightDeg / 2)) + (focusBoxId ? 1 : 5);
  const position = (lon: number, lat: number): [number, number] => [
    (lon - west) / (east - west) * fallbackWidth,
    (north - lat) / (north - south) * fallbackHeight
  ];
  const path = (points: [number, number][]) => points.map(([lon, lat], index) => {
    const [x, y] = position(lon, lat);
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join('');
  return { position, path, coast: fallbackLandPath(position),
    current: displayAreas(currentAreas).filter(cell => !focusBoxId || cell.id.startsWith(`${focusBoxId}-`)),
    future: displayAreas(destinationAreas).filter(cell => !focusBoxId || cell.id.startsWith(`${focusBoxId}-`)),
    currentCenters: currentAreas.filter(cell => !focusBoxId || cell.id === focusBoxId),
    futureCenters: destinationAreas.filter(cell => !focusBoxId || cell.id === focusBoxId),
    strands: streamlines.filter(strand => {
      const boxId = strand.id.slice(0, strand.id.lastIndexOf('-'));
      return !focusBoxId || boxId === focusBoxId;
    }) };
}

const graticule = {
  type: 'FeatureCollection' as const,
  features: [
    ...Array.from({ length: 11 }, (_, i) => -150 + i * 30).map(lon => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: Array.from({ length: 35 }, (_, j) => [lon, -85 + j * 5]) }
    })),
    ...Array.from({ length: 5 }, (_, i) => -60 + i * 30).map(lat => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: Array.from({ length: 73 }, (_, j) => [-180 + j * 5, lat]) }
    }))
  ]
};

type Hover = { x: number; y: number; cell: DisplayCell; period: 'observed' | 'illustrative' | 'current-model' | 'future-model' } | null;
type Endpoint = { position: [number, number]; period: 'current' | 'future'; boxId: string };
type Segment = { path: [number, number][]; color: [number, number, number, number] };
type Trail = { path: [number, number][] };

function speciesColor(boxId: string): [number, number, number] {
  return categorySpeciesColors[categorySpeciesId(boxId)] ?? [105, 237, 226];
}

function flowSegments(flow: DisplayFlow, start: number, end: number, grouped: boolean): Segment[] {
  const sourceColor = grouped ? speciesColor(flow.id) : [60, 237, 224];
  const colorSteps = 3;
  return Array.from({ length: colorSteps }, (_, index) => {
    const from = Math.max(start, index / colorSteps);
    const to = Math.min(end, (index + 1) / colorSteps);
    if (to <= from) return null;
    const blend = (index + 0.5) / colorSteps;
    return {
      path: flowSection(flow, from, to),
      color: [
        Math.round(sourceColor[0] * (1 - blend) + 255 * blend),
        Math.round(sourceColor[1] * (1 - blend) + 107 * blend),
        Math.round(sourceColor[2] * (1 - blend) + 180 * blend),
        245
      ] as [number, number, number, number]
    };
  }).filter((segment): segment is Segment => segment !== null);
}

export function MapView({ selected, focusBoxId = null, showBoxes = true, showIllustration = false }: {
  selected: SpeciesDataset; focusBoxId?: string | null; showBoxes?: boolean; showIllustration?: boolean
}) {
  const observed = selected.provenance === 'observation-demo';
  const grouped = selected.id.startsWith('all-');
  const presentation = useMemo(() => mapPresentation(selected, showIllustration), [selected, showIllustration]);
  const currentAreas = presentation.kind === 'observations' ? presentation.observedAreas : presentation.currentHabitat;
  const destinationAreas = presentation.kind === 'observations' ? presentation.illustrativeDestinations : presentation.futureHabitat;
  const flows = useMemo(() => observed && !showIllustration ? [] : displayFlows(selected), [selected, observed, showIllustration]);
  const streamlines = useMemo(() => observed && !showIllustration ? [] : displayStreamlines(selected, grouped ? 6 : 12), [selected, observed, grouped, showIllustration]);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const overlay = useRef<MapLibreOverlay | null>(null);
  const [hover, setHover] = useState<Hover>(null);
  const [ready, setReady] = useState(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  useEffect(() => {
    if (!container.current || webglUnavailable) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: 'ocean', type: 'background', paint: { 'background-color': '#07141d' } }]
      },
      center: [0, 8],
      zoom: 1.22,
      minZoom: 0.7,
      maxZoom: 9,
      renderWorldCopies: false,
      attributionControl: false
      });
    } catch {
      const fallbackFrame = requestAnimationFrame(() => setWebglUnavailable(true));
      return () => cancelAnimationFrame(fallbackFrame);
    }
    const deckOverlay = new MapLibreOverlay({ interleaved: false, layers: [] });
    instance.addControl(deckOverlay);
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.current = instance;
    overlay.current = deckOverlay;
    const readyFrame = requestAnimationFrame(() => setReady(true));
    return () => {
      cancelAnimationFrame(readyFrame);
      instance.remove();
      map.current = null;
      overlay.current = null;
    };
  }, [webglUnavailable]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const cells = [...currentAreas, ...destinationAreas].filter(cell => !focusBoxId || cell.id === focusBoxId);
    const lonMargin = focusBoxId ? 1 : 6;
    const latMargin = focusBoxId ? 1 : 5;
    const west = Math.min(...cells.map(cell => cell.center[0] - cell.widthDeg / 2));
    const east = Math.max(...cells.map(cell => cell.center[0] + cell.widthDeg / 2));
    const south = Math.min(...cells.map(cell => cell.center[1] - cell.heightDeg / 2));
    const north = Math.max(...cells.map(cell => cell.center[1] + cell.heightDeg / 2));
    map.current.fitBounds([[west - lonMargin, south - latMargin], [east + lonMargin, north + latMargin]], {
      padding: 46,
      maxZoom: focusBoxId ? 5.4 : 3.4,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 750
    });
  }, [currentAreas, destinationAreas, ready, focusBoxId]);

  useEffect(() => {
    if (!ready || !overlay.current) return;
    setHover(null);
    const graticuleLayer = new GeoJsonLayer({
      id: 'graticule',
      data: graticule,
      filled: false,
      stroked: true,
      getLineColor: [127, 158, 164, 24],
      getLineWidth: 1,
      lineWidthUnits: 'pixels',
      pickable: false
    });
    // Draw the opaque land geometry last in this deck.gl overlay. The overlay
    // sits above MapLibre, so a basemap land layer would not mask its boxes.
    const landCover = new GeoJsonLayer({
      id: 'land',
      data: land,
      wrapLongitude: true,
      filled: true,
      stroked: true,
      getFillColor: [187, 204, 201, 255],
      getLineColor: [222, 234, 224, 210],
      getLineWidth: 0.8,
      lineWidthUnits: 'pixels',
      parameters: { depthTest: false },
      pickable: true,
      onHover: () => setHover(null)
    });

    const currentCells = displayAreas(currentAreas);
    const futureCells = displayAreas(destinationAreas);
    const visibleFlows = flows.filter(flow => streamlines.some(strand =>
      selected.provenance !== 'reviewed-model' ? strand.id.startsWith(`${flow.id}-`) : strand.id === flow.id
    ));
    const endpoints: Endpoint[] = [
      ...currentAreas.map(area => ({ position: area.center, period: 'current' as const, boxId: area.id })),
      ...visibleFlows.map(flow => ({ position: flow.to, period: 'future' as const, boxId: flow.id }))
    ];
    const layers = [
        graticuleLayer,
        ...(showBoxes ? [
        new PolygonLayer<DisplayCell>({
          id: 'current-habitat',
          data: currentCells,
          getPolygon: d => d.polygon,
          getFillColor: d => {
            if (grouped) return [...speciesColor(d.id), 46];
            if (observed) return [58, 227, 212, 46];
            const [red, green, blue] = suitabilityColor(d.suitability ?? 0.5);
            return [red, green, blue, 38];
          },
          getLineColor: d => grouped ? [...speciesColor(d.id), 180] : [114, 231, 222, 108],
          getLineWidth: 0.8,
          lineWidthUnits: 'pixels',
          filled: true,
          stroked: true,
          pickable: true,
          onHover: info => setHover(info.object ? { x: info.x, y: info.y, cell: info.object, period: observed ? 'observed' : 'current-model' } : null)
        }),
        ...(destinationAreas.length ? [
        new PolygonLayer<DisplayCell>({
          id: 'future-habitat',
          data: futureCells,
          getPolygon: d => d.polygon,
          getFillColor: d => {
            if (observed) return [255, 143, 204, 30];
            const [red, green, blue] = suitabilityColor(d.suitability ?? 0.5);
            return [red, green, blue, 28];
          },
          getLineColor: [255, 139, 205, 112],
          getLineWidth: 0.8,
          lineWidthUnits: 'pixels',
          filled: true,
          stroked: true,
          pickable: true,
          onHover: info => setHover(info.object ? { x: info.x, y: info.y, cell: info.object, period: observed ? 'illustrative' : 'future-model' } : null)
        })] : [])] : []),
        new ScatterplotLayer<Endpoint>({
          id: 'flow-endpoints',
          data: endpoints,
          getPosition: d => d.position,
          getFillColor: d => d.period === 'current'
            ? grouped ? [...speciesColor(d.boxId), 255] : [125, 245, 230, 255]
            : [255, 140, 205, 255],
          getLineColor: [9, 33, 48, 255],
          lineWidthUnits: 'pixels',
          getLineWidth: 1.5,
          radiusUnits: 'pixels',
          getRadius: 3,
          stroked: true,
          pickable: false
        })
      ];

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionPreference.matches || streamlines.length === 0) {
      overlay.current.setProps({ layers: [...layers, landCover] });
      return;
    }

    let frame = 0;
    let lastFrame = -Infinity;
    const animate = (time: number) => {
      // Keep the dense field smooth without rebuilding deck.gl layers at 60 fps.
      if (time - lastFrame < 30) {
        frame = requestAnimationFrame(animate);
        return;
      }
      lastFrame = time;
      const trails: Trail[] = [];
      const segments: Segment[] = [];
      streamlines.forEach((flow, index) => {
        const progress = (time / 5600 + (index * 0.618034) % 1) % 1;
        const [start, end] = visibleFlowWindow(progress);
        if (end - start < 0.015) return;
        trails.push({ path: flowSection(flow, start, end) });
        segments.push(...flowSegments(flow, start, end, grouped));
      });
      overlay.current?.setProps({ layers: [
        ...layers,
        new PathLayer<Trail>({
          id: 'growing-trail-glow',
          data: trails,
          getPath: d => d.path,
          getColor: [119, 222, 222, 24],
          getWidth: 5,
          widthUnits: 'pixels',
          wrapLongitude: true,
          pickable: false
        }),
        new PathLayer<Segment>({
          id: 'growing-trail-color',
          data: segments,
          getPath: d => d.path,
          getColor: d => d.color,
          getWidth: 1.8,
          widthUnits: 'pixels',
          wrapLongitude: true,
          pickable: false
        }),
        landCover
      ] });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [selected, currentAreas, destinationAreas, ready, observed, grouped, showBoxes, flows, streamlines]);

  const demoFallback = webglUnavailable ? illustrativeFallback(presentation, focusBoxId, streamlines) : null;
  const hoveredSource = hover && selected.occurrence?.sources.find(source => hover.cell.id.startsWith(`${source.boxId}-`));

  return (
    <div className="map-wrap">
      <div ref={container} className="map-canvas" style={webglUnavailable ? { display: 'none' } : undefined} role="img" aria-label={observed ? `${selected.occurrence?.sources.length} zonas con ${selected.occurrence?.count} registros de ${selected.commonNameEs}; ${showBoxes ? 'cajas visibles' : 'cajas ocultas'}; ${showIllustration ? 'destinos y trazos ilustrativos, sin predicción científica' : 'solo se muestran las zonas documentadas'}` : `Mapa de hábitat ilustrativo actual y en 2050 para ${selected.commonNameEs}; los trazos aparecen en las celdas actuales y avanzan hasta las de 2050, sin rutas permanentes ni trayectorias reales de animales`} />
      {demoFallback && <div className="fallback-map">
        <svg viewBox={`0 0 ${fallbackWidth} ${fallbackHeight}`} role="img" aria-label={observed ? `${selected.occurrence?.sources.length} zonas con ${selected.occurrence?.count} registros de ${selected.commonNameEs}; cajas ${showBoxes ? 'visibles' : 'ocultas'}; ${showIllustration ? 'destinos ilustrativos visibles' : 'ilustración oculta'}` : `Flujos ilustrativos para ${selected.commonNameEs}; los trazos no son rutas reales`}>
          <rect width={fallbackWidth} height={fallbackHeight} fill="#071c29" />
          {showBoxes && demoFallback.current.map(cell => <path key={`now-${cell.id}`} d={`${demoFallback.path(cell.polygon)}Z`} fill={grouped ? `rgb(${speciesColor(cell.id).join(',')})` : '#50dcdd'} fillOpacity=".13" stroke={grouped ? `rgb(${speciesColor(cell.id).join(',')})` : '#83e9df'} strokeOpacity=".5" />)}
          {showBoxes && demoFallback.future.map(cell => <path key={`then-${cell.id}`} d={`${demoFallback.path(cell.polygon)}Z`} fill="#fc9dcb" fillOpacity=".09" stroke="#f7a3cd" strokeOpacity=".5" />)}
          {demoFallback.strands.map((strand, index) => <path key={strand.id} className="fallback-flow" d={demoFallback.path(strand.path)} pathLength="1" style={{ animationDelay: `${-(index * .618 % 1) * 5}s`, stroke: grouped ? `rgb(${speciesColor(strand.id).join(',')})` : undefined }} />)}
          {demoFallback.currentCenters.map(cell => { const [x, y] = demoFallback.position(...cell.center); return <circle key={`start-${cell.id}`} cx={x} cy={y} r="3" fill={grouped ? `rgb(${speciesColor(cell.id).join(',')})` : '#83f3e5'} />; })}
          {demoFallback.futureCenters.map(cell => { const [x, y] = demoFallback.position(...cell.center); return <circle key={`end-${cell.id}`} cx={x} cy={y} r="3" fill="#ffa8d0" />; })}
          <path d={demoFallback.coast} fill="#bbccc9" fillRule="evenodd" stroke="#e1eae0" strokeWidth="1.5" />
        </svg>
        <div className="fallback-note">{observed ? `${showBoxes ? 'Cajas calculadas con OBIS' : 'Cajas ocultas'}${showIllustration ? ' · destinos ilustrativos' : ' · solo observaciones'}` : 'Flujo ilustrativo'} · vista simplificada sin WebGL2</div>
      </div>}
      <div className="map-stamp"><span className="pulse" /> {observed ? `${selected.occurrence?.count} REGISTROS OBIS · ${showIllustration ? 'DESTINOS ILUSTRATIVOS, SIN PREDICCIÓN' : 'SOLO ZONAS DOCUMENTADAS'}` : 'FLUJOS ILUSTRATIVOS · DATOS SINTÉTICOS'}</div>
      <div className="map-credit">Siluetas geográficas: Natural Earth / world-atlas · Sin teselas externas</div>
      {hover && <div className="map-tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
        <strong>{observed ? (hover.period === 'observed' ? 'Caja de registros' : 'Destino ilustrativo') : `Celda ilustrativa · ${hover.period === 'current-model' ? 'Actual' : '2050'}`}</strong>
        {observed ? <span>{hover.period === 'observed' ? `${hoveredSource?.region ?? 'Región documentada'} · ${hoveredSource?.count ?? 0} registros; no implica presencia en toda la caja` : 'Desplazamiento visual, sin predicción científica'}</span> : <><span>Idoneidad: {Math.round((hover.cell.suitability ?? 0) * 100)} / 100</span><span>Incertidumbre: {Math.round((hover.cell.uncertainty ?? 0) * 100)} / 100</span></>}
      </div>}
    </div>
  );
}
