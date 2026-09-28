import type { HabitatCell, SpeciesDataset } from './schema';

// Keep the two visual claims distinct at the map boundary. The existing
// species contract stores both sets as habitat periods for compatibility, but
// an OBIS observation is never a forecast or a modeled habitat cell here.
export type MapPresentation =
  | { kind: 'observations'; observedAreas: HabitatCell[]; illustrativeDestinations: HabitatCell[] }
  | { kind: 'model'; currentHabitat: HabitatCell[]; futureHabitat: HabitatCell[] };

export function mapPresentation(dataset: SpeciesDataset, showIllustration: boolean): MapPresentation {
  if (dataset.provenance === 'observation-demo') {
    return {
      kind: 'observations',
      observedAreas: dataset.habitat.current,
      illustrativeDestinations: showIllustration ? dataset.habitat.future : []
    };
  }
  return { kind: 'model', currentHabitat: dataset.habitat.current, futureHabitat: dataset.habitat.future };
}
