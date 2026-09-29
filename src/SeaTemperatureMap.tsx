import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { MapLibreOverlay } from '@deck.gl/maplibre';
import { GeoJsonLayer } from '@deck.gl/layers';
import { feature } from 'topojson-client';
import world from 'world-atlas/land-110m.json';
import { recordsByYear, seaAreas, temperatureColor, type SeaFeature } from './data/seaTemperatures';

const topology = world as unknown as Parameters<typeof feature>[0];
const land = feature(topology, topology.objects.land);
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
  const parts = land.type === 'FeatureCollection' ? land.features : [land];
  return parts.map(item => item.geometry ? geometryPath(item.geometry as SeaFeature['geometry']) : '').join('');
}

const coast = landPath();

export function SeaTemperatureMap({ year, selectedAreaId, onSelectArea }: {
  year: number; selectedAreaId: string | null; onSelectArea: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const overlay = useRef<MapLibreOverlay | null>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; id: string; name: string } | null>(null);
  const records = recordsByYear.get(year)!;

  useEffect(() => {
    if (!container.current || fallback) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style: { version: 8, sources: {}, layers: [{ id: 'ocean', type: 'background', paint: { 'background-color': '#07141d' } }] },
        center: [0, 8], zoom: 1.22, minZoom: 0.7, maxZoom: 9,
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
    if (!ready || !overlay.current) return;
    setHover(null);
    overlay.current.setProps({ layers: [
      new GeoJsonLayer<SeaFeature['properties']>({
        id: 'sea-temperature',
        data: seaAreas.features.filter(item => records.has(item.properties.id)),
        filled: true, stroked: true, pickable: true,
        getFillColor: item => temperatureColor(records.get(item.properties.id)!.celsius),
        getLineColor: item => item.properties.id === selectedAreaId ? [255, 255, 255, 245] : [126, 220, 218, 140],
        getLineWidth: item => item.properties.id === selectedAreaId ? 2 : 0.7,
        lineWidthUnits: 'pixels',
        onHover: info => setHover(info.object ? { x: info.x, y: info.y, id: info.object.properties.id, name: info.object.properties.name } : null),
        onClick: info => { if (info.object) onSelectArea(info.object.properties.id); }
      }),
      new GeoJsonLayer({
        id: 'land-cover', data: land, filled: true, stroked: true,
        getFillColor: [187, 204, 201, 255], getLineColor: [222, 234, 224, 210],
        getLineWidth: 0.8, lineWidthUnits: 'pixels', parameters: { depthTest: false },
        pickable: true, onHover: () => setHover(null)
      })
    ] });
  }, [ready, year, records, selectedAreaId, onSelectArea]);

  return <div className="map-wrap">
    <div ref={container} className="map-canvas" style={fallback ? { display: 'none' } : undefined} role="img" aria-label={`Temperatura media superficial anual en ${year}, por mar y océano. Selecciona una zona para ver su serie histórica.`} />
    {fallback && <div className="fallback-map">
      <svg viewBox="0 0 1200 600" role="img" aria-label={`Mapa de temperaturas superficiales por zona en ${year}`}>
        <rect width="1200" height="600" fill="#071c29" />
        {seaAreas.features.filter(item => records.has(item.properties.id)).map(item => <path
          key={item.properties.id} d={geometryPath(item.geometry)} fill={`rgb(${temperatureColor(records.get(item.properties.id)!.celsius).slice(0, 3).join(',')})`}
          fillOpacity=".8" fillRule="evenodd" stroke={item.properties.id === selectedAreaId ? '#fff' : '#76cfc8'} strokeWidth={item.properties.id === selectedAreaId ? 2 : 0.6}
          onClick={() => onSelectArea(item.properties.id)}><title>{item.properties.name}: {records.get(item.properties.id)!.celsius.toFixed(2)} °C</title></path>)}
        <path d={coast} fill="#bbccc9" fillRule="evenodd" stroke="#e1eae0" strokeWidth=".7" />
      </svg>
      <div className="fallback-note">Vista simplificada sin WebGL2 · pulsa una zona o elige su nombre en la lista</div>
    </div>}
    <div className="map-stamp"><span className="pulse" /> NOAA ERSSTv6 · MEDIA ANUAL {year}</div>
    <div className="map-credit">Temperaturas: NOAA ERSSTv6 · Límites: IHO / VLIZ (CC BY 4.0) · Costa: Natural Earth</div>
    {hover && records.get(hover.id) && <div className="map-tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}><strong>{hover.name}</strong><span>{records.get(hover.id)!.celsius.toFixed(2)} °C · {year}</span><span>Media superficial de {records.get(hover.id)!.cells} celdas de 2°</span></div>}
  </div>;
}
