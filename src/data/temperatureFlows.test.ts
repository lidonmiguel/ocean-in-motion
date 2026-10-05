import { describe, expect, it } from 'vitest';
import { coolingChain, coolingFlowFrame, coolingSvgPath, temperatureFlows, temperatureNetwork, type CoolingNetwork, type Position } from './temperatureFlows';
import { timelineByYear } from './temperatureForecasts';

const nodes = ['a', 'b', 'c', 'd', 'isolated'].map((areaId, index) => {
  const x = [0, 1.2, 4, 1, .01][index];
  const anchor: Position = [x, 0];
  return { areaId, anchor, orbit: [anchor, [x+.1, 0], [x+.1, .1], [x, .1], anchor] as Position[] };
});
const network: CoolingNetwork = { nodes, links: [
  ['a', 'b', 10], ['b', 'c', 5], ['a', 'd', 6], ['d', 'c', 20]
].map(([from, to, length]) => ({ from: String(from), to: String(to), lengthKm: Number(length),
  path: [nodes.find(n => n.areaId === from)!.anchor, nodes.find(n => n.areaId === to)!.anchor] })) };
const values = (a: number, b: number, c: number, d: number) => new Map([
  ['a', { celsius: a }], ['b', { celsius: b }], ['c', { celsius: c }], ['d', { celsius: d }], ['isolated', { celsius: -10 }]
]);

describe('temperature-driven illustrative paths', () => {
  it('chooses proximity from the current position, recalculating after every cooler stop', () => {
    // d is nearest from a even though c is much colder; b is nearest from d.
    expect(coolingChain('a', values(30, 20, 10, 26), network)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('measures proximity geographically instead of mistaking a water-route detour for distance to the sea', () => {
    const detour = { ...network, links: network.links.map(l => l.to === 'd' ? { ...l, lengthKm: 1000 } : l) };
    expect(coolingChain('a', values(30, 20, 10, 26), detour)[1]).toBe('d');
  });

  it('can reach the nearest cooler sea through warmer navigation areas without an arbitrary radius', () => {
    expect(coolingChain('a', values(30, 31, 28, 40), network)).toEqual(['a', 'c']);
    const flow = temperatureFlows(values(30, 31, 28, 40), network).find(f => f.id === 'a')!;
    expect(flow.path).toContainEqual(nodes[1].anchor); // navigation via b
  });

  it('never descends to an equal or warmer stop or crosses to an isolated sea', () => {
    expect(coolingChain('a', values(30, 30, 30, 30), network)).toEqual(['a']);
    expect(coolingChain('a', values(30, 29.99, 30, 30), network)).toEqual(['a', 'b']);
    expect(coolingChain('isolated', values(30, 20, 10, 26), network)).toEqual(['isolated']);
    expect(coolingChain('missing', values(30, 20, 10, 26), network)).toEqual([]);
  });

  it('changes the route with the displayed temperatures instead of retaining the previous year', () => {
    expect(coolingChain('a', values(30, 20, 10, 26), network)).not.toEqual(coolingChain('a', values(10, 20, 30, 26), network));
    expect(coolingChain('a', values(10, 20, 30, 26), network)).toEqual(['a']);
  });

  it('circles within a terminal zone and fully fades before emitting another point', () => {
    const flow = temperatureFlows(values(30, 20, 10, 26), network).find(f => f.id === 'isolated')!;
    expect(flow.travelDuration).toBe(0);
    expect(flow.path[0]).toEqual(flow.path.at(-1));
    expect(coolingFlowFrame(flow, 1, false).stage).toBe('circling');
    expect(coolingFlowFrame(flow, 5, false).alpha).toBeLessThan(.3);
    const finished = coolingFlowFrame(flow, flow.orbitDuration+.1, false);
    expect(finished).toEqual({ path: [], alpha: 0, stage: 'waiting' });
    expect(coolingFlowFrame(flow, flow.duration+1, false).alpha).toBeGreaterThan(0);
  });

  it('splits fallback traces at the antimeridian', () => {
    expect(coolingSvgPath([[179, 0], [181, 1], [182, 2]]).match(/M/g)).toHaveLength(2);
  });

  it('has one local orbit for every zone and keeps Caspian disconnected from the ocean graph', () => {
    expect(temperatureNetwork.nodes).toHaveLength(102);
    expect(temperatureNetwork.links.some(l => l.from === 'caspian' || l.to === 'caspian')).toBe(false);
    expect(coolingChain('caspian', timelineByYear.get(2025)!)).toEqual(['caspian']);
  });

  it.each([...timelineByYear])('keeps cooler stops strictly decreasing and bounded in %i', (year, temperatures) => {
    const flows = temperatureFlows(temperatures);
    expect(flows, String(year)).toHaveLength(102);
    for (const flow of flows) {
      expect(new Set(flow.areas).size).toBe(flow.areas.length);
      expect(flow.areas.length).toBeLessThanOrEqual(102);
      for (let i = 1; i < flow.areas.length; i++) {
        expect(temperatures.get(flow.areas[i])!.celsius).toBeLessThan(temperatures.get(flow.areas[i-1])!.celsius);
      }
      expect(flow.times.at(-1)).toBeCloseTo(flow.travelDuration+flow.orbitDuration);
      expect(flow.path.every(p => p.every(Number.isFinite))).toBe(true);
      expect(flow.path.every((p, i) => i === 0 || Math.abs(p[0]-flow.path[i-1][0]) < 180)).toBe(true);
    }
  });
});
