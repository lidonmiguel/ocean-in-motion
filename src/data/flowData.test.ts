import { describe, expect, it } from 'vitest';
import { species } from './index';
import { displayFlows, displayStreamlines, flowSection, pointOnFlow, visibleFlowWindow } from './flowData';
import { waterSegment } from './oceanRoutes';

describe('illustrative distribution flows', () => {
  it('connects the observed center to its labeled visual destination', () => {
    const dataset = species[0];
    const flows = displayFlows(dataset);
    expect(flows).toHaveLength(dataset.habitat.current.length);
    expect(flows[0].from).toEqual(dataset.habitat.current[0].center);
    expect(pointOnFlow(flows[0], 1)[0]).toBeCloseTo(dataset.habitat.future[0].center[0]);
    expect(pointOnFlow(flows[0], 1)[1]).toBeCloseTo(dataset.habitat.future[0].center[1]);
  });

  it('takes the short path across the antimeridian', () => {
    const dataset = structuredClone(species[0]);
    dataset.habitat.current[0].center = [179, 20];
    dataset.habitat.future[0].center = [-179, 24];
    const path = displayFlows(dataset)[0].path;
    expect(path[0]).toEqual([179, 20]);
    expect(path.at(-1)).toEqual([181, 24]);
    expect(path.every(([longitude]) => longitude >= 179 && longitude <= 181)).toBe(true);
  });

  it('keeps all strands on their matching cell pair and in the same direction', () => {
    for (const dataset of species) {
      const strands = displayStreamlines(dataset);
      expect(strands.length, dataset.id).toBeGreaterThan(0);
      expect(new Set(strands.map(strand => strand.id.split('-')[0])).size, dataset.id)
        .toBe(dataset.habitat.current.length);
      for (const strand of strands) {
        const cellId = strand.id.split('-')[0];
        const current = dataset.habitat.current.find(cell => cell.id === cellId)!;
        const future = dataset.habitat.future.find(cell => cell.id === cellId)!;
        expect(Math.abs(strand.from[0] - current.center[0])).toBeLessThan(current.widthDeg / 2);
        expect(Math.abs(strand.from[1] - current.center[1])).toBeLessThan(current.heightDeg / 2);
        expect(Math.abs(strand.to[0] - future.center[0])).toBeLessThan(future.widthDeg / 2);
        expect(Math.abs(strand.to[1] - future.center[1])).toBeLessThan(future.heightDeg / 2);
        expect(strand.to[0] - strand.from[0]).toBeCloseTo(future.center[0] - current.center[0]);
        expect(strand.to[1] - strand.from[1]).toBeCloseTo(future.center[1] - current.center[1]);
        expect(pointOnFlow(strand, 0)).toEqual(strand.from);
        expect(pointOnFlow(strand, 1)[1]).toBeCloseTo(strand.to[1]);
        for (let i = 1; i < strand.path.length; i++) {
          expect(waterSegment(strand.path[i - 1], strand.path[i])).toBe(true);
        }
      }
    }
  }, 15_000);

  it('makes most illustrative routes visible at overview scale', () => {
    const lengths = species.flatMap(dataset => displayFlows(dataset).map(flow => {
      const latitude = (flow.from[1] + flow.to[1]) * Math.PI / 360;
      return Math.hypot((flow.to[0] - flow.from[0]) * Math.cos(latitude), flow.to[1] - flow.from[1]);
    }));
    expect(lengths.filter(length => length >= 4).length).toBeGreaterThan(lengths.length * 0.8);
  });

  it('fans out from one whole source area to a matching destination area', () => {
    const original = species[0].habitat.current[0];
    const dataset = {
      ...species[0],
      habitat: {
        current: [{ ...original, center: [-30, -10] as [number, number], widthDeg: 6, heightDeg: 6 }],
        future: [{ ...original, center: [-30, -22] as [number, number], widthDeg: 6, heightDeg: 6 }]
      }
    };
    const strands = displayStreamlines(dataset, 12);
    expect(strands).toHaveLength(12);
    const originLongitudes = strands.map(strand => strand.from[0]);
    const destinationLongitudes = strands.map(strand => strand.to[0]);
    expect(Math.max(...originLongitudes) - Math.min(...originLongitudes)).toBeGreaterThan(4);
    expect(Math.max(...destinationLongitudes) - Math.min(...destinationLongitudes)).toBeGreaterThan(4);
    expect(strands.every(strand => strand.path.slice(1).every((point, index) =>
      waterSegment(strand.path[index], point)))).toBe(true);
  });

  it('uses only explicit vectors for reviewed data', () => {
    const dataset = structuredClone(species[0]);
    dataset.provenance = 'reviewed-model';
    dataset.movementVectors = [];
    expect(displayStreamlines(dataset)).toEqual([]);
    dataset.movementVectors = [{ from: [-39, 34], to: [-37, 46], labelEs: 'Dirección' }];
    expect(displayStreamlines(dataset)).toHaveLength(1);
    dataset.movementVectors = [{ from: [-80, 22], to: [-87, 20], labelEs: 'Sin salida al mar' }];
    expect(displayStreamlines(dataset)).toEqual([]);
  });

  it('grows from the source and lets the tail reach the destination', () => {
    const flow = displayFlows(species[0])[0];
    expect(visibleFlowWindow(0)).toEqual([0, 0]);
    expect(visibleFlowWindow(0.5)).toEqual([0, 0.5]);
    const [start, end] = visibleFlowWindow(0.91);
    expect(start).toBeGreaterThan(0);
    expect(end).toBe(0.91);
    const section = flowSection(flow, start, end);
    expect(section[0]).toEqual(pointOnFlow(flow, start));
    expect(section.at(-1)).toEqual(pointOnFlow(flow, end));
    expect(visibleFlowWindow(1)).toEqual([1, 1]);
  });
});
