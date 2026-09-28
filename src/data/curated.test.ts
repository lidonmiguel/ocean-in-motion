import { describe, expect, it } from 'vitest';
import tuna from './curated/atlantic-bluefin-tuna.json';
import { snapshotsFromCurated } from './curated';

describe('clean OBIS contract', () => {
  it('keeps source provenance and reconciles the accepted records', () => {
    const scopes = snapshotsFromCurated(tuna, 'atlantic-bluefin-tuna');
    expect(scopes).toHaveLength(8);
    expect(scopes.reduce((sum, scope) => sum + scope.observations.length, 0)).toBe(957);
    expect(scopes.every(scope => scope.source.citation && scope.source.license)).toBe(true);
  });

  it('refuses an occurrence outside its reviewed query bounds', () => {
    const changed = structuredClone(tuna);
    changed.observations[0].latitude = 91;
    expect(() => snapshotsFromCurated(changed, 'atlantic-bluefin-tuna')).toThrow();
  });
});
