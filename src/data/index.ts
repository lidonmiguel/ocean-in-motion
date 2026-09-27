import tuna from './species/tuna.json';
import turtle from './species/turtle.json';
import whaleShark from './species/whale-shark.json';
import humpback from './species/humpback-whale.json';
import bottlenose from './species/bottlenose-dolphin.json';
import swordfish from './species/swordfish.json';
import loggerhead from './species/loggerhead-turtle.json';
import { parseSpeciesDataset } from './schema';

export const species = [tuna, whaleShark, swordfish, humpback, bottlenose, turtle, loggerhead].map(parseSpeciesDataset);
