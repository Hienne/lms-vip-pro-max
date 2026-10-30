import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageQuerySchema, PageSchema } from '../http/page';
import {
  CreateOrgCommandSchema,
  CreateTeamCommandSchema,
  ImportOrgsCommandSchema,
  ImportOrgsQuerySchema,
  ListOrgsQuerySchema,
  OrganizationContentsSchema,
  OrganizationDetailSchema,
  OrganizationImportResultSchema,
  OrganizationInfoSchema,
  OrganizationTreeNodeSchema,
  OrgTreeQuerySchema,
  TeamInfoSchema,
  UpdateOrgCommandSchema,
  UpdateTeamCommandSchema,
  XLSX_MIME_TYPE,
} from './organization.schema';

const orgParams = z.object({ orgId: z.number().int() });
const teamParams = z.object({ teamId: z.number().int() });

/** The backend's organisation endpoints (/api/v1/orgs, /api/v1/teams). */
export const organizationEndpoints = {
  /** Orgs in the scope of the caller: roots, a node's children, or a search. */
  listOrgs: defineEndpoint({
    method: 'get',
    path: '/api/v1/orgs',
    query: ListOrgsQuerySchema,
    response: PageSchema(OrganizationInfoSchema),
  }),
  /** One level of the lazy tree, in scope, with `hasChildren`; the selector and search keep `listOrgs`. */
  orgTree: defineEndpoint({
    method: 'get',
    path: '/api/v1/orgs/tree',
    query: OrgTreeQuerySchema,
    response: PageSchema(OrganizationTreeNodeSchema),
  }),
  /** The panel of a node in one call: the node, its direct administrators and a page of teams. */
  orgContents: defineEndpoint({
    method: 'get',
    path: '/api/v1/orgs/{orgId}/contents',
    params: orgParams,
    query: PageQuerySchema,
    response: OrganizationContentsSchema,
  }),
  /** The Excel template of the import (an `.xlsx` file, no envelope); a refusal is a JSON envelope. */
  orgImportTemplate: defineEndpoint({
    method: 'get',
    path: '/api/v1/orgs/import-template',
    responseType: 'blob',
    // Only a spreadsheet is saved as `.xlsx`; any other blob is a contract failure.
    response: z.instanceof(Blob).refine((blob) => blob.type === XLSX_MIME_TYPE),
  }),
  /**
   * Checks (`dryRun=true`) or imports new units, departments and teams from an `.xlsx` file. An
   * invalid file is an `ORGANIZATION-IMPORT_INVALID` refusal and nothing is written.
   */
  importOrgs: defineEndpoint({
    method: 'post',
    path: '/api/v1/orgs/import',
    query: ImportOrgsQuerySchema,
    body: ImportOrgsCommandSchema,
    encoding: 'multipart',
    response: OrganizationImportResultSchema,
  }),
  /** Global administrators only. */
  createOrg: defineEndpoint({
    method: 'post',
    path: '/api/v1/orgs',
    body: CreateOrgCommandSchema,
    response: OrganizationInfoSchema,
  }),
  /** The node with the administrators granted directly at it. */
  getOrg: defineEndpoint({
    method: 'get',
    path: '/api/v1/orgs/{orgId}',
    params: orgParams,
    response: OrganizationDetailSchema,
  }),
  updateOrg: defineEndpoint({
    method: 'patch',
    path: '/api/v1/orgs/{orgId}',
    params: orgParams,
    body: UpdateOrgCommandSchema,
    response: OrganizationInfoSchema,
  }),
  listTeams: defineEndpoint({
    method: 'get',
    path: '/api/v1/orgs/{orgId}/teams',
    params: orgParams,
    query: PageQuerySchema,
    response: PageSchema(TeamInfoSchema),
  }),
  createTeam: defineEndpoint({
    method: 'post',
    path: '/api/v1/orgs/{orgId}/teams',
    params: orgParams,
    body: CreateTeamCommandSchema,
    response: TeamInfoSchema,
  }),
  updateTeam: defineEndpoint({
    method: 'patch',
    path: '/api/v1/teams/{teamId}',
    params: teamParams,
    body: UpdateTeamCommandSchema,
    response: TeamInfoSchema,
  }),
  /** Only a team with no members and no grant (even revoked) that references it. */
  deleteTeam: defineEndpoint({
    method: 'delete',
    path: '/api/v1/teams/{teamId}',
    params: teamParams,
    response: z.unknown(),
  }),
} as const;
