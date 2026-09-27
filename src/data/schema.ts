import { z } from 'zod';

const position = z.tuple([z.number().min(-180).max(180), z.number().min(-85).max(85)]);

const cell = z.object({
  id: z.string().min(1),
  center: position,
  widthDeg: z.number().positive().max(20),
  heightDeg: z.number().positive().max(20),
  suitability: z.number().min(0).max(1),
  uncertainty: z.number().min(0).max(1)
}).strict();

export const speciesDatasetSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]+$/),
  scientificName: z.string().min(1),
  commonNameEs: z.string().min(1),
  group: z.enum(['fish', 'cetacean', 'reptile']).optional(),
  summaryEs: z.string().min(1),
  ecologyEs: z.string().min(1),
  provenance: z.enum(['synthetic-demo', 'reviewed-model']),
  reviewStatus: z.enum(['illustrative', 'approved']),
  scenario: z.literal('SSP2-4.5'),
  periods: z.object({ current: z.string().min(1), future: z.literal('2050') }).strict(),
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
  if ((dataset.provenance === 'synthetic-demo') !== (dataset.reviewStatus === 'illustrative')) {
    ctx.addIssue({ code: 'custom', message: 'Demo data must be illustrative; reviewed models must be approved', path: ['reviewStatus'] });
  }
  if (dataset.provenance === 'synthetic-demo' && dataset.citations.some(c => c.role !== 'demonstration')) {
    ctx.addIssue({ code: 'custom', message: 'Synthetic data cannot cite observations as its source', path: ['citations'] });
  }
  if (dataset.provenance === 'reviewed-model') {
    const roles = new Set(dataset.citations.map(c => c.role));
    if ((['occurrence', 'environment', 'model'] as const).some(role => !roles.has(role)) || dataset.citations.some(c => !c.url)) {
      ctx.addIssue({ code: 'custom', message: 'Reviewed models require linked occurrence, environment and model citations', path: ['citations'] });
    }
  }
  for (const period of ['current', 'future'] as const) {
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
