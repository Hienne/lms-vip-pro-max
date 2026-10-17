import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageQuerySchema, PageSchema } from '../http/page';
import {
  CreateOrgCommandSchema,
  CreateTeamCommandSchema,
  ListOrgsQuerySchema,
  OrganizationDetailSchema,
  OrganizationInfoSchema,
  TeamInfoSchema,
  UpdateOrgCommandSchema,
  UpdateTeamCommandSchema,
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
