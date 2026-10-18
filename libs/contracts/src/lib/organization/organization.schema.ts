import { z } from 'zod';
import { PageQuerySchema } from '../http/page';

// Mirrors the backend's organisation endpoints (/api/v1/orgs, /api/v1/teams). An org is a UNIT
// (a division, root or under a UNIT) or a DEPARTMENT (always under a UNIT); a team is a
// professional group inside one org, never a department. Both lists are cut to the scope of the
// caller by the server.

export const OrgTypeSchema = z.enum(['UNIT', 'DEPARTMENT']);
export type OrgType = z.infer<typeof OrgTypeSchema>;

export const OrgStatusSchema = z.enum(['active', 'inactive']);
export type OrgStatus = z.infer<typeof OrgStatusSchema>;

export const OrganizationInfoSchema = z.object({
  id: z.number().int(),
  /** Absent for a root. */
  parentId: z.number().int().nullish(),
  orgType: OrgTypeSchema,
  code: z.string(),
  name: z.string(),
  status: OrgStatusSchema,
  sortNo: z.number().int(),
  /** People placed directly in this node, not in its subtree. */
  memberCount: z.number().int().nonnegative(),
  teamCount: z.number().int().nonnegative(),
});
export type OrganizationInfo = z.infer<typeof OrganizationInfoSchema>;

/** An ADMIN granted directly at this node (at most 20; inherited and global admins are not listed). */
export const OrgAdministratorSchema = z.object({
  userId: z.string(),
  fullName: z.string(),
  roleCode: z.string(),
  grantOrgId: z.number().int().nullish(),
});
export type OrgAdministrator = z.infer<typeof OrgAdministratorSchema>;

export const OrganizationDetailSchema = z.object({
  organization: OrganizationInfoSchema,
  administrators: z.array(OrgAdministratorSchema),
});
export type OrganizationDetail = z.infer<typeof OrganizationDetailSchema>;

export const MemberPreviewSchema = z.object({
  userId: z.string(),
  fullName: z.string(),
});
export type MemberPreview = z.infer<typeof MemberPreviewSchema>;

/** The server previews at most 5 members; `memberCount` is the real total. */
export const TEAM_PREVIEW_SIZE = 5;

export const TeamInfoSchema = z.object({
  id: z.number().int(),
  orgId: z.number().int(),
  code: z.string().nullish(),
  name: z.string(),
  description: z.string().nullish(),
  status: OrgStatusSchema,
  memberCount: z.number().int().nonnegative(),
  memberPreview: z.array(MemberPreviewSchema),
});
export type TeamInfo = z.infer<typeof TeamInfoSchema>;

/** The sort fields the backend accepts. */
export const ORG_SORT_FIELDS = ['id', 'code', 'name', 'sortNo'] as const;
export const TEAM_SORT_FIELDS = ['id', 'code', 'name'] as const;

/** Field rules shared by the org and team forms and the schemas. */
export const ORG_LIMITS = {
  code: 50,
  name: 255,
  teamDescription: 4000,
} as const;

/**
 * The tree loads its roots with `rootOnly` and a node's children with `parentId`; a search
 * (`q`) returns a flat page. Every level is paged: do not treat the first 20 rows as the tree.
 */
export const ListOrgsQuerySchema = PageQuerySchema.extend({
  q: z.string().optional(),
  parentId: z.number().int().optional(),
  rootOnly: z.boolean().optional(),
  orgType: OrgTypeSchema.optional(),
  status: OrgStatusSchema.optional(),
});
export type ListOrgsQuery = z.infer<typeof ListOrgsQuerySchema>;

/** Global administrators only. `orgType` and `parentId` cannot change afterwards. */
export const CreateOrgCommandSchema = z.object({
  orgType: OrgTypeSchema,
  parentId: z.number().int().positive().optional(),
  code: z.string(),
  name: z.string(),
  sortNo: z.number().int().nonnegative(),
});
export type CreateOrgCommand = z.infer<typeof CreateOrgCommandSchema>;

/** Changed fields only; `status` is for global administrators. */
export const UpdateOrgCommandSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  sortNo: z.number().int().nonnegative().optional(),
  status: OrgStatusSchema.optional(),
});
export type UpdateOrgCommand = z.infer<typeof UpdateOrgCommandSchema>;

export const CreateTeamCommandSchema = z.object({
  code: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
});
export type CreateTeamCommand = z.infer<typeof CreateTeamCommandSchema>;

/** Changed fields only; `null` clears `code` or `description`. */
export const UpdateTeamCommandSchema = z.object({
  code: z.string().nullable().optional(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
});
export type UpdateTeamCommand = z.infer<typeof UpdateTeamCommandSchema>;
