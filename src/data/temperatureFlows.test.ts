import { describe, expect, it } from 'vitest';
import { coolingChain, coolingFlowFrame, coolingSvgPath, temperatureFlows, temperatureNetwork, type CoolingNetwork, type Position } from './temperatureFlows';
import { timelineByYear } from './temperatureForecasts';
import { FLOW_CYCLE_SECONDS, FLOW_SPAN_DEGREES, FLOW_STYLE, growingFlowFrame } from './flowAnimation';

const nodes = [['a:west', 'a', 0], ['a:east', 'a', 3], ['b:0', 'b', 1], ['c:0', 'c', 4], ['d:0', 'd', 2], ['isolated:0', 'isolated', .01]].map(([id, areaId, x]) => {
  const anchor: Position = [Number(x), 0];
  return { id: String(id), areaId: String(areaId), position: anchor,
    orbit: [anchor, [Number(x)+.1, 0], [Number(x)+.1, .1], [Number(x), .1], anchor] as Position[] };
});
const network: CoolingNetwork = { nodes, links: [
  ['a:west', 'b:0', 1], ['a:west', 'd:0', 2],
  ['a:east', 'b:0', 2], ['a:east', 'd:0', 1],
  ['b:0', 'c:0', 1], ['d:0', 'c:0', 1]
].map(([from, to, proximity]) => ({ from: String(from), to: String(to), proximityKm: Number(proximity),
  path: [nodes.find(n => n.id === from)!.position, nodes.find(n => n.id === to)!.position] })) };
const values = (a: number, b: number, c: number, d: number) => new Map([
  ['a', { celsius: a }], ['b', { celsius: b }], ['c', { celsius: c }], ['d', { celsius: d }], ['isolated', { celsius: -10 }]
]);

