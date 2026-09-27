import { describe, expect, it } from 'vitest';
import tuna from './species/tuna.json';
import { species } from './index';
import { parseSpeciesDataset } from './schema';

describe('species dataset contract', () => {
  it('accepts all seven synthetic fixtures with explicit provenance and a display group', () => {
    expect(species).toHaveLength(7);
    expect(new Set(species.map(item => item.id)).size).toBe(7);
    expect(species.filter(item => item.group === 'fish')).toHaveLength(3);
    expect(species.filter(item => item.group === 'cetacean')).toHaveLength(2);
    expect(species.filter(item => item.group === 'reptile')).toHaveLength(2);
    for (const raw of species) {
      const data = parseSpeciesDataset(raw);
      expect(data.provenance).toBe('synthetic-demo');
      expect(['fish', 'cetacean', 'reptile']).toContain(data.group);
      expect(data.reviewStatus).toBe('illustrative');
      expect(data.scenario).toBe('SSP2-4.5');
      expect(data.habitat.current.length).toBeGreaterThan(0);
      expect(data.habitat.future.length).toBeGreaterThan(0);
      expect(data.habitat.current.map(cell => cell.id)).toEqual(data.habitat.future.map(cell => cell.id));
    }
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
