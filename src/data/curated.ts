import { z } from 'zod';
import type { ObservationSnapshot } from './observationScenario';

const nonnegativeCount = z.number().int().nonnegative();
const counts = z.record(z.string(), nonnegativeCount);
const scope = z.object({
  id: z.string().min(1), extractId: z.string().min(1), region: z.string().min(1), period: z.string().min(1),
  boundsWgs84: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  clusterDiameterKm: z.number().positive().optional(),
  query: z.object({ startDate: z.iso.date(), endDate: z.iso.date() }).strict(),
  dataset: z.object({
    datasetId: z.string().min(1), url: z.url(), citation: z.string().min(1),
    license: z.string().min(1), accessedAtUtc: z.string().min(1),
    extractSha256: z.string().regex(/^[0-9a-f]{64}$/)
  }).strict(),
  recordMetadata: z.object({
    basisOfRecordCounts: counts, samplingProtocolCounts: counts,
    missingSamplingProtocol: nonnegativeCount, recordLicenseCounts: counts,
    missingRecordLicense: nonnegativeCount
  }).strict(),
  quality: z.object({
    rawFetched: nonnegativeCount, staged: nonnegativeCount, accepted: nonnegativeCount,
    upstreamRejected: counts, rejectedByReason: counts,
    unknownCoordinateUncertainty: nonnegativeCount,
    uncertaintyKmRange: z.tuple([z.number().nonnegative(), z.number().nonnegative()]).nullable()
  }).strict()
}).strict();

const record = z.object({
  obisId: z.string().min(1), scopeId: z.string().min(1), eventDate: z.string().min(10),
  longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90),
  coordinateUncertaintyInMeters: z.number().nonnegative().nullable(),
  basisOfRecord: z.string().nullable(), samplingProtocol: z.string().nullable(),
  recordLicense: z.string().nullable(), rightsHolder: z.string().nullable(),
  providerOccurrenceId: z.string().nullable()
}).strict();

const curatedSchema = z.object({
  schemaVersion: z.literal(1), pipelineVersion: z.literal(2),
  species: z.object({
    id: z.string().min(1), scientificName: z.string().min(1), aphiaID: z.number().int().positive(),
    commonNameEs: z.string().min(1), group: z.enum(['fish', 'cetacean', 'reptile'])
  }).strict(),
  sourceScopes: z.array(scope).min(1), observations: z.array(record).min(1),
  quality: z.object({
    rawFetched: nonnegativeCount, staged: nonnegativeCount, accepted: nonnegativeCount,
    upstreamRejected: counts, rejectedByReason: counts
  }).strict()
}).strict();

const total = (items: Record<string, number>) => Object.values(items).reduce((sum, value) => sum + value, 0);

export function snapshotsFromCurated(input: unknown, expectedId: string): ObservationSnapshot[] {
  const data = curatedSchema.parse(input);
  if (data.species.id !== expectedId) throw new Error(`Wrong curated species: ${expectedId}`);
  const groups = new Map<string, ObservationSnapshot['observations']>();
  for (const source of data.sourceScopes) {
    if (groups.has(source.id) || source.quality.rawFetched !== source.quality.staged + total(source.quality.upstreamRejected)
        || source.quality.staged !== source.quality.accepted + total(source.quality.rejectedByReason)
        || source.quality.accepted !== total(source.recordMetadata.basisOfRecordCounts)
        || source.quality.accepted !== total(source.recordMetadata.samplingProtocolCounts) + source.recordMetadata.missingSamplingProtocol
        || source.quality.accepted !== total(source.recordMetadata.recordLicenseCounts) + source.recordMetadata.missingRecordLicense) {
      throw new Error(`Invalid or repeated curated source: ${source.id}`);
    }
    groups.set(source.id, []);
  }
  const ids = new Set<string>();
  for (const row of data.observations) {
    const source = data.sourceScopes.find(item => item.id === row.scopeId);
    if (!source || ids.has(row.obisId) || row.longitude < source.boundsWgs84[0]
        || row.longitude > source.boundsWgs84[2] || row.latitude < source.boundsWgs84[1]
        || row.latitude > source.boundsWgs84[3] || row.eventDate.slice(0, 10) < source.query.startDate
        || row.eventDate.slice(0, 10) > source.query.endDate) {
      throw new Error(`Unscoped, repeated or out-of-bounds occurrence: ${row.obisId}`);
    }
    ids.add(row.obisId);
    groups.get(row.scopeId)!.push({
      id: row.obisId, longitude: row.longitude, latitude: row.latitude,
      eventDate: row.eventDate, coordinateUncertaintyInMeters: row.coordinateUncertaintyInMeters
    });
  }
  if (data.quality.accepted !== data.observations.length
      || data.quality.rawFetched !== data.sourceScopes.reduce((sum, item) => sum + item.quality.rawFetched, 0)
      || data.quality.staged !== data.sourceScopes.reduce((sum, item) => sum + item.quality.staged, 0)
      || data.quality.staged !== data.quality.accepted + total(data.quality.rejectedByReason)
      || data.quality.rawFetched !== data.quality.staged + total(data.quality.upstreamRejected)) {
    throw new Error(`Inconsistent quality totals: ${expectedId}`);
  }
  return data.sourceScopes.map(source => {
    const observations = groups.get(source.id)!;
    const scopeRows = data.observations.filter(row => row.scopeId === source.id);
    const tally = (values: (string | null)[]) => values.reduce<Record<string, number>>((counts, value) => {
      if (value) counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    }, {});
    const sameCounts = (a: Record<string, number>, b: Record<string, number>) =>
      JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
    if (observations.length !== source.quality.accepted
        || observations.filter(row => row.coordinateUncertaintyInMeters === null).length
          !== source.quality.unknownCoordinateUncertainty
        || !sameCounts(tally(scopeRows.map(row => row.basisOfRecord)), source.recordMetadata.basisOfRecordCounts)
        || !sameCounts(tally(scopeRows.map(row => row.samplingProtocol)), source.recordMetadata.samplingProtocolCounts)
        || !sameCounts(tally(scopeRows.map(row => row.recordLicense)), source.recordMetadata.recordLicenseCounts)) {
      throw new Error(`Curated scope count mismatch: ${source.id}`);
    }
    return {
      species: data.species.scientificName, region: source.region, period: source.period,
      speciesId: data.species.id, scopeId: source.id, extractId: source.extractId,
      query: source.query, scopeQuality: source.quality, recordMetadata: source.recordMetadata,
      boundsWgs84: source.boundsWgs84,
      ...('clusterDiameterKm' in source ? { clusterDiameterKm: source.clusterDiameterKm } : {}),
      source: source.dataset,
      summary: { count: observations.length, uncertaintyKmRange: source.quality.uncertaintyKmRange,
        unknownCoordinateUncertainty: source.quality.unknownCoordinateUncertainty },
      observations: scopeRows.map(row => ({
        id: row.obisId, longitude: row.longitude, latitude: row.latitude,
        eventDate: row.eventDate, coordinateUncertaintyInMeters: row.coordinateUncertaintyInMeters,
        recordLicense: row.recordLicense
      }))
    };
  });
}