describe('temperature-driven illustrative paths', () => {
  it('chooses only touching cooler regions, then searches again from the arrival point', () => {
    expect(coolingChain('a:west', values(30, 20, 10, 26), network)).toEqual(['a', 'b', 'c']);
    expect(coolingChain('a:east', values(30, 20, 10, 26), network)).toEqual(['a', 'd', 'c']);
  });

  it('does not skip warmer neighbors to reach a colder non-neighbor', () => {
    expect(coolingChain('a:west', values(30, 31, 10, 40), network)).toEqual(['a']);
  });

  it('ranks neighboring sea proximity instead of route length or lowest temperature', () => {
    expect(coolingChain('a:west', values(30, 29, 10, 12), network)[1]).toBe('b');
    expect(coolingChain('a:east', values(30, 11, 10, 29), network)[1]).toBe('d');
  });

  it('never chooses equal or warmer neighbors, isolated seas or missing temperatures', () => {
    expect(coolingChain('a:west', values(30, 30, 30, 30), network)).toEqual(['a']);
    expect(coolingChain('isolated:0', values(30, 20, 10, 26), network)).toEqual(['isolated']);
    expect(coolingChain('missing', values(30, 20, 10, 26), network)).toEqual([]);
    const missing = values(30, 20, 10, 26); missing.delete('b'); missing.delete('d');
    expect(coolingChain('a:west', missing, network)).toEqual(['a']);
  });

  it('recomputes routes with the selected year', () => {
    expect(coolingChain('a:west', values(10, 20, 30, 26), network)).toEqual(['a']);
    expect(coolingChain('a:west', values(30, 20, 10, 26), network)).toEqual(['a', 'b', 'c']);
  });

  it('shares line growth, visible length, color gradient and cycle', () => {
    const flow = temperatureFlows(values(30, 20, 10, 26), network)[0];
    const time = FLOW_CYCLE_SECONDS*.6;
    const frame = coolingFlowFrame(flow, time, false);
    expect(frame.path).toEqual(growingFlowFrame(flow.legs[0], .6).path);
    expect(frame.segments).toEqual(growingFlowFrame(flow.legs[0], .6).segments);
    expect(FLOW_STYLE.width).toBe(1.8);
    expect(FLOW_STYLE.sourceColor).toEqual([60, 237, 224]);
    expect(FLOW_STYLE.destinationColor).toEqual([255, 107, 180]);
    const late = coolingFlowFrame(flow, FLOW_CYCLE_SECONDS*.95, false);
    expect(late.path[0]).not.toEqual(flow.legs[0].from); // tail retracts with the growing-line window
  });

  it('circles locally, fades completely, waits and emits again', () => {
    const flow = temperatureFlows(values(30, 20, 10, 26), network).find(f => f.id === 'isolated:0')!;
    expect(flow.travelDuration).toBe(0);
    expect(flow.legs[0].path[0]).toEqual(flow.legs[0].path.at(-1));
    expect(coolingFlowFrame(flow, 1, false).stage).toBe('circling');
    expect(coolingFlowFrame(flow, flow.orbitDuration*.98, false).alpha).toBeLessThan(.11);
    expect(coolingFlowFrame(flow, flow.orbitDuration+.1, false)).toEqual({ path: [], segments: [], alpha: 0, stage: 'waiting' });
    expect(coolingFlowFrame(flow, flow.duration+1, false).path.length).toBeGreaterThan(1);
  });

  it('keeps long ocean hops at the bounded trace scale instead of stretching across the whole route', () => {
    const end: Position = [30, 0];
    const long: CoolingNetwork = {
      nodes: [nodes[0], { ...nodes[2], position: end, orbit: [end, [30, .1], end] }],
      links: [{ from: 'a:west', to: 'b:0', proximityKm: 1,
        path: Array.from({ length: 31 }, (_, i): Position => [i, 0]) }]
    };
    const flow = temperatureFlows(values(30, 20, 10, 26), long)[0];
    expect(flow.areas).toEqual(['a', 'b']); // visual boundaries do not make extra cooling decisions
    expect(flow.legs.slice(0, -1)).toHaveLength(3);
    for (const leg of flow.legs.slice(0, -1)) {
      const span = leg.path.slice(1).reduce((sum, p, i) => sum+Math.hypot(p[0]-leg.path[i][0], p[1]-leg.path[i][1]), 0);
      expect(span).toBeLessThanOrEqual(FLOW_SPAN_DEGREES);
    }
    expect(flow.travelDuration).toBe(3*FLOW_CYCLE_SECONDS);
  });

  it('splits fallback traces at the antimeridian', () => {
    expect(coolingSvgPath([[179, 0], [181, 1], [182, 2]]).match(/M/g)).toHaveLength(2);
  });

  it('starts from multiple distinct positions in every region and keeps Caspian isolated', () => {
    const groups = new Map<string, typeof temperatureNetwork.nodes>();
    for (const node of temperatureNetwork.nodes) groups.set(node.areaId, [...(groups.get(node.areaId) ?? []), node]);
    expect(groups.size).toBe(102);
    for (const origins of groups.values()) {
      expect(origins.length).toBeGreaterThanOrEqual(6);
      expect(new Set(origins.map(n => JSON.stringify(n.position))).size).toBe(origins.length);
    }
    const caspian = temperatureNetwork.nodes.find(n => n.areaId === 'caspian')!;
    expect(coolingChain(caspian.id, timelineByYear.get(2025)!)).toEqual(['caspian']);
  });

  it.each([...timelineByYear])('only follows cooler adjacent stops, with continuous water endpoints, in %i', (year, temperatures) => {
    const flows = temperatureFlows(temperatures);
    expect(flows, String(year)).toHaveLength(temperatureNetwork.nodes.length);
    const areasByNode = new Map(temperatureNetwork.nodes.map(n => [n.id, n.areaId]));
    const neighborPairs = new Set(temperatureNetwork.links.map(l => [areasByNode.get(l.from), areasByNode.get(l.to)].join('|')));
    for (const flow of flows) {
      expect(new Set(flow.areas).size).toBe(flow.areas.length);
      for (let i = 1; i < flow.areas.length; i++) {
        expect(temperatures.get(flow.areas[i])!.celsius).toBeLessThan(temperatures.get(flow.areas[i-1])!.celsius);
        expect(neighborPairs.has(`${flow.areas[i-1]}|${flow.areas[i]}`)).toBe(true);
      }
      for (const [i, leg] of flow.legs.entries()) {
        expect(leg.path.every(p => p.every(Number.isFinite))).toBe(true);
        expect(leg.path.every((p, j) => j === 0 || Math.abs(p[0]-leg.path[j-1][0]) < 180)).toBe(true);
        if (i > 0) {
          const prev = flow.legs[i-1].path.at(-1)!;
          expect(((leg.from[0]-prev[0]+540)%360)-180).toBeCloseTo(0, 4);
          expect(leg.from[1]).toBeCloseTo(prev[1], 4);
        }
      }
    }
  });
});
