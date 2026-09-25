import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { MapLibreOverlay } from '@deck.gl/maplibre';
import { LineLayer, PolygonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { feature } from 'topojson-client';
import world from 'world-atlas/land-110m.json';
import { displayCells, suitabilityColor, type DisplayCell } from './data/mapData';
import type { Period, SpeciesDataset } from './data/schema';
import 'maplibre-gl/dist/maplibre-gl.css';

const topology = world as unknown as Parameters<typeof feature>[0];
const land = feature(topology, topology.objects.land);

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

type Hover = { x: number; y: number; cell: DisplayCell } | null;

export function MapView({ selected, period }: { selected: SpeciesDataset; period: Period }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const overlay = useRef<MapLibreOverlay | null>(null);
  const [hover, setHover] = useState<Hover>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    const instance = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          graticule: { type: 'geojson', data: graticule },
          land: { type: 'geojson', data: land }
        },
        layers: [
          { id: 'ocean', type: 'background', paint: { 'background-color': '#082437' } },
          { id: 'grid', type: 'line', source: 'graticule', paint: { 'line-color': '#3a7080', 'line-opacity': 0.2, 'line-width': 1 } },
          { id: 'land-fill', type: 'fill', source: 'land', paint: { 'fill-color': '#244556' } },
          { id: 'coast', type: 'line', source: 'land', paint: { 'line-color': '#63929b', 'line-opacity': 0.65, 'line-width': 0.8 } }
        ]
      },
      center: [0, 8],
      zoom: 1.22,
      minZoom: 0.7,
      maxZoom: 9,
      renderWorldCopies: false,
      attributionControl: false
    });
    const deckOverlay = new MapLibreOverlay({ interleaved: false, layers: [] });
    instance.addControl(deckOverlay);
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.current = instance;
    overlay.current = deckOverlay;
    setReady(true);
    return () => {
      instance.remove();
      map.current = null;
      overlay.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !overlay.current) return;
    setHover(null);
    const cells = displayCells(selected, period);
    const vectors = period === 'future' ? (selected.movementVectors ?? []) : [];
    overlay.current.setProps({
      layers: [
        new PolygonLayer<DisplayCell>({
          id: 'habitat-cells',
          data: cells,
          getPolygon: d => d.polygon,
          getFillColor: d => suitabilityColor(d.suitability),
          getLineColor: period === 'future' ? [239, 127, 194, 210] : [144, 240, 233, 195],
          getLineWidth: 1.5,
          lineWidthUnits: 'pixels',
          filled: true,
          stroked: true,
          pickable: true,
          onHover: info => {
            setHover(info.object ? { x: info.x, y: info.y, cell: info.object } : null);
          },
          updateTriggers: { getLineColor: period }
        }),
        new LineLayer({
          id: 'illustrative-directions',
          data: vectors,
          getSourcePosition: d => d.from,
          getTargetPosition: d => d.to,
          getColor: [244, 104, 180, 235],
          getWidth: 3,
          widthUnits: 'pixels'
        }),
        new ScatterplotLayer({
          id: 'direction-endpoints',
          data: vectors,
          getPosition: d => d.to,
          getFillColor: [255, 159, 211, 255],
          getLineColor: [9, 33, 48, 255],
          lineWidthUnits: 'pixels',
          getLineWidth: 2,
          radiusUnits: 'pixels',
          getRadius: 6,
          stroked: true
        })
      ]
    });
  }, [selected, period, ready]);

  return (
    <div className="map-wrap">
      <div ref={container} className="map-canvas" role="img" aria-label={`Mapa mundial de hábitat ilustrativo para ${selected.commonNameEs}, ${period === 'current' ? 'actual' : '2050'}`} />
      <div className="map-stamp"><span className="pulse" /> MAPA GLOBAL · DEMOSTRACIÓN</div>
      <div className="map-credit">Siluetas geográficas: Natural Earth / world-atlas · Sin teselas externas</div>
      {hover && <div className="map-tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
        <strong>Celda ilustrativa</strong>
        <span>Idoneidad: {Math.round(hover.cell.suitability * 100)} / 100</span>
        <span>Incertidumbre: {Math.round(hover.cell.uncertainty * 100)} / 100</span>
      </div>}
    </div>
  );
}
