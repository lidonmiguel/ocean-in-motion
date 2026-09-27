import tuna from './species/tuna.json';
import turtle from './species/turtle.json';
import whaleShark from './species/whale-shark.json';
import humpback from './species/humpback-whale.json';
import bottlenose from './species/bottlenose-dolphin.json';
import swordfish from './species/swordfish.json';
import loggerhead from './species/loggerhead-turtle.json';
import pilot from './observations/loggerhead-west-med.json';
import { buildObservationScenario } from './observationScenario';
import { parseSpeciesDataset } from './schema';

const fixtures = [tuna, whaleShark, swordfish, humpback, bottlenose, turtle].map(parseSpeciesDataset);
// Add future scoped extracts to this registry. Each source yields one computed
// observation box; no coordinates from the old illustrative fixture are used.
const loggerheadScenario = buildObservationScenario(parseSpeciesDataset(loggerhead), [pilot], [0, -2]);
export const species = [...fixtures, loggerheadScenario];
