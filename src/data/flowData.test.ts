import { describe, expect, it } from 'vitest';
import tuna from './species/tuna.json';
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

  it('keeps the decorative strands inside source and target cells', () => {
    const dataset = parseSpeciesDataset(tuna);
    const strands = displayStreamlines(dataset);
    expect(strands.length).toBeGreaterThan(100);
    for (const strand of strands) {
      const fromCell = dataset.habitat.current.find(cell =>
        Math.abs(strand.from[0] - cell.center[0]) <= cell.widthDeg / 2 &&
        Math.abs(strand.from[1] - cell.center[1]) <= cell.heightDeg / 2
      );
      const toCell = dataset.habitat.future.find(cell =>
        Math.abs(strand.to[0] - cell.center[0]) <= cell.widthDeg / 2 &&
        Math.abs(strand.to[1] - cell.center[1]) <= cell.heightDeg / 2
      );
      expect(fromCell).toBeDefined();
      expect(toCell).toBeDefined();
      expect(pointOnFlow(strand, 0)).toEqual(strand.from);
      expect(pointOnFlow(strand, 1)[1]).toBeCloseTo(strand.to[1]);
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
