import { describe, expect, it } from 'vitest';
import { categories, categorySpeciesId, categoryView } from './categoryViews';
import { displayStreamlines } from './flowData';
import { species } from './index';

describe('combined category views', () => {
  it('shows all members and source regions without mixing species identities', () => {
    expect(categories.map(item => item.group)).toEqual(['fish', 'cetacean', 'reptile']);
    for (const category of categories) {
      const { view, members } = category;
      expect(members.length).toBeGreaterThan(1);
      expect(view.occurrence?.count).toBe(members.reduce((sum, member) => sum + member.occurrence!.count, 0));
      expect(view.habitat.current.length).toBe(members.reduce((sum, member) => sum + member.habitat.current.length, 0));
      expect(view.occurrence?.sources.length).toBe(view.habitat.current.length);
      expect(new Set(view.habitat.current.map(cell => cell.id)).size).toBe(view.habitat.current.length);
      for (const member of members) {
        expect(view.habitat.current.filter(cell => categorySpeciesId(cell.id) === member.id))
          .toEqual(member.habitat.current.map(cell => ({ ...cell, id: `${member.id}:${cell.id}` })));
        expect(view.occurrence!.sources.filter(source => categorySpeciesId(source.boxId) === member.id))
          .toHaveLength(member.occurrence!.sources.length);
      }
    }
  });

  it('keeps a water-only illustrated strand for each region at combined-view density', () => {
    for (const category of categories) {
      const strands = displayStreamlines(category.view, 6);
      const boxesWithStrands = new Set(strands.map(strand => strand.id.slice(0, strand.id.lastIndexOf('-'))));
      expect(boxesWithStrands.size, category.group).toBe(category.view.habitat.future.length);
    }
  }, 25_000);

  it('rejects unrelated species in a category', () => {
    expect(() => categoryView('fish', [species[0], species.find(item => item.group === 'cetacean')!])).toThrow();
  });
});
