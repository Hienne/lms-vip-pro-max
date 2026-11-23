import { z } from 'zod';

/**
 * Mô phỏng luồng: the document a `flow` block carries. Đối tượng stand on grid cells of a floor; the
 * Bước chuyển are played back in array order. There is no link entity: a cable between two Đối tượng
 * exists while at least one step uses that pair. The backend enforces every rule; see
 * `docs/api/LEARNING.md` → "Mô phỏng luồng".
 */
export const FLOW_LIMITS = {
  objects: 30,
  steps: 100,
  name: 60,
  title: 255,
  description: 2000,
  grid: 40,
} as const;

export const FlowKindSchema = z.enum([
  'customer',
  'staff',
  'channel',
  'system',
  'database',
  'queue',
  'gateway',
  'document',
  'external',
  'decision',
]);
export type FlowKind = z.infer<typeof FlowKindSchema>;

const FlowIdSchema = z.string().regex(/^[a-z0-9_-]{1,20}$/);
const CellSchema = z
  .number()
  .int()
  .min(-FLOW_LIMITS.grid)
  .max(FLOW_LIMITS.grid);

/** Đối tượng: one participant on the floor. */
export const FlowObjectSchema = z.strictObject({
  id: FlowIdSchema,
  name: z.string().trim().min(1).max(FLOW_LIMITS.name),
  kind: FlowKindSchema,
  x: CellSchema,
  z: CellSchema,
});
export type FlowObject = z.infer<typeof FlowObjectSchema>;

/** Bước chuyển: `to` is `null` when the Đối tượng works on its own. */
export const FlowStepSchema = z.strictObject({
  id: FlowIdSchema,
  from: FlowIdSchema,
  to: FlowIdSchema.nullable(),
  title: z.string().trim().min(1).max(FLOW_LIMITS.title),
  description: z.string().max(FLOW_LIMITS.description).nullable(),
});
export type FlowStep = z.infer<typeof FlowStepSchema>;

export const FlowModelSchema = z.strictObject({
  version: z.literal(1),
  objects: z.array(FlowObjectSchema).max(FLOW_LIMITS.objects),
  steps: z.array(FlowStepSchema).max(FLOW_LIMITS.steps),
});
export type FlowModel = z.infer<typeof FlowModelSchema>;
