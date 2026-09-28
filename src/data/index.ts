import metadata from './speciesMetadata.json';
import tuna from './observations/tuna-west-med.json';
import tunaNybight from './observations/tuna-ny-bight.json';
import tunaBiscay from './observations/tuna-biscay.json';
import tunaHatteras from './observations/tuna-hatteras.json';
import tunaIonian from './observations/tuna-ionian.json';
import tunaEastMed from './observations/tuna-east-med.json';
import tunaNorthSea from './observations/tuna-north-sea.json';
import tunaNovaScotia from './observations/tuna-nova-scotia.json';
import whaleShark from './observations/whale-shark-gulf.json';
import swordfish from './observations/swordfish-west-med.json';
import humpback from './observations/humpback-gulf-maine.json';
import bottlenose from './observations/bottlenose-west-med.json';
import greenTurtle from './observations/green-turtle-caribbean.json';
import loggerhead from './observations/loggerhead-west-med.json';
import whale_shark_gulf_cal from './observations/whale-shark-gulf-cal.json';
import whale_shark_philippines from './observations/whale-shark-philippines.json';
import whale_shark_ningaloo from './observations/whale-shark-ningaloo.json';
import whale_shark_mozambique from './observations/whale-shark-mozambique.json';
import whale_shark_maldives from './observations/whale-shark-maldives.json';
import swordfish_east_med from './observations/swordfish-east-med.json';
import swordfish_us_east from './observations/swordfish-us-east.json';
import swordfish_california from './observations/swordfish-california.json';
import swordfish_iberian from './observations/swordfish-iberian.json';
import humpback_hawaii from './observations/humpback-hawaii.json';
import humpback_alaska from './observations/humpback-alaska.json';
import humpback_australia from './observations/humpback-australia.json';
import humpback_south_africa from './observations/humpback-south-africa.json';
import humpback_iceland from './observations/humpback-iceland.json';
import bottlenose_gulf_mexico from './observations/bottlenose-gulf-mexico.json';
import bottlenose_california from './observations/bottlenose-california.json';
import bottlenose_australia from './observations/bottlenose-australia.json';
import bottlenose_caribbean from './observations/bottlenose-caribbean.json';
import bottlenose_south_africa from './observations/bottlenose-south-africa.json';
import green_turtle_hawaii from './observations/green-turtle-hawaii.json';
import green_turtle_australia from './observations/green-turtle-australia.json';
import green_turtle_red_sea from './observations/green-turtle-red-sea.json';
import green_turtle_seychelles from './observations/green-turtle-seychelles.json';
import green_turtle_galapagos from './observations/green-turtle-galapagos.json';
import loggerhead_florida from './observations/loggerhead-florida.json';
import loggerhead_east_med from './observations/loggerhead-east-med.json';
import loggerhead_japan from './observations/loggerhead-japan.json';
import loggerhead_australia from './observations/loggerhead-australia.json';
import loggerhead_south_africa from './observations/loggerhead-south-africa.json';
import { buildObservationScenario, type ObservationSnapshot, type SpeciesMetadata } from './observationScenario';

// Only cited, bounded occurrence extracts appear in the species selector.
// Offsets belong solely to the labeled visual demonstration, not the sources.
export const sourceLayers: [string, ObservationSnapshot[], [number, number]][] = [
  ['atlantic-bluefin-tuna', [tuna, tunaNybight, tunaBiscay, tunaHatteras, tunaIonian, tunaEastMed, tunaNorthSea, tunaNovaScotia], [0, -2]],
  ['whale-shark', [whaleShark, whale_shark_gulf_cal, whale_shark_philippines, whale_shark_ningaloo, whale_shark_mozambique, whale_shark_maldives], [0, 2]],
  ['swordfish', [swordfish, swordfish_east_med, swordfish_us_east, swordfish_california, swordfish_iberian], [2, 0]],
  ['humpback-whale', [humpback, humpback_hawaii, humpback_alaska, humpback_australia, humpback_south_africa, humpback_iceland], [0, -2]],
  ['bottlenose-dolphin', [bottlenose, bottlenose_gulf_mexico, bottlenose_california, bottlenose_australia, bottlenose_caribbean, bottlenose_south_africa], [0, -2]],
  ['green-sea-turtle', [greenTurtle, green_turtle_hawaii, green_turtle_australia, green_turtle_red_sea, green_turtle_seychelles, green_turtle_galapagos], [0, -2]],
  ['loggerhead-turtle', [loggerhead, loggerhead_florida, loggerhead_east_med, loggerhead_japan, loggerhead_australia, loggerhead_south_africa], [0, -2]]
];

export const species = sourceLayers.map(([id, snapshots, offset]) => {
  const template = metadata.find(item => item.id === id);
  if (!template) throw new Error(`Missing species metadata: ${id}`);
  return buildObservationScenario(template as SpeciesMetadata, snapshots, offset);
});
