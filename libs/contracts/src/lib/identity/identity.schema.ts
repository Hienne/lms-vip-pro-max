import { z } from 'zod';

// The vocabulary shared by `/auth/me`, the users, roles and organisation endpoints of the backend
// (CORE Academy API, /api/v1). Display labels (e.g. Vietnamese status names) are UI copy and live
// in the app, not here.

/**
 * The backend's function codes (`functions.code`), one per screen. A signed-in user may open the
 * screens whose code `/me` lists in `functions`; the code is also the key of the screen table,
 * the sidebar and the mock role form. `/me` can list a code this enum does not know (the backend
 * adds screens before the app does), so `Me.functions` stays `string[]` and the app ignores codes
 * it has no screen for.
 */
export const FunctionCodeSchema = z.enum([
  'PROFILE',
  'COURSE_LEARNING',
  'LEARNING_PROGRESS',
  'QUIZ_TAKING',
  'TRAINING_CATALOG',
  'COURSE_MANAGEMENT',
  'LESSON_MANAGEMENT',
  'QUESTION_BANK',
  'QUIZ_MANAGEMENT',
  'USER_MANAGEMENT',
  'ORGANIZATION_MANAGEMENT',
  'ROLE_MANAGEMENT',
  'COURSE_ASSIGNMENT',
  'REPORTING',
  'SYSTEM_AUDIT',
  'KNOWLEDGE_HUB',
  'ISSUE_HUB',
  'AI_ASSISTANT',
  'COMMUNITY',
  'COMMUNITY_MODERATION',
]);
export type FunctionCode = z.infer<typeof FunctionCodeSchema>;

/** `inactive` pauses the account, `locked` blocks it; there is no hard delete. */
export const AccountStatusSchema = z.enum(['active', 'inactive', 'locked']);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const ScopeTypeSchema = z.enum(['GLOBAL', 'ORG', 'TEAM', 'OWN']);
export type ScopeType = z.infer<typeof ScopeTypeSchema>;

/**
 * Where a grant applies. Responses name it `type`; the body of a grant request names it `scope`
 * (`GrantRequestSchema`), so the two never share a schema.
 */
export const GrantScopeSchema = z.object({
  type: ScopeTypeSchema,
  orgId: z.number().int().nullish(),
  teamId: z.number().int().nullish(),
});
export type GrantScope = z.infer<typeof GrantScopeSchema>;

/** An active screen; the backend sorts them by `sortNo`, then `id`. */
export const FunctionInfoSchema = z.object({
  id: z.number().int(),
  code: z.string(),
  name: z.string(),
  routePattern: z.string().nullish(),
  parentFunctionId: z.number().int().nullish(),
  sortNo: z.number().int(),
});
export type FunctionInfo = z.infer<typeof FunctionInfoSchema>;

export const PublishStatusSchema = z.enum([
  'draft',
  'published',
  'paused',
  'locked',
]);
export type PublishStatus = z.infer<typeof PublishStatusSchema>;
