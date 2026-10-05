import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { MapLibreOverlay } from '@deck.gl/maplibre';
import { GeoJsonLayer, PathLayer, TextLayer } from '@deck.gl/layers';
import landRaw from './data/temperatureLand.geojson?raw';
import { formatTemperature, recordsByYear, seaAreas, temperatureColor, type SeaFeature } from './data/seaTemperatures';
import { FLOW_STYLE, type FlowSegment } from './data/flowAnimation';
import { coolingFlowFrame, coolingSvgPath, temperatureFlows, type CoolingFrame } from './data/temperatureFlows';

const land = JSON.parse(landRaw) as {
  type: 'FeatureCollection';
  features: { type: 'Feature'; properties: object; geometry: SeaFeature['geometry'] }[];
};
const blackSeaLabel = { position: [34, 44] as [number, number], name: 'MAR NEGRO' };
const svgPosition = (lon: number, lat: number) => [((lon + 180) / 360) * 1200, ((90 - lat) / 180) * 600];

function geometryPath(geometry: SeaFeature['geometry']): string {
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates as number[][][]] : geometry.coordinates as number[][][][];
  return polygons.flatMap(polygon => polygon.map(ring => ring.map(([lon, lat], index) => {
    const [x, y] = svgPosition(lon, lat);
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join('') + 'Z')).join('');
}

function landPath(): string {
  return land.features.map(item => geometryPath(item.geometry)).join('');
}

const coast = landPath();

function boundsForArea(area: SeaFeature): maplibregl.LngLatBoundsLike {
  const polygons = area.geometry.type === 'Polygon'
    ? [area.geometry.coordinates as number[][][]]
    : area.geometry.coordinates as number[][][][];
  const points = polygons.flatMap(polygon => polygon.flat());
  const south = Math.max(-82, Math.min(...points.map(point => point[1])));
  const north = Math.min(82, Math.max(...points.map(point => point[1])));

  // These areas cross the 180° meridian or span every longitude. Keep the
  // world in view and focus on their latitude instead of cutting them in half.
  if (points.some(point => point[0] <= -179) && points.some(point => point[0] >= 179)) {
    return [[-179.5, south], [179.5, north]];
  }
  return [[Math.min(...points.map(point => point[0])), south],
    [Math.max(...points.map(point => point[0])), north]];
}

export function SeaTemperatureMap({ year, selectedAreaId, onSelectArea, worldViewKey, values, forecastMode = false, showCooling = true, motionPaused = false }: {
  year: number; selectedAreaId: string | null; onSelectArea: (id: string) => void; worldViewKey: number;
  values?: Map<string, import('./data/seaTemperatures').TemperatureRecord>; forecastMode?: boolean;
  showCooling?: boolean; motionPaused?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const overlay = useRef<MapLibreOverlay | null>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; id: string; name: string } | null>(null);
  const previousArea = useRef(selectedAreaId);
  const records = values ?? recordsByYear.get(year)!;
  const flows = useMemo(() => showCooling && (ready || fallback) ? temperatureFlows(records) : [], [records, showCooling, ready, fallback]);
  const svgTrails = useRef(new Map<string, SVGPathElement>());
  const clock = useRef({ year, seconds: 0 });

  useEffect(() => {
    if (!container.current || fallback) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style: { version: 8, sources: {}, layers: [{ id: 'ocean', type: 'background', paint: { 'background-color': '#173746' } }] },
        center: [0, 0], zoom: 0, minZoom: -0.5, maxZoom: 9,
        renderWorldCopies: false, attributionControl: false
      });
    } catch {
      const frame = requestAnimationFrame(() => setFallback(true));
      return () => cancelAnimationFrame(frame);
    }
    const deckOverlay = new MapLibreOverlay({ interleaved: false, layers: [] });
    instance.addControl(deckOverlay);
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.current = instance;
    overlay.current = deckOverlay;
    const frame = requestAnimationFrame(() => setReady(true));
    return () => {
      cancelAnimationFrame(frame);
      instance.remove();
      map.current = null;
      overlay.current = null;
    };
  }, [fallback]);

  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.fitBounds([[-179.5, -82], [179.5, 82]], { padding: 16, duration: 500 });
  }, [ready, worldViewKey]);

  useEffect(() => {
    if (!ready || !map.current) return;
    if (previousArea.current === selectedAreaId) return;
    previousArea.current = selectedAreaId;
    const area = seaAreas.features.find(item => item.properties.id === selectedAreaId);
    if (!area) return;
    map.current.fitBounds(boundsForArea(area), { padding: 55, maxZoom: 3.8, duration: 550 });
  }, [ready, selectedAreaId]);

  useEffect(() => {
    if (!ready && !fallback) return;
    const seaLayer = new GeoJsonLayer<SeaFeature['properties']>({
        id: 'sea-temperature',
        data: seaAreas.features.filter(item => records.has(item.properties.id)),
        filled: true, stroked: true, pickable: true,
        getFillColor: item => {
          const record = records.get(item.properties.id)!;
          const [red, green, blue] = temperatureColor(record.celsius);
          return [red, green, blue, record.method === 'estimated' || record.forecastBasis === 'estimated-history' ? 120 : 195];
        },
        getLineColor: item => item.properties.id === selectedAreaId ? [255, 255, 255, 245] : [126, 220, 218, 90],
        getLineWidth: item => item.properties.id === selectedAreaId ? 2 : 0.5,
        lineWidthUnits: 'pixels',
        onHover: info => setHover(info.object ? { x: info.x, y: info.y, id: info.object.properties.id, name: info.object.properties.name } : null),
        onClick: info => { if (info.object) onSelectArea(info.object.properties.id); }
      });
    const landLayer = new GeoJsonLayer({
        id: 'land-cover', data: land, filled: true, stroked: false,
        getFillColor: [187, 204, 201, 255], parameters: { depthTest: false },
        pickable: true, onHover: () => setHover(null)
      });
    const labelLayer = new TextLayer({
        id: 'black-sea-label', data: [blackSeaLabel],
        getPosition: item => item.position, getText: item => item.name,
        getSize: 11, sizeUnits: 'pixels', getColor: [255, 255, 255, 245],
        fontWeight: 700, billboard: true, pickable: false,
        parameters: { depthTest: false }
      });
    if (clock.current.year !== year) clock.current = { year, seconds: 0 };
    type Draw = CoolingFrame & { id: string };
    const render = (seconds: number) => {
      const trails: Draw[] = flows.map(flow => ({ ...coolingFlowFrame(flow, seconds),
        id: flow.id })).filter(frame => frame.alpha > 0.01 && frame.path.length > 1);
      if (ready) overlay.current?.setProps({ layers: [seaLayer,
        new PathLayer<Draw>({ id: 'temperature-flow-glow', data: trails, getPath: d => d.path,
          getColor: d => [...FLOW_STYLE.glowColor.slice(0, 3), Math.round(d.alpha*FLOW_STYLE.glowColor[3])] as [number, number, number, number],
          getWidth: FLOW_STYLE.glowWidth, widthUnits: 'pixels', wrapLongitude: true, pickable: false }),
        new PathLayer<FlowSegment>({ id: 'temperature-flow-color', data: trails.flatMap(t => t.segments),
          getPath: d => d.path, getColor: d => d.color, getWidth: FLOW_STYLE.width,
          widthUnits: 'pixels', wrapLongitude: true, pickable: false }), landLayer, labelLayer] });
      if (fallback) {
        const frames = new Map(trails.map(t => [t.id, t]));
        svgTrails.current.forEach(element => {
          const [id, part] = element.dataset.part!.split('|');
          const current = frames.get(id);
          const segment = Number(part);
          element.setAttribute('d', current ? coolingSvgPath(segment < 0 ? current.path : current.segments[segment]?.path ?? []) : '');
          element.setAttribute('opacity', String(current?.alpha ?? 0));
          if (segment >= 0 && current?.segments[segment]) element.setAttribute('stroke', `rgb(${current.segments[segment].color.slice(0, 3).join(',')})`);
        });
      }
    };
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, lastFrame = -Infinity, epoch = 0;
    const animate = (time: number) => {
      if (time-lastFrame >= 30) {
        lastFrame = time;
        clock.current.seconds = (time-epoch)/1000;
        render(clock.current.seconds);
      }
      frame = requestAnimationFrame(animate);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      render(clock.current.seconds);
      if (motionPaused || preference.matches || !flows.length) return;
      epoch = performance.now()-clock.current.seconds*1000;
      frame = requestAnimationFrame(animate);
    };
    preference.addEventListener('change', start);
    start();
    return () => { cancelAnimationFrame(frame); preference.removeEventListener('change', start); };
  }, [ready, fallback, year, records, selectedAreaId, onSelectArea, flows, motionPaused]);

  return <div className="map-wrap">
    <div ref={container} className="map-canvas" style={fallback ? { display: 'none' } : undefined} role="img" aria-label={`${forecastMode ? 'Predicción experimental de temperatura' : 'Temperatura media'} superficial anual en ${year}, por mar y océano. Selecciona una zona para ver su evolución.`} />
    {fallback && <div className="fallback-map">
      <svg viewBox="0 0 1200 600" role="img" aria-label={`Mapa de temperaturas superficiales por zona en ${year}`}>
        <rect width="1200" height="600" fill="#173746" />
        {seaAreas.features.filter(item => records.has(item.properties.id)).map(item => <path
          key={item.properties.id} d={geometryPath(item.geometry)} fill={`rgb(${temperatureColor(records.get(item.properties.id)!.celsius).slice(0, 3).join(',')})`}
          fillOpacity={records.get(item.properties.id)!.method === 'estimated' || records.get(item.properties.id)!.forecastBasis === 'estimated-history' ? '.55' : '.8'} fillRule="evenodd" stroke={item.properties.id === selectedAreaId ? '#fff' : '#76cfc8'} strokeWidth={item.properties.id === selectedAreaId ? 2 : 0.4}
          onClick={() => onSelectArea(item.properties.id)}><title>{item.properties.name}: {formatTemperature(records.get(item.properties.id)!)}</title></path>)}
        {flows.flatMap(flow => [-1, 0, 1, 2].map(part => <path key={`${flow.id}|${part}`} data-part={`${flow.id}|${part}`}
          ref={element => { const key = `${flow.id}|${part}`; if (element) svgTrails.current.set(key, element); else svgTrails.current.delete(key); }}
          fill="none" stroke={part < 0 ? `rgb(${FLOW_STYLE.glowColor.slice(0, 3).join(',')})` : '#3cede0'}
          strokeOpacity={part < 0 ? FLOW_STYLE.glowColor[3]/255 : 245/255}
          strokeWidth={part < 0 ? FLOW_STYLE.glowWidth : FLOW_STYLE.width} pointerEvents="none" />))}
        <path d={coast} fill="#bbccc9" fillRule="evenodd" />
        <text x={svgPosition(...blackSeaLabel.position)[0]} y={svgPosition(...blackSeaLabel.position)[1]} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" pointerEvents="none">{blackSeaLabel.name}</text>
      </svg>
      <div className="fallback-note">Vista simplificada sin WebGL2 · pulsa una zona o elige su nombre en la lista</div>
    </div>}
    <div className="map-stamp"><span className="pulse" /> {forecastMode ? 'PREDICCIÓN ESTADÍSTICA' : 'NOAA + ESTIMACIONES'} · {year}</div>
    <div className="map-credit">{forecastMode ? 'Previsión estadística basada en histórico NOAA ERSSTv6' : 'NOAA ERSSTv6 y estimaciones vecinas'} · Límites marinos: IHO / VLIZ (CC BY 4.0) · Caspio y costa: Natural Earth</div>
    {hover && records.get(hover.id) && <div className="map-tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}><strong>{hover.name}</strong><span>{formatTemperature(records.get(hover.id)!)} · {year}</span><span>{forecastMode ? records.get(hover.id)!.forecastBasis === 'estimated-history' ? 'Predicción sobre histórico estimado; sin validación local' : 'Predicción experimental; no es un dato NOAA futuro' : records.get(hover.id)!.method === 'estimated' ? 'Estimación de zonas cercanas; sin celdas NOAA locales' : `Media de ${records.get(hover.id)!.cells} celdas NOAA de 2°`}</span></div>}
  </div>;
}
