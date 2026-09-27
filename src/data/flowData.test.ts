import { describe, expect, it } from 'vitest';
import tuna from './species/tuna.json';
import { displayFlows, pointOnFlow } from './flowData';
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
});
