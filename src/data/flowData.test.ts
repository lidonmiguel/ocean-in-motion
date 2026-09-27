import { describe, expect, it } from 'vitest';
import tuna from './species/tuna.json';
import shark from './species/whale-shark.json';
import { displayFlows, displayStreamlines, pointOnFlow } from './flowData';
import { parseSpeciesDataset } from './schema';

describe('illustrative distribution flows', () => {
  it('connects matching fixture cell centers from current to 2050', () => {
    const dataset = parseSpeciesDataset(tuna);
    const flows = displayFlows(dataset);
    expect(flows).toHaveLength(6);
    expect(flows[0].from).toEqual(dataset.habitat.current[0].center);
    expect(pointOnFlow(flows[0], 1)).toEqual(dataset.habitat.future[0].center);
  });

  it('takes the short path across the antimeridian', () => {
    const dataset = parseSpeciesDataset(tuna);
    dataset.habitat.current[0].center = [179, 20];
    dataset.habitat.future[0].center = [-179, 24];
    const path = displayFlows(dataset)[0].path;
    expect(path[0]).toEqual([179, 20]);
    expect(path.at(-1)).toEqual([181, 24]);
    expect(path.every(([longitude]) => longitude >= 179 && longitude <= 181)).toBe(true);
  });

  it('keeps all strands on their matching cell pair and in the same direction', () => {
    for (const fixture of [tuna, shark]) {
      const dataset = parseSpeciesDataset(fixture);
      const strands = displayStreamlines(dataset);
      expect(strands).toHaveLength(108);
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
      }
    }
  });

  it('uses only explicit vectors for reviewed data', () => {
    const dataset = parseSpeciesDataset(tuna);
    dataset.provenance = 'reviewed-model';
    dataset.movementVectors = [];
    expect(displayStreamlines(dataset)).toEqual([]);
    dataset.movementVectors = [{ from: [-39, 34], to: [-37, 46], labelEs: 'Dirección' }];
    expect(displayStreamlines(dataset)).toHaveLength(1);
  });
});
