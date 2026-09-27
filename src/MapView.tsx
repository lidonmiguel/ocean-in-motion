import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { MapLibreOverlay } from '@deck.gl/maplibre';
import { GeoJsonLayer, PathLayer, PolygonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { feature } from 'topojson-client';
import world from 'world-atlas/land-110m.json';
import { displayCells, suitabilityColor, type DisplayCell } from './data/mapData';
import { displayFlows, displayStreamlines, flowSection, visibleFlowWindow, type DisplayFlow } from './data/flowData';
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
type Segment = { path: [number, number][]; color: [number, number, number, number] };
type Trail = { path: [number, number][] };

function flowSegments(flow: DisplayFlow, start: number, end: number): Segment[] {
  return Array.from({ length: 6 }, (_, index) => {
    const from = Math.max(start, index / 6);
    const to = Math.min(end, (index + 1) / 6);
    if (to <= from) return null;
    const blend = (index + 0.5) / 6;
    return {
      path: flowSection(flow, from, to),
      color: [
        Math.round(60 + 195 * blend),
        Math.round(237 - 130 * blend),
        Math.round(224 - 44 * blend),
        230
      ] as [number, number, number, number]
    };
  }).filter((segment): segment is Segment => segment !== null);
}

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
        layers: [{ id: 'ocean', type: 'background', paint: { 'background-color': '#07141d' } }]
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
    if (!ready || !map.current) return;
    const cells = [...selected.habitat.current, ...selected.habitat.future];
    const west = Math.min(...cells.map(cell => cell.center[0] - cell.widthDeg / 2));
    const east = Math.max(...cells.map(cell => cell.center[0] + cell.widthDeg / 2));
    const south = Math.min(...cells.map(cell => cell.center[1] - cell.heightDeg / 2));
    const north = Math.max(...cells.map(cell => cell.center[1] + cell.heightDeg / 2));
    map.current.fitBounds([[west - 6, south - 5], [east + 6, north + 5]], {
      padding: 46,
      maxZoom: 3.4,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 750
    });
  }, [selected, ready]);

  useEffect(() => {
    if (!ready || !overlay.current) return;
    setHover(null);
    const currentCells = displayCells(selected, 'current');
    const futureCells = displayCells(selected, 'future');
    const flows = displayFlows(selected);
    const streamlines = displayStreamlines(selected);
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
          getLineColor: [127, 158, 164, 24],
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
          getFillColor: [187, 204, 201, 255],
          getLineColor: [222, 234, 224, 210],
          getLineWidth: 0.8,
          lineWidthUnits: 'pixels',
          pickable: false
        }),
        new PolygonLayer<DisplayCell>({
          id: 'current-habitat',
          data: currentCells,
          getPolygon: d => d.polygon,
          getFillColor: d => {
            const [red, green, blue] = suitabilityColor(d.suitability);
            return [red, green, blue, 38];
          },
          getLineColor: [114, 231, 222, 108],
          getLineWidth: 0.8,
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
            return [red, green, blue, 28];
          },
          getLineColor: [255, 139, 205, 112],
          getLineWidth: 0.8,
          lineWidthUnits: 'pixels',
          filled: true,
          stroked: true,
          pickable: true,
          onHover: info => setHover(info.object ? { x: info.x, y: info.y, cell: info.object, period: '2050' } : null)
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
          getRadius: 3,
          stroked: true,
          pickable: false
        })
      ];

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionPreference.matches || streamlines.length === 0) {
      overlay.current.setProps({ layers });
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
        const progress = (time / 4900 + (index * 0.618034) % 1) % 1;
        const [start, end] = visibleFlowWindow(progress);
        if (end - start < 0.015) return;
        trails.push({ path: flowSection(flow, start, end) });
        segments.push(...flowSegments(flow, start, end));
      });
      overlay.current?.setProps({ layers: [
        ...layers,
        new PathLayer<Trail>({
          id: 'growing-trail-glow',
          data: trails,
          getPath: d => d.path,
          getColor: [119, 222, 222, 34],
          getWidth: 6,
          widthUnits: 'pixels',
          wrapLongitude: true,
          pickable: false
        }),
        new PathLayer<Segment>({
          id: 'growing-trail-color',
          data: segments,
          getPath: d => d.path,
          getColor: d => d.color,
          getWidth: 2.1,
          widthUnits: 'pixels',
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
      <div ref={container} className="map-canvas" role="img" aria-label={`Mapa de hábitat ilustrativo actual y en 2050 para ${selected.commonNameEs}; los trazos aparecen en las celdas actuales y avanzan hasta las de 2050, sin rutas permanentes ni trayectorias reales de animales`} />
      <div className="map-stamp"><span className="pulse" /> FLUJOS ILUSTRATIVOS · DATOS SINTÉTICOS</div>
      <div className="map-credit">Siluetas geográficas: Natural Earth / world-atlas · Sin teselas externas</div>
      {hover && <div className="map-tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
        <strong>Celda ilustrativa · {hover.period}</strong>
        <span>Idoneidad: {Math.round(hover.cell.suitability * 100)} / 100</span>
        <span>Incertidumbre: {Math.round(hover.cell.uncertainty * 100)} / 100</span>
      </div>}
    </div>
  );
}
