import { describe, expect, it } from 'vitest';
import tuna from './species/tuna.json';
import { species } from './index';
import { parseSpeciesDataset } from './schema';

describe('species dataset contract', () => {
  it('keeps the six synthetic fixtures distinct from the observation-derived turtle', () => {
    expect(species).toHaveLength(7);
    expect(new Set(species.map(item => item.id)).size).toBe(7);
    expect(species.filter(item => item.group === 'fish')).toHaveLength(3);
    expect(species.filter(item => item.group === 'cetacean')).toHaveLength(2);
    expect(species.filter(item => item.group === 'reptile')).toHaveLength(2);
    for (const raw of species.filter(item => item.provenance === 'synthetic-demo')) {
      const data = parseSpeciesDataset(raw);
      expect(data.provenance).toBe('synthetic-demo');
      expect(['fish', 'cetacean', 'reptile']).toContain(data.group);
      expect(data.reviewStatus).toBe('illustrative');
      expect(data.scenario).toBe('SSP2-4.5');
      expect(data.habitat.current.length).toBeGreaterThan(0);
      expect(data.habitat.future.length).toBeGreaterThan(0);
      expect(data.habitat.current.map(cell => cell.id)).toEqual(data.habitat.future.map(cell => cell.id));
    }
    const loggerhead = species.find(item => item.id === 'loggerhead-turtle')!;
    expect(loggerhead.provenance).toBe('observation-demo');
    expect(loggerhead.occurrence?.count).toBe(117);
    expect(loggerhead.habitat.current).toHaveLength(1);
    expect(loggerhead.habitat.current[0].suitability).toBeUndefined();
    expect(loggerhead.scenario).toBe('illustrative');
  });

  it('rejects invalid suitability and geographic coordinates', () => {
    expect(() => parseSpeciesDataset({ ...tuna, habitat: { ...tuna.habitat, current: [{ ...tuna.habitat.current[0], suitability: 1.2 }] } })).toThrow();
    expect(() => parseSpeciesDataset({ ...tuna, habitat: { ...tuna.habitat, current: [{ ...tuna.habitat.current[0], center: [190, 20] }] } })).toThrow();
  });

  it('rejects falsely reviewed demo data and duplicate cells', () => {
    expect(() => parseSpeciesDataset({ ...tuna, reviewStatus: 'approved' })).toThrow();
    expect(() => parseSpeciesDataset({ ...tuna, habitat: { ...tuna.habitat, future: [tuna.habitat.future[0], tuna.habitat.future[0]] } })).toThrow();
  });

  it('does not let synthetic fixtures imply OBIS or environmental provenance', () => {
    expect(() => parseSpeciesDataset({ ...tuna, citations: [{ id: 'fake', title: 'OBIS', url: 'https://obis.org', role: 'occurrence' }] })).toThrow();
  });
});
