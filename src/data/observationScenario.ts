import { parseSpeciesDataset, type SpeciesDataset } from './schema';
import { isOcean } from './oceanRoutes';

export type ObservationSnapshot = {
  species: string;
  region: string;
  period: string;
  source: { datasetId: string; url: string; citation: string; license: string };
  summary: { count: number; uncertaintyKmRange: number[] | null; unknownCoordinateUncertainty?: number };
  observations: { id: string; longitude: number; latitude: number; eventDate: string; coordinateUncertaintyInMeters: number | null }[];
};

export type SpeciesMetadata = Pick<SpeciesDataset, 'schemaVersion' | 'id' | 'scientificName' | 'commonNameEs' | 'group' | 'summaryEs'>;

export type ObservationBounds = [west: number, south: number, east: number, north: number];

// A square in approximate ground distance enclosing reported positions. Its
// display center can shift to water; it is not a habitat or precision estimate.
export function enclosingObservationBox(records: ObservationSnapshot['observations'], marginKm = 20) {
  if (!records.length || !Number.isFinite(marginKm) || marginKm < 0) throw new Error('A nonempty regional extract and a valid margin are required');
  const ids = new Set<string>();
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const record of records) {
    if (!record.id || ids.has(record.id) || !Number.isFinite(record.longitude)
        || !Number.isFinite(record.latitude) || Math.abs(record.longitude) > 180
        || Math.abs(record.latitude) > 85 || (record.coordinateUncertaintyInMeters !== null
        && (!Number.isFinite(record.coordinateUncertaintyInMeters)
        || record.coordinateUncertaintyInMeters < 0))) throw new Error('Invalid or duplicate observation');
    ids.add(record.id);
    west = Math.min(west, record.longitude);
    east = Math.max(east, record.longitude);
    south = Math.min(south, record.latitude);
    north = Math.max(north, record.latitude);
  }
  let latitude = (south + north) / 2;
  let longitude = (west + east) / 2;
  // A bounding box across a bay or island may have a midpoint on land even
  // when every sighting is marine. Move only its visual center to nearby water;
  // increase the side as necessary so all original positions remain enclosed.
  if (!isOcean([longitude, latitude])) {
    let nearest: [number, number] | null = null;
    let best = Infinity;
    for (let y = -25; y <= 25; y++) for (let x = -25; x <= 25; x++) {
      const candidate: [number, number] = [longitude + x * 0.2, latitude + y * 0.2];
      const distance = Math.hypot(x * Math.cos(latitude * Math.PI / 180), y);
      if (distance < best && isOcean(candidate)) { nearest = candidate; best = distance; }
    }
    if (!nearest) throw new Error('No ocean center near the scoped observations');
    [longitude, latitude] = nearest;
  }
  const kmPerLon = 111.32 * Math.cos(latitude * Math.PI / 180);
  const sideKm = Math.max(2 * Math.max(east - longitude, longitude - west) * kmPerLon,
    2 * Math.max(north - latitude, latitude - south) * 111.32) + marginKm * 2;
  const widthDeg = sideKm / kmPerLon;
  const heightDeg = sideKm / 111.32;
  if (widthDeg > 20 || heightDeg > 20 || west < -180 + widthDeg / 2
      || east > 180 - widthDeg / 2 || Math.abs(latitude) + heightDeg / 2 > 85) {
    throw new Error('Observations span too large an area; stage separate regional extracts');
  }
  return { center: [longitude, latitude] as [number, number], widthDeg, heightDeg,
    observedBoundsWgs84: [west, south, east, north] as ObservationBounds };
}

// One box per scoped dataset, regardless of how many records it contains.
// A caller can later replace the illustrative future with a reviewed model;
// this function never claims to infer a future distribution from sightings.
export function buildObservationScenario(
  template: SpeciesMetadata,
  snapshots: ObservationSnapshot[],
  simulationOffsetDeg: [number, number]
): SpeciesDataset {
  if (!snapshots.length || !simulationOffsetDeg.every(Number.isFinite)
      || simulationOffsetDeg.every(value => value === 0)) throw new Error('A scoped source and explicit nonzero demonstration offset are required');
  const ids = new Set<string>();
  const observedYears = snapshots.flatMap(snapshot => snapshot.observations.map(row => row.eventDate.slice(0, 4))).sort();
  const boxes = snapshots.map(snapshot => {
    if (snapshot.species !== template.scientificName || snapshot.summary.count !== snapshot.observations.length
        || (snapshot.summary.uncertaintyKmRange !== null && snapshot.summary.uncertaintyKmRange.length !== 2)
        || ids.has(snapshot.source.datasetId)) throw new Error('Source species, count or dataset ID is inconsistent');
    ids.add(snapshot.source.datasetId);
    const box = enclosingObservationBox(snapshot.observations);
    const base = { id: snapshot.source.datasetId.replaceAll('-', ''), center: box.center,
      widthDeg: box.widthDeg, heightDeg: box.heightDeg };
    const futureCenter: [number, number] = [
      box.center[0] + simulationOffsetDeg[0], box.center[1] + simulationOffsetDeg[1]
    ];
    return { snapshot, box, current: base, future: { ...base, center: futureCenter } };
  });
  return parseSpeciesDataset({
    ...template,
    provenance: 'observation-demo', reviewStatus: 'illustrative', scenario: 'illustrative',
    periods: { current: snapshots.length === 1 ? snapshots[0].period : `${observedYears[0]}–${observedYears.at(-1)}`, future: 'Simulación visual' },
    ecologyEs: 'Cada caja turquesa engloba los registros documentados de una región. Las rosas y sus trazos muestran traslaciones visuales sin modelo predictivo.',
    citations: [
      ...snapshots.map(({ source }) => ({ id: source.datasetId, title: source.citation, url: source.url, role: 'occurrence' })),
      { id: 'visual-only', title: 'Traslación ilustrativa sin modelo predictivo', url: null, role: 'demonstration' }
    ],
    habitat: { current: boxes.map(b => b.current), future: boxes.map(b => b.future) },
    movementVectors: undefined,
    occurrence: {
      count: snapshots.reduce((sum, s) => sum + s.summary.count, 0),
      sources: boxes.map(({ snapshot, box }) => ({
        datasetId: snapshot.source.datasetId, sourceUrl: snapshot.source.url, region: snapshot.region,
        citation: snapshot.source.citation, license: snapshot.source.license,
        count: snapshot.summary.count, coordinateUncertaintyKmRange: snapshot.summary.uncertaintyKmRange,
        observedBoundsWgs84: box.observedBoundsWgs84
      })),
      simulationOffsetDeg
    }
  });
}
