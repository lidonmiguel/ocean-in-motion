import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { MapLibreOverlay } from '@deck.gl/maplibre';
import { GeoJsonLayer, PathLayer, PolygonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { feature } from 'topojson-client';
import world from 'world-atlas/land-110m.json';
import { displayCells, suitabilityColor, type DisplayCell } from './data/mapData';
import { displayFlows, pointOnFlow } from './data/flowData';
import type { SpeciesDataset } from './data/schema';
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

type Hover = { x: number; y: number; cell: DisplayCell; period: 'Actual' | '2050' } | null;
type Endpoint = { position: [number, number]; period: 'current' | 'future' };
type Particle = { position: [number, number]; opacity: number; radius: number };

export function MapView({ selected }: { selected: SpeciesDataset }) {
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
        sources: {},
        layers: [{ id: 'ocean', type: 'background', paint: { 'background-color': '#082437' } }]
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
    const currentCells = displayCells(selected, 'current');
    const futureCells = displayCells(selected, 'future');
    const flows = displayFlows(selected);
    const endpoints: Endpoint[] = flows.flatMap(flow => [
      { position: flow.from, period: 'current' },
      { position: flow.to, period: 'future' }
    ]);
    const layers = [
        new GeoJsonLayer({
          id: 'graticule',
          data: graticule,
          filled: false,
          stroked: true,
          getLineColor: [58, 112, 128, 50],
          getLineWidth: 1,
          lineWidthUnits: 'pixels',
          pickable: false
        }),
        new GeoJsonLayer({
          id: 'land',
          data: land,
          wrapLongitude: true,
          filled: true,
          stroked: true,
          getFillColor: [36, 69, 86, 255],
          getLineColor: [99, 146, 155, 166],
          getLineWidth: 0.8,
          lineWidthUnits: 'pixels',
          pickable: false
        }),
        new PolygonLayer<DisplayCell>({
          id: 'current-habitat',
          data: currentCells,
          getPolygon: d => d.polygon,
          getFillColor: d => suitabilityColor(d.suitability),
          getLineColor: [144, 240, 233, 220],
          getLineWidth: 1.5,
          lineWidthUnits: 'pixels',
          filled: true,
          stroked: true,
          pickable: true,
          onHover: info => setHover(info.object ? { x: info.x, y: info.y, cell: info.object, period: 'Actual' } : null)
        }),
        new PolygonLayer<DisplayCell>({
          id: 'future-habitat',
          data: futureCells,
          getPolygon: d => d.polygon,
          getFillColor: d => {
            const [red, green, blue] = suitabilityColor(d.suitability);
            return [red, green, blue, 100];
          },
          getLineColor: [255, 139, 205, 240],
          getLineWidth: 2,
          lineWidthUnits: 'pixels',
          filled: true,
          stroked: true,
          pickable: true,
          onHover: info => setHover(info.object ? { x: info.x, y: info.y, cell: info.object, period: '2050' } : null)
        }),
        new PathLayer({
          id: 'flow-glow',
          data: flows,
          getPath: d => d.path,
          getColor: [245, 88, 181, 50],
          getWidth: 8,
          widthUnits: 'pixels',
          wrapLongitude: true,
          pickable: false
        }),
        new PathLayer({
          id: 'flow-lines',
          data: flows,
          getPath: d => d.path,
          getColor: [255, 155, 215, 210],
          getWidth: 1.7,
          widthUnits: 'pixels',
          wrapLongitude: true,
          pickable: false
        }),
        new ScatterplotLayer<Endpoint>({
          id: 'flow-endpoints',
          data: endpoints,
          getPosition: d => d.position,
          getFillColor: d => d.period === 'current' ? [125, 245, 230, 255] : [255, 140, 205, 255],
          getLineColor: [9, 33, 48, 255],
          lineWidthUnits: 'pixels',
          getLineWidth: 1.5,
          radiusUnits: 'pixels',
          getRadius: 4,
          stroked: true,
          pickable: false
        })
      ];

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionPreference.matches || flows.length === 0) {
      overlay.current.setProps({ layers });
      return;
    }

    let frame = 0;
    const animate = (time: number) => {
      const particles: Particle[] = flows.flatMap((flow, index) => {
        const progress = (time / 4400 + index / flows.length) % 1;
        return Array.from({ length: 4 }, (_, trail) => {
          const position = progress - trail * 0.035;
          return position >= 0 ? {
            position: pointOnFlow(flow, position), opacity: 255 - trail * 58, radius: 4.5 - trail * 0.7
          } : null;
        }).filter((particle): particle is Particle => particle !== null);
      });
      overlay.current?.setProps({ layers: [
        ...layers,
        new ScatterplotLayer<Particle>({
          id: 'flow-particles',
          data: particles,
          getPosition: d => d.position,
          getFillColor: d => [255, 202, 232, d.opacity],
          getRadius: d => d.radius,
          radiusUnits: 'pixels',
          wrapLongitude: true,
          pickable: false
        })
      ] });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [selected, ready]);

  return (
    <div className="map-wrap">
      <div ref={container} className="map-canvas" role="img" aria-label={`Mapa mundial de hábitat ilustrativo actual y en 2050 para ${selected.commonNameEs}, con conexiones visuales entre celdas; no son rutas de animales`} />
      <div className="map-stamp"><span className="pulse" /> MAPA GLOBAL · DEMOSTRACIÓN</div>
      <div className="map-credit">Siluetas geográficas: Natural Earth / world-atlas · Sin teselas externas</div>
      {hover && <div className="map-tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
        <strong>Celda ilustrativa · {hover.period}</strong>
        <span>Idoneidad: {Math.round(hover.cell.suitability * 100)} / 100</span>
        <span>Incertidumbre: {Math.round(hover.cell.uncertainty * 100)} / 100</span>
      </div>}
    </div>
  );
}
