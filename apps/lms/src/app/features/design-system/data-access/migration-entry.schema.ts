import { z } from 'zod';

/** One verify check: `todo` (not yet performed), `done`, or `n/a` (does not apply to this piece). */
export const VerifyStateSchema = z.enum(['todo', 'done', 'n/a']);

/**
 * The checks of the migration verify step (docs/migration/mockup-to-angular.md → Converting one
 * screen, step 5). Tick a check only after performing it.
 */
export const VerifyChecksSchema = z.object({
  /** Compared with the mockup in light and dark. */
  lightDark: VerifyStateSchema,
  /** Compared with the mockup at 375, 768 and 1280 px. */
  widths: VerifyStateSchema,
  /** Keyboard-only pass. */
  keyboard: VerifyStateSchema,
  /** Each error state forced and rendered with retry. */
  errorStates: VerifyStateSchema,
});

export const MigrationStatusSchema = z.enum(['todo', 'in-progress', 'done']);

/** A README competition-checklist code: `A.1`, `F.7`, or the single-letter `H` (Design System). */
const ChecklistCodeSchema = z.string().regex(/^(?:[A-G]\.\d{1,2}|H)$/);

const GITHUB_USERNAME = /^[a-z\d](?:[a-z\d-]{0,38})$/i;

const baseShape = {
  /** Stable kebab-case id; `needs` lists on /design-system refer to it. */
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  /** Where the mockup defines it, or `null` for something that only exists in the Angular app. */
  mockupSource: z.string().min(1).nullable(),
  /** README checklist codes this piece must still satisfy (`lms-mockup/README.md`). */
  checklist: z.array(ChecklistCodeSchema),
  status: MigrationStatusSchema,
  /** GitHub username of whoever claimed it. Required once the status is not `todo`. */
  owner: z.string().regex(GITHUB_USERNAME).optional(),
  pullRequest: z.url().optional(),
  verify: VerifyChecksSchema.default({
    lightDark: 'todo',
    widths: 'todo',
    keyboard: 'todo',
    errorStates: 'todo',
  }),
};

const ComponentEntrySchema = z.object({
  ...baseShape,
  kind: z.literal('component'),
  level: z.enum(['atom', 'molecule', 'organism', 'domain', 'feature']),
  /**
   * Atoms, molecules and organisms: the `@lms/ui` export names. Domain UI and feature pieces:
   * their app selectors or folders. A `todo` or `in-progress` entry may list names that do not
   * exist yet; a `done` entry must point at real exports (migration-registry.spec.ts).
   */
  targets: z.array(z.string().min(1)).min(1),
});

const RouteEntrySchema = z.object({
  ...baseShape,
  kind: z.literal('route'),
  /** The route path as written in `app.routes.ts`, without a leading slash (`''` is the root). */
  target: z.string(),
});

export const MigrationEntrySchema = z
  .discriminatedUnion('kind', [ComponentEntrySchema, RouteEntrySchema])
  .superRefine((entry, ctx) => {
    if (entry.status !== 'todo' && !entry.owner) {
      ctx.addIssue({
        code: 'custom',
        path: ['owner'],
        message: `${entry.id}: an entry that is ${entry.status} needs an owner (GitHub username)`,
      });
    }
    if (entry.status === 'done') {
      const pending = Object.entries(entry.verify)
        .filter(([, state]) => state === 'todo')
        .map(([check]) => check);
      if (pending.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['verify'],
          message: `${entry.id}: done needs every applicable verify check ticked (pending: ${pending.join(', ')}); use "n/a" for a check that does not apply`,
        });
      }
    }
  });

export const MigrationRegistrySchema = z
  .array(MigrationEntrySchema)
  .superRefine((entries, ctx) => {
    const seen = new Set<string>();
    entries.forEach((entry, index) => {
      if (seen.has(entry.id)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'id'],
          message: `duplicate entry id "${entry.id}"`,
        });
      }
      seen.add(entry.id);
    });
  });

export type VerifyState = z.infer<typeof VerifyStateSchema>;
export type MigrationStatus = z.infer<typeof MigrationStatusSchema>;
export type MigrationEntry = z.infer<typeof MigrationEntrySchema>;
export type ComponentEntry = Extract<MigrationEntry, { kind: 'component' }>;
export type RouteEntry = Extract<MigrationEntry, { kind: 'route' }>;

type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/** What a data row may look like before defaults: `verify` can be omitted while nothing is ticked. */
export type MigrationEntryInput = DeepReadonly<
  z.input<typeof MigrationEntrySchema>
>;
