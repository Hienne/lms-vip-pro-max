import { z } from 'zod';
import { MAX_PAGE_SIZE, PageQuerySchema, PageSchema } from '../http/page';

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

/**
 * One node of a tree level (`GET /orgs/tree`), with no counts. `hasChildren` counts only the
 * children the caller may see; a root's `parentId` may point outside the scope.
 */
export const OrganizationTreeNodeSchema = z.object({
  id: z.number().int(),
  parentId: z.number().int().nullish(),
  orgType: OrgTypeSchema,
  code: z.string(),
  name: z.string(),
  status: OrgStatusSchema,
  sortNo: z.number().int(),
  hasChildren: z.boolean(),
});
export type OrganizationTreeNode = z.infer<typeof OrganizationTreeNodeSchema>;

/**
 * One tree level: the roots in scope without `parentId`, a node's direct children with it.
 * Sorted by `sortNo` then id by the server, so there is no `sort`.
 */
export const OrgTreeQuerySchema = z.strictObject({
  parentId: z.number().int().optional(),
  page: z.number().int().nonnegative().optional(),
  size: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
});
export type OrgTreeQuery = z.infer<typeof OrgTreeQuerySchema>;

/** The panel of the picked node: the node, its direct administrators and one page of its teams. */
export const OrganizationContentsSchema = OrganizationDetailSchema.extend({
  teams: PageSchema(TeamInfoSchema),
});
export type OrganizationContents = z.infer<typeof OrganizationContentsSchema>;

/** A check (`dryRun`) or an import; the `created*` counts are 0 for a check. */
export const OrganizationImportResultSchema = z.object({
  dryRun: z.boolean(),
  organizationCount: z.number().int().nonnegative(),
  teamCount: z.number().int().nonnegative(),
  createdOrganizations: z.number().int().nonnegative(),
  createdTeams: z.number().int().nonnegative(),
});
export type OrganizationImportResult = z.infer<
  typeof OrganizationImportResultSchema
>;

/** The file the import accepts; every rule inside the file is checked by the server. */
/** The media type of the import template and of the files the import takes. */
export const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const ORG_IMPORT_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  extension: '.xlsx',
  maxRows: 1000,
} as const;

export const ImportOrgsCommandSchema = z.object({ file: z.file() });
export type ImportOrgsCommand = z.infer<typeof ImportOrgsCommandSchema>;

/** `true` only checks the file; `false` checks it again and writes everything in one transaction. */
export const ImportOrgsQuerySchema = z.object({ dryRun: z.boolean() });
export type ImportOrgsQuery = z.infer<typeof ImportOrgsQuerySchema>;

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
