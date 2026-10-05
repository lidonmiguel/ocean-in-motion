// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapGeometry } from './data/mapAssets';
import { SeaTemperatureMap } from './SeaTemperatureMap';

const { geometryLoader, networkLoader } = vi.hoisted(() => ({
  geometryLoader: vi.fn(),
  networkLoader: vi.fn()
}));
vi.mock('./data/mapAssets', () => ({
  loadMapGeometry: geometryLoader,
  loadTemperatureNetwork: networkLoader
}));
vi.mock('maplibre-gl', () => ({
  Map: class {
    constructor() {
      throw new Error('No WebGL in test');
    }
  }
}));
vi.mock('@deck.gl/layers', () => ({
  GeoJsonLayer: class {},
  PathLayer: class {},
  TextLayer: class {}
}));
vi.mock('@deck.gl/maplibre', () => ({ MapLibreOverlay: class {} }));

const geometry: MapGeometry = {
  seaAreas: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { id: 'black', name: 'Black Sea' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [30, 40],
              [35, 40],
              [35, 45],
              [30, 40]
            ]
          ]
        }
      }
    ]
  },
  land: { type: 'FeatureCollection', features: [] }
};
const props = {
  year: 2025,
  selectedAreaId: 'black',
  onSelectArea: vi.fn(),
  worldViewKey: 0
};

beforeEach(() => {
  geometryLoader.mockReset().mockResolvedValue(geometry);
  networkLoader.mockReset().mockResolvedValue({ nodes: [], links: [] });
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('asynchronous map data', () => {
  it('keeps the SVG fallback selectable without requesting disabled paths', async () => {
    render(<SeaTemperatureMap {...props} showCooling={false} />);
    await screen.findByRole('img', {
      name: 'Map of surface temperatures by region in 2025'
    });
    expect(networkLoader).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(/Black Sea:/).parentElement!);
    expect(props.onSelectArea).toHaveBeenCalledWith('black');
  });

  it('keeps the temperature map available if routes fail and retries on request', async () => {
    networkLoader.mockRejectedValueOnce(new Error('Network unavailable'));
    render(<SeaTemperatureMap {...props} />);
    const retry = await screen.findByRole('button', { name: 'Retry paths' });
    expect(
      screen.getByRole('img', {
        name: 'Map of surface temperatures by region in 2025'
      })
    ).toBeDefined();
    fireEvent.click(retry);
    await waitFor(() => expect(networkLoader).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Retry paths' })).toBeNull()
    );
  });

  it('offers retry after a geometry failure and recovers the map', async () => {
    geometryLoader.mockRejectedValueOnce(new Error('Network unavailable'));
    render(<SeaTemperatureMap {...props} showCooling={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry map' }));
    await screen.findByRole('img', {
      name: 'Map of surface temperatures by region in 2025'
    });
    expect(geometryLoader).toHaveBeenCalledTimes(2);
  });
});
