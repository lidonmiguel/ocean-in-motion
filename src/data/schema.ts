import { z } from 'zod';

const position = z.tuple([z.number().min(-180).max(180), z.number().min(-85).max(85)]);

const cell = z.object({
  id: z.string().min(1),
  center: position,
  widthDeg: z.number().positive().max(20),
  heightDeg: z.number().positive().max(20),
  suitability: z.number().min(0).max(1).optional(),
  uncertainty: z.number().min(0).max(1).optional()
}).strict();

export const speciesDatasetSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]+$/),
  scientificName: z.string().min(1),
  commonNameEs: z.string().min(1),
  group: z.enum(['fish', 'cetacean', 'reptile']).optional(),
  summaryEs: z.string().min(1),
  ecologyEs: z.string().min(1),
  provenance: z.enum(['synthetic-demo', 'observation-demo', 'reviewed-model']),
  reviewStatus: z.enum(['illustrative', 'approved']),
  scenario: z.enum(['SSP2-4.5', 'illustrative']),
  periods: z.object({ current: z.string().min(1), future: z.string().min(1) }).strict(),
  occurrence: z.object({
    count: z.number().int().positive(),
    sources: z.array(z.object({
      datasetId: z.string().min(1),
      sourceUrl: z.url(),
      region: z.string().min(1),
      citation: z.string().min(1),
      license: z.string().min(1),
      count: z.number().int().positive(),
      coordinateUncertaintyKmRange: z.tuple([z.number().nonnegative(), z.number().nonnegative()]).nullable(),
      observedBoundsWgs84: z.tuple([z.number(), z.number(), z.number(), z.number()])
    }).strict()).min(1),
    simulationOffsetDeg: position
  }).strict().optional(),
  citations: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    url: z.url().nullable(),
    role: z.enum(['demonstration', 'occurrence', 'environment', 'method', 'model'])
  }).strict()).min(1),
  habitat: z.object({ current: z.array(cell).min(1), future: z.array(cell).min(1) }).strict(),
  movementVectors: z.array(z.object({
    from: position,
    to: position,
    labelEs: z.string().min(1)
  }).strict()).optional()
}).strict().superRefine((dataset, ctx) => {
  if ((dataset.provenance === 'reviewed-model') !== (dataset.reviewStatus === 'approved')) {
    ctx.addIssue({ code: 'custom', message: 'Only reviewed models can be approved', path: ['reviewStatus'] });
  }
  if (dataset.provenance === 'synthetic-demo' && dataset.citations.some(c => c.role !== 'demonstration')) {
    ctx.addIssue({ code: 'custom', message: 'Synthetic data cannot cite observations as its source', path: ['citations'] });
  }
  if (dataset.provenance === 'observation-demo') {
    if (!dataset.occurrence || dataset.scenario !== 'illustrative'
        || !dataset.citations.some(c => c.role === 'occurrence' && c.url)
        || [...dataset.habitat.current, ...dataset.habitat.future].some(c => c.suitability !== undefined || c.uncertainty !== undefined)
        || dataset.occurrence.count !== dataset.occurrence.sources.reduce((sum, source) => sum + source.count, 0)
        || dataset.habitat.current.length !== dataset.occurrence.sources.length
        || dataset.habitat.future.length !== dataset.occurrence.sources.length) {
      ctx.addIssue({ code: 'custom', message: 'Observation demos require occurrence metadata and cannot invent suitability', path: ['occurrence'] });
    }
  } else if (dataset.occurrence) {
    ctx.addIssue({ code: 'custom', message: 'Occurrence metadata belongs to an observation demo', path: ['occurrence'] });
  }
  if (dataset.provenance === 'reviewed-model') {
    const roles = new Set(dataset.citations.map(c => c.role));
    if ((['occurrence', 'environment', 'model'] as const).some(role => !roles.has(role)) || dataset.citations.some(c => !c.url)) {
      ctx.addIssue({ code: 'custom', message: 'Reviewed models require linked occurrence, environment and model citations', path: ['citations'] });
    }
  }
  for (const period of ['current', 'future'] as const) {
    if (dataset.provenance !== 'observation-demo' && dataset.habitat[period].some(c => c.suitability === undefined || c.uncertainty === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'Habitat cells need suitability and uncertainty', path: ['habitat', period] });
    }
    const ids = dataset.habitat[period].map(c => c.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: `Duplicate cell IDs in ${period}`, path: ['habitat', period] });
    }
  }
});

export type SpeciesDataset = z.infer<typeof speciesDatasetSchema>;
export type HabitatCell = SpeciesDataset['habitat']['current'][number];
export type Period = keyof SpeciesDataset['habitat'];

export function parseSpeciesDataset(value: unknown): SpeciesDataset {
  return speciesDatasetSchema.parse(value);
}
