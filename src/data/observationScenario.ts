import { parseSpeciesDataset, type SpeciesDataset } from './schema';
import { isOcean, waterSegment } from './oceanRoutes';

export type ObservationSnapshot = {
  species: string;
  region: string;
  period: string;
  boundsWgs84: number[];
  clusterDiameterKm?: number;
  source: { datasetId: string; url: string; citation: string; license: string };
  summary: { count: number; uncertaintyKmRange: number[] | null; unknownCoordinateUncertainty?: number };
  observations: { id: string; longitude: number; latitude: number; eventDate: string; coordinateUncertaintyInMeters: number | null }[];
};

export type SpeciesMetadata = Pick<SpeciesDataset, 'schemaVersion' | 'id' | 'scientificName' | 'commonNameEs' | 'group' | 'summaryEs'>;

export type ObservationBounds = [west: number, south: number, east: number, north: number];

function distanceKm(a: ObservationSnapshot['observations'][number], b: ObservationSnapshot['observations'][number]) {
  const radians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLon = (b.longitude - a.longitude) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Complete-link grouping: every pair in a group stays within the declared
// diameter, so chains of nearby points cannot make an ocean-wide square.
export function observationGroups(records: ObservationSnapshot['observations'], diameterKm?: number) {
  if (diameterKm === undefined) return [records];
  if (!Number.isFinite(diameterKm) || diameterKm <= 0) throw new Error('Invalid geographic grouping diameter');
  const groups: ObservationSnapshot['observations'][] = [];
  for (const record of [...records].sort((a, b) => a.longitude - b.longitude || a.latitude - b.latitude || a.id.localeCompare(b.id))) {
    let nearest = -1, smallestMaxDistance = Infinity;
    for (let index = 0; index < groups.length; index++) {
      const maxDistance = Math.max(...groups[index].map(other => distanceKm(record, other)));
      if (maxDistance <= diameterKm && maxDistance < smallestMaxDistance) {
        nearest = index;
        smallestMaxDistance = maxDistance;
      }
    }
    if (nearest < 0) groups.push([record]);
    else groups[nearest].push(record);
  }
  return groups;
}

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

// One box per scoped geographic group, regardless of how many records it contains.
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
  const repeatedDatasets = new Set(snapshots.filter((snapshot, index) =>
    snapshots.findIndex(other => other.source.datasetId === snapshot.source.datasetId) !== index
  ).map(snapshot => snapshot.source.datasetId));
  const boxes = snapshots.flatMap(snapshot => {
    if (snapshot.species !== template.scientificName || snapshot.summary.count !== snapshot.observations.length
        || (snapshot.summary.uncertaintyKmRange !== null && snapshot.summary.uncertaintyKmRange.length !== 2)
        || snapshot.boundsWgs84.length !== 4 || !snapshot.boundsWgs84.every(Number.isFinite)) {
      throw new Error('Source species, count or bounds are inconsistent');
    }
    const groups = observationGroups(snapshot.observations, snapshot.clusterDiameterKm);
    const datasetKey = snapshot.source.datasetId.replaceAll('-', '');
    const scopeKey = repeatedDatasets.has(snapshot.source.datasetId)
      ? snapshot.boundsWgs84.map(value => Math.round((value + 180) * 1e6).toString(36)).join('x') : '';
    return groups.map((records, index) => {
      const boxId = `${datasetKey}${scopeKey}${groups.length > 1 ? `c${index + 1}` : ''}`;
      if (ids.has(boxId)) throw new Error('Repeated dataset region or geographic group');
      ids.add(boxId);
      const box = enclosingObservationBox(records);
      const base = { id: boxId, center: box.center, widthDeg: box.widthDeg, heightDeg: box.heightDeg };
      // A single fixed translation can end on land for coastal and island
      // groups. Try nearby directions and lengths deterministically.
      const directions: [number, number][] = [simulationOffsetDeg,
        [-simulationOffsetDeg[0], -simulationOffsetDeg[1]], [2, 0], [-2, 0], [0, 2], [0, -2],
        [1, 1], [-1, 1], [1, -1], [-1, -1]];
      const offsets: [number, number][] = [1, 0.5, 0.25, 1.5, 2, 3].flatMap(scale =>
        directions.map(([dx, dy]) => [dx * scale, dy * scale] as [number, number]));
      const marine = ([dx, dy]: [number, number]) => {
        const target: [number, number] = [box.center[0] + dx, box.center[1] + dy];
        return (dx !== 0 || dy !== 0) && isOcean(target);
      };
      const chosenOffset = offsets.find(offset => marine(offset) && waterSegment(box.center, [box.center[0] + offset[0], box.center[1] + offset[1]]))
        ?? offsets.find(marine);
      if (!chosenOffset) throw new Error(`No marine illustrative destination near ${boxId}`);
      const futureCenter: [number, number] = [box.center[0] + chosenOffset[0], box.center[1] + chosenOffset[1]];
      return { snapshot, records, box, boxId, chosenOffset,
        region: groups.length > 1 ? `${snapshot.region} · zona ${index + 1}/${groups.length}` : snapshot.region,
        current: base, future: { ...base, center: futureCenter } };
    });
  });
  return parseSpeciesDataset({
    ...template,
    provenance: 'observation-demo', reviewStatus: 'illustrative', scenario: 'illustrative',
    periods: { current: snapshots.length === 1 ? snapshots[0].period : `${observedYears[0]}–${observedYears.at(-1)}`, future: 'Simulación visual' },
    ecologyEs: 'Cada caja turquesa engloba los registros documentados de una región. Las rosas y sus trazos muestran traslaciones visuales sin modelo predictivo.',
    citations: [
      ...boxes.map(({ snapshot, boxId }) => ({ id: boxId, title: snapshot.source.citation, url: snapshot.source.url, role: 'occurrence' })),
      { id: 'visual-only', title: 'Traslación ilustrativa sin modelo predictivo', url: null, role: 'demonstration' }
    ],
    habitat: { current: boxes.map(b => b.current), future: boxes.map(b => b.future) },
    movementVectors: undefined,
    occurrence: {
      count: snapshots.reduce((sum, s) => sum + s.summary.count, 0),
      sources: boxes.map(({ snapshot, records, box, boxId, chosenOffset, region }) => ({
        boxId, datasetId: snapshot.source.datasetId, sourceUrl: snapshot.source.url, region,
        citation: snapshot.source.citation, license: snapshot.source.license,
        count: records.length,
        simulationOffsetDeg: chosenOffset,
        coordinateUncertaintyKmRange: (() => {
          const values = records.flatMap(record => record.coordinateUncertaintyInMeters === null ? [] : [record.coordinateUncertaintyInMeters / 1000]);
          const precision = snapshot.summary.uncertaintyKmRange?.some(value => value > 0 && value < 1) ? 3 : 0;
          return values.length ? [Number(Math.min(...values).toFixed(precision)), Number(Math.max(...values).toFixed(precision))] as [number, number] : null;
        })(),
        observedBoundsWgs84: box.observedBoundsWgs84
      }))
    }
  });
}
