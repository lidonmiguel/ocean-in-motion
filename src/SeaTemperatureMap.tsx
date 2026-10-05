import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { MapLibreOverlay } from '@deck.gl/maplibre';
import { GeoJsonLayer } from '@deck.gl/layers';
import landRaw from './data/temperatureLand.geojson?raw';
import { formatTemperature, recordsByYear, seaAreas, temperatureColor, type SeaFeature } from './data/seaTemperatures';

const land = JSON.parse(landRaw) as {
  type: 'FeatureCollection';
  features: { type: 'Feature'; properties: object; geometry: SeaFeature['geometry'] }[];
};
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

export function SeaTemperatureMap({ year, selectedAreaId, onSelectArea, worldViewKey }: {
  year: number; selectedAreaId: string | null; onSelectArea: (id: string) => void; worldViewKey: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const overlay = useRef<MapLibreOverlay | null>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; id: string; name: string } | null>(null);
  const previousArea = useRef(selectedAreaId);
  const records = recordsByYear.get(year)!;

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
    if (!ready || !overlay.current) return;
    setHover(null);
    overlay.current.setProps({ layers: [
      new GeoJsonLayer<SeaFeature['properties']>({
        id: 'sea-temperature',
        data: seaAreas.features.filter(item => records.has(item.properties.id)),
        filled: true, stroked: true, pickable: true,
        getFillColor: item => {
          const record = records.get(item.properties.id)!;
          const [red, green, blue] = temperatureColor(record.celsius);
          return [red, green, blue, record.method === 'estimated' ? 120 : 195];
        },
        getLineColor: item => item.properties.id === selectedAreaId ? [255, 255, 255, 245] : [126, 220, 218, 90],
        getLineWidth: item => item.properties.id === selectedAreaId ? 2 : 0.5,
        lineWidthUnits: 'pixels',
        onHover: info => setHover(info.object ? { x: info.x, y: info.y, id: info.object.properties.id, name: info.object.properties.name } : null),
        onClick: info => { if (info.object) onSelectArea(info.object.properties.id); }
      }),
      new GeoJsonLayer({
        id: 'land-cover', data: land, filled: true, stroked: false,
        getFillColor: [187, 204, 201, 255], parameters: { depthTest: false },
        pickable: true, onHover: () => setHover(null)
      })
    ] });
  }, [ready, year, records, selectedAreaId, onSelectArea]);

  return <div className="map-wrap">
    <div ref={container} className="map-canvas" style={fallback ? { display: 'none' } : undefined} role="img" aria-label={`Temperatura media superficial anual en ${year}, por mar y océano. Selecciona una zona para ver su serie histórica.`} />
    {fallback && <div className="fallback-map">
      <svg viewBox="0 0 1200 600" role="img" aria-label={`Mapa de temperaturas superficiales por zona en ${year}`}>
        <rect width="1200" height="600" fill="#173746" />
        {seaAreas.features.filter(item => records.has(item.properties.id)).map(item => <path
          key={item.properties.id} d={geometryPath(item.geometry)} fill={`rgb(${temperatureColor(records.get(item.properties.id)!.celsius).slice(0, 3).join(',')})`}
          fillOpacity={records.get(item.properties.id)!.method === 'estimated' ? '.55' : '.8'} fillRule="evenodd" stroke={item.properties.id === selectedAreaId ? '#fff' : '#76cfc8'} strokeWidth={item.properties.id === selectedAreaId ? 2 : 0.4}
          onClick={() => onSelectArea(item.properties.id)}><title>{item.properties.name}: {formatTemperature(records.get(item.properties.id)!)}</title></path>)}
        <path d={coast} fill="#bbccc9" fillRule="evenodd" />
      </svg>
      <div className="fallback-note">Vista simplificada sin WebGL2 · pulsa una zona o elige su nombre en la lista</div>
    </div>}
    <div className="map-stamp"><span className="pulse" /> NOAA + ESTIMACIONES · {year}</div>
    <div className="map-credit">NOAA ERSSTv6 y estimaciones vecinas · Límites marinos: IHO / VLIZ (CC BY 4.0) · Caspio y costa: Natural Earth</div>
    {hover && records.get(hover.id) && <div className="map-tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}><strong>{hover.name}</strong><span>{formatTemperature(records.get(hover.id)!)} · {year}</span><span>{records.get(hover.id)!.method === 'estimated' ? 'Estimación de zonas cercanas; sin celdas NOAA locales' : `Media de ${records.get(hover.id)!.cells} celdas NOAA de 2°`}</span></div>}
  </div>;
}
