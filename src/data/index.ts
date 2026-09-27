import metadata from './speciesMetadata.json';
import tuna from './observations/tuna-west-med.json';
import whaleShark from './observations/whale-shark-gulf.json';
import swordfish from './observations/swordfish-west-med.json';
import humpback from './observations/humpback-gulf-maine.json';
import bottlenose from './observations/bottlenose-west-med.json';
import greenTurtle from './observations/green-turtle-caribbean.json';
import loggerhead from './observations/loggerhead-west-med.json';
import { buildObservationScenario, type ObservationSnapshot, type SpeciesMetadata } from './observationScenario';

// Only cited, bounded occurrence extracts appear in the species selector.
// Offsets belong solely to the labeled visual demonstration, not the sources.
const layers: [string, ObservationSnapshot, [number, number]][] = [
  ['atlantic-bluefin-tuna', tuna, [0, -2]],
  ['whale-shark', whaleShark, [0, 2]],
  ['swordfish', swordfish, [2, 0]],
  ['humpback-whale', humpback, [0, -2]],
  ['bottlenose-dolphin', bottlenose, [0, -2]],
  ['green-sea-turtle', greenTurtle, [0, -2]],
  ['loggerhead-turtle', loggerhead, [0, -2]]
];

export const species = layers.map(([id, snapshot, offset]) => {
  const template = metadata.find(item => item.id === id);
  if (!template) throw new Error(`Missing species metadata: ${id}`);
  return buildObservationScenario(template as SpeciesMetadata, [snapshot], offset);
});
