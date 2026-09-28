import { describe, expect, it } from 'vitest';
import { species } from './index';
import { parseSpeciesDataset } from './schema';

describe('species dataset contract', () => {
  it('registers seven species and a separate square for each scoped source', () => {
    expect(species).toHaveLength(7);
    expect(new Set(species.map(item => item.id)).size).toBe(7);
    expect(species.filter(item => item.group === 'fish')).toHaveLength(3);
    expect(species.filter(item => item.group === 'cetacean')).toHaveLength(2);
    expect(species.filter(item => item.group === 'reptile')).toHaveLength(2);
    for (const data of species) {
      expect(parseSpeciesDataset(data)).toEqual(data);
      expect(data.provenance).toBe('observation-demo');
      expect(data.reviewStatus).toBe('illustrative');
      expect(data.scenario).toBe('illustrative');
      expect(data.occurrence!.count).toBeGreaterThan(0);
      expect(data.habitat.current).toHaveLength(data.id === 'atlantic-bluefin-tuna' ? 13 : 1);
      expect(data.habitat.current[0].suitability).toBeUndefined();
      expect(data.citations.some(c => c.role === 'occurrence' && c.url)).toBe(true);
    }
  });

  it('rejects invented suitability and false model approval for an observation layer', () => {
    const tuna = species[0];
    expect(() => parseSpeciesDataset({ ...tuna, habitat: { ...tuna.habitat,
      current: [{ ...tuna.habitat.current[0], suitability: 0.9 }] } })).toThrow();
    expect(() => parseSpeciesDataset({ ...tuna, reviewStatus: 'approved' })).toThrow();
    expect(() => parseSpeciesDataset({ ...tuna, habitat: { ...tuna.habitat,
      future: [tuna.habitat.future[0], tuna.habitat.future[0]] } })).toThrow();
  });
});
