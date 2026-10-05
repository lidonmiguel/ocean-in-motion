import areasUrl from './seaAreas.geojson?url';
import caspianUrl from './caspian.geojson?url';
import landUrl from './temperatureLand.geojson?url';
import routesUrl from './temperatureRoutes.json?url';
import type { SeaFeature } from './seaTemperatures';
import {
  prepareTemperatureNetwork,
  type CoolingNetwork
} from './temperatureFlows';

export type MapGeometry = {
  seaAreas: { type: 'FeatureCollection'; features: SeaFeature[] };
  land: { type: 'FeatureCollection'; features: SeaFeature[] };
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Could not load map data (${response.status})`);
  return response.json() as Promise<T>;
}

let geometryPromise: Promise<MapGeometry> | undefined;
let networkPromise: Promise<CoolingNetwork> | undefined;

export function loadMapGeometry(): Promise<MapGeometry> {
  return (geometryPromise ??= Promise.all([
    fetchJson<MapGeometry['seaAreas']>(areasUrl),
    fetchJson<SeaFeature>(caspianUrl),
    fetchJson<MapGeometry['land']>(landUrl)
  ])
    .then(([areas, caspian, land]) => ({
      seaAreas: { ...areas, features: [...areas.features, caspian] },
      land
    }))
    .catch((error) => {
      geometryPromise = undefined;
      throw error;
    }));
}

export function loadTemperatureNetwork(): Promise<CoolingNetwork> {
  return (networkPromise ??= fetchJson<CoolingNetwork>(routesUrl)
    .then(prepareTemperatureNetwork)
    .catch((error) => {
      networkPromise = undefined;
      throw error;
    }));
}
