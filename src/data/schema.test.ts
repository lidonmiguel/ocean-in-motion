import { describe, expect, it } from 'vitest';
import tuna from './species/tuna.json';
import turtle from './species/turtle.json';
import whaleShark from './species/whale-shark.json';
import { parseSpeciesDataset } from './schema';

describe('species dataset contract', () => {
  it('accepts all three synthetic fixtures with explicit provenance', () => {
    for (const raw of [tuna, turtle, whaleShark]) {
      const data = parseSpeciesDataset(raw);
      expect(data.provenance).toBe('synthetic-demo');
      expect(data.reviewStatus).toBe('illustrative');
      expect(data.scenario).toBe('SSP2-4.5');
      expect(data.habitat.current.length).toBeGreaterThan(0);
      expect(data.habitat.future.length).toBeGreaterThan(0);
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
