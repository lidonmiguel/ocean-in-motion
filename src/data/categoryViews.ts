import { species } from './index';
import { parseSpeciesDataset, type SpeciesDataset } from './schema';

type Group = NonNullable<SpeciesDataset['group']>;

export const categoryOptions: { group: Group; label: string; shortLabel: string }[] = [
  { group: 'fish', label: 'Todos los peces', shortLabel: 'Peces' },
  { group: 'cetacean', label: 'Todos los mamíferos marinos', shortLabel: 'Mamíferos marinos' },
  { group: 'reptile', label: 'Todos los reptiles marinos', shortLabel: 'Reptiles marinos' }
];

// Each species keeps its own color within a combined view. Pink remains the
// shared cue for illustrative destinations, regardless of source species.
export const categorySpeciesColors: Record<string, [number, number, number]> = {
  'atlantic-bluefin-tuna': [105, 237, 226],
  'whale-shark': [117, 181, 255],
  swordfish: [255, 207, 119],
  'humpback-whale': [105, 237, 226],
  'bottlenose-dolphin': [255, 207, 119],
  'green-sea-turtle': [105, 237, 226],
  'loggerhead-turtle': [117, 181, 255]
};

export function categorySpeciesId(boxId: string) {
  return boxId.split(':', 1)[0];
}

export function categoryView(group: Group, members: SpeciesDataset[]): SpeciesDataset {
  if (!members.length || members.some(member => member.group !== group || !member.occurrence)) {
    throw new Error('A category needs observation-backed members from the same group');
  }
  const label = categoryOptions.find(option => option.group === group)!.shortLabel;
  const years = members.flatMap(member => member.periods.current.match(/\d{4}/g) ?? []).sort();
  const scoped = (member: SpeciesDataset, id: string) => `${member.id}:${id}`;
  return parseSpeciesDataset({
    ...members[0],
    id: `all-${group}`,
    commonNameEs: label,
    scientificName: `${members.length} especies`,
    summaryEs: `Avistamientos documentados de ${members.length} especies de ${label.toLowerCase()}.`,
    ecologyEs: 'Cada caja turquesa o de color resume posiciones notificadas de una especie. Las cajas rosas y los trazos son desplazamientos visuales sin modelo predictivo.',
    periods: { current: `${years[0]}–${years.at(-1)}`, future: 'Simulación visual' },
    citations: members.flatMap(member => member.citations.map(citation => ({
      ...citation, id: scoped(member, citation.id)
    }))),
    habitat: {
      current: members.flatMap(member => member.habitat.current.map(cell => ({ ...cell, id: scoped(member, cell.id) }))),
      future: members.flatMap(member => member.habitat.future.map(cell => ({ ...cell, id: scoped(member, cell.id) })))
    },
    occurrence: {
      count: members.reduce((sum, member) => sum + member.occurrence!.count, 0),
      sources: members.flatMap(member => member.occurrence!.sources.map(source => ({
        ...source, boxId: scoped(member, source.boxId),
        region: `${member.commonNameEs} · ${source.region}`
      })))
    },
    movementVectors: undefined
  });
}

export const categories = categoryOptions.map(option => {
  const members = species.filter(item => item.group === option.group);
  return { ...option, selectionId: `group:${option.group}`, members,
    view: categoryView(option.group, members) };
});
