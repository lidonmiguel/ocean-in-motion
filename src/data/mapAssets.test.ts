import { afterEach, describe, expect, it, vi } from 'vitest';
import areasRaw from './seaAreas.geojson?raw';
import caspianRaw from './caspian.geojson?raw';
import landRaw from './temperatureLand.geojson?raw';
import routesRaw from './temperatureRoutes.json?raw';
import { seaRegions } from './seaTemperatures';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('independent map assets', () => {
  it('does not fetch on import; shares geometry requests without loading routes', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        JSON.parse(
          url.includes('seaAreas')
            ? areasRaw
            : url.includes('caspian')
              ? caspianRaw
              : landRaw
        )
    }));
    vi.stubGlobal('fetch', fetcher);
    const { loadMapGeometry } = await import('./mapAssets');
    expect(fetcher).not.toHaveBeenCalled();
    const [first, second] = await Promise.all([
      loadMapGeometry(),
      loadMapGeometry()
    ]);
    expect(first).toBe(second);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(
      fetcher.mock.calls.some(([url]) => url.includes('temperatureRoutes'))
    ).toBe(false);
    expect(
      first.seaAreas.features.map((feature) => feature.properties)
    ).toEqual(seaRegions);
    expect(first.land.features.length).toBeGreaterThan(0);
  });

  it('loads and expands routes only on request, and caches the result', async () => {
    const compact = JSON.parse(routesRaw);
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => compact });
    vi.stubGlobal('fetch', fetcher);
    const { loadTemperatureNetwork } = await import('./mapAssets');
    expect(fetcher).not.toHaveBeenCalled();
    const network = await loadTemperatureNetwork();
    expect(await loadTemperatureNetwork()).toBe(network);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toContain('temperatureRoutes');
    expect(network.nodes).toHaveLength(654);
    expect(network.links).toHaveLength(2148);
    expect(
      network.links.some(
        (link, index) => link.path.length > compact.links[index].path.length
      )
    ).toBe(true);
  });

  it('rejects failed geometry requests and allows a later retry', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetcher);
    const { loadMapGeometry } = await import('./mapAssets');
    await expect(loadMapGeometry()).rejects.toThrow('503');
    fetcher.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        JSON.parse(
          url.includes('seaAreas')
            ? areasRaw
            : url.includes('caspian')
              ? caspianRaw
              : landRaw
        )
    }));
    expect((await loadMapGeometry()).seaAreas.features).toHaveLength(102);
  });

  it('allows retry after malformed route data without retaining a rejected promise', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      })
      .mockResolvedValue({ ok: true, json: async () => JSON.parse(routesRaw) });
    vi.stubGlobal('fetch', fetcher);
    const { loadTemperatureNetwork } = await import('./mapAssets');
    await expect(loadTemperatureNetwork()).rejects.toThrow('Invalid JSON');
    expect((await loadTemperatureNetwork()).nodes).toHaveLength(654);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
