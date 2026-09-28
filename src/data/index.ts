import metadata from './speciesMetadata.json';
import tuna from './curated/atlantic-bluefin-tuna.json';
import whaleShark from './curated/whale-shark.json';
import swordfish from './curated/swordfish.json';
import humpback from './curated/humpback-whale.json';
import bottlenose from './curated/bottlenose-dolphin.json';
import greenTurtle from './curated/green-sea-turtle.json';
import loggerhead from './curated/loggerhead-turtle.json';
import killerWhale from './curated/killer-whale.json';
import whiteShark from './curated/great-white-shark.json';
import leatherback from './curated/leatherback-turtle.json';
import { snapshotsFromCurated } from './curated';
import { buildObservationScenario, type ObservationSnapshot, type SpeciesMetadata } from './observationScenario';

// The web reads only the validated species-level files. Each file keeps
// the accepted records and scoped source metadata needed to rebuild boxes.
// Offsets belong solely to the labeled visual demonstration, not the sources.
export const sourceLayers: [string, ObservationSnapshot[], [number, number]][] = [
  ['atlantic-bluefin-tuna', snapshotsFromCurated(tuna, 'atlantic-bluefin-tuna'), [0, -12]],
  ['whale-shark', snapshotsFromCurated(whaleShark, 'whale-shark'), [0, 12]],
  ['swordfish', snapshotsFromCurated(swordfish, 'swordfish'), [12, 0]],
  ['great-white-shark', snapshotsFromCurated(whiteShark, 'great-white-shark'), [12, 0]],
  ['humpback-whale', snapshotsFromCurated(humpback, 'humpback-whale'), [0, -12]],
  ['bottlenose-dolphin', snapshotsFromCurated(bottlenose, 'bottlenose-dolphin'), [0, -12]],
  ['killer-whale', snapshotsFromCurated(killerWhale, 'killer-whale'), [0, -12]],
  ['green-sea-turtle', snapshotsFromCurated(greenTurtle, 'green-sea-turtle'), [0, -12]],
  ['loggerhead-turtle', snapshotsFromCurated(loggerhead, 'loggerhead-turtle'), [0, -12]],
  ['leatherback-turtle', snapshotsFromCurated(leatherback, 'leatherback-turtle'), [12, 0]]
];

export const species = sourceLayers.map(([id, snapshots, offset]) => {
  const template = metadata.find(item => item.id === id);
  if (!template) throw new Error(`Missing species metadata: ${id}`);
  return buildObservationScenario(template as SpeciesMetadata, snapshots, offset);
});
