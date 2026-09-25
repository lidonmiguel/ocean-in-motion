import tuna from './species/tuna.json';
import turtle from './species/turtle.json';
import whaleShark from './species/whale-shark.json';
import { parseSpeciesDataset } from './schema';

export const species = [tuna, turtle, whaleShark].map(parseSpeciesDataset);
