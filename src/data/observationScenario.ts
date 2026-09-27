import { parseSpeciesDataset, type SpeciesDataset } from './schema';

export type ObservationSnapshot = {
  species: string;
  region: string;
  period: string;
  source: { datasetId: string; url: string; citation: string; license: string };
  summary: { count: number; uncertaintyKmRange: number[] };
  observations: { id: string; longitude: number; latitude: number; coordinateUncertaintyInMeters: number }[];
};

export type ObservationBounds = [west: number, south: number, east: number, north: number];

// A square in approximate ground distance, centered on the extrema of reported
// positions. It describes survey coverage, not habitat or coordinate precision.
export function enclosingObservationBox(records: ObservationSnapshot['observations'], marginKm = 20) {
  if (!records.length || !Number.isFinite(marginKm) || marginKm < 0) throw new Error('A nonempty regional extract and a valid margin are required');
  const ids = new Set<string>();
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const record of records) {
    if (!record.id || ids.has(record.id) || !Number.isFinite(record.longitude)
        || !Number.isFinite(record.latitude) || Math.abs(record.longitude) > 180
        || Math.abs(record.latitude) > 85 || !Number.isFinite(record.coordinateUncertaintyInMeters)
        || record.coordinateUncertaintyInMeters < 0) throw new Error('Invalid or duplicate observation');
    ids.add(record.id);
    west = Math.min(west, record.longitude);
    east = Math.max(east, record.longitude);
    south = Math.min(south, record.latitude);
    north = Math.max(north, record.latitude);
  }
  const latitude = (south + north) / 2;
  const longitude = (west + east) / 2;
  const kmPerLon = 111.32 * Math.cos(latitude * Math.PI / 180);
  const sideKm = Math.max((east - west) * kmPerLon, (north - south) * 111.32) + marginKm * 2;
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
  template: SpeciesDataset,
  snapshots: ObservationSnapshot[],
  simulationOffsetDeg: [number, number]
): SpeciesDataset {
  if (!snapshots.length || !simulationOffsetDeg.every(Number.isFinite)
      || simulationOffsetDeg.every(value => value === 0)) throw new Error('A scoped source and explicit nonzero demonstration offset are required');
  const ids = new Set<string>();
  const boxes = snapshots.map(snapshot => {
    if (snapshot.species !== template.scientificName || snapshot.summary.count !== snapshot.observations.length
        || snapshot.summary.uncertaintyKmRange.length !== 2
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
    periods: { current: snapshots.map(s => s.period).join(' / '), future: 'Simulación visual' },
    ecologyEs: 'La caja turquesa se calcula con los avistamientos documentados; la rosa es una traslación visual, no una predicción.',
    citations: [
      ...snapshots.map(({ source }) => ({ id: source.datasetId, title: source.citation, url: source.url, role: 'occurrence' })),
      { id: 'visual-only', title: 'Traslación ilustrativa sin modelo predictivo', url: null, role: 'demonstration' }
    ],
    habitat: { current: boxes.map(b => b.current), future: boxes.map(b => b.future) },
    movementVectors: undefined,
    occurrence: {
      count: snapshots.reduce((sum, s) => sum + s.summary.count, 0),
      sources: boxes.map(({ snapshot, box }) => ({
        datasetId: snapshot.source.datasetId, sourceUrl: snapshot.source.url,
        citation: snapshot.source.citation, license: snapshot.source.license,
        count: snapshot.summary.count, coordinateUncertaintyKmRange: snapshot.summary.uncertaintyKmRange,
        observedBoundsWgs84: box.observedBoundsWgs84
      })),
      simulationOffsetDeg
    }
  });
}
