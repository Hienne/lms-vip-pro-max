import { toUrl } from '../http/endpoint';
import { organizationEndpoints } from './organization.endpoints';
import {
  ListOrgsQuerySchema,
  OrganizationInfoSchema,
  TeamInfoSchema,
  UpdateTeamCommandSchema,
} from './organization.schema';

describe('organization endpoints', () => {
  it('declare the backend paths and methods', () => {
    expect(
      Object.entries(organizationEndpoints).map(([key, e]) => [
        key,
        e.method,
        e.path,
      ]),
    ).toEqual([
      ['listOrgs', 'get', '/api/v1/orgs'],
      ['createOrg', 'post', '/api/v1/orgs'],
      ['getOrg', 'get', '/api/v1/orgs/{orgId}'],
      ['updateOrg', 'patch', '/api/v1/orgs/{orgId}'],
      ['listTeams', 'get', '/api/v1/orgs/{orgId}/teams'],
      ['createTeam', 'post', '/api/v1/orgs/{orgId}/teams'],
      ['updateTeam', 'patch', '/api/v1/teams/{teamId}'],
      ['deleteTeam', 'delete', '/api/v1/teams/{teamId}'],
    ]);
  });

  it('builds the numeric-id urls', () => {
    expect(toUrl(organizationEndpoints.listTeams, { orgId: 1 })).toBe(
      '/api/v1/orgs/1/teams',
    );
    expect(toUrl(organizationEndpoints.deleteTeam, { teamId: 9 })).toBe(
      '/api/v1/teams/9',
    );
  });

  it('loads the tree by root and by parent, paged', () => {
    expect(
      ListOrgsQuerySchema.parse({ rootOnly: true, page: 0, size: 20 }),
    ).toEqual({ rootOnly: true, page: 0, size: 20 });
    expect(ListOrgsQuerySchema.parse({ parentId: 1 })).toEqual({ parentId: 1 });
    expect(() => ListOrgsQuerySchema.parse({ orgType: 'DIVISION' })).toThrow();
  });

  it('parses an org and a team as the backend sends them', () => {
    expect(
      OrganizationInfoSchema.parse({
        id: 1,
        parentId: null,
        orgType: 'UNIT',
        code: 'BIDV110B803',
        name: 'Ban Quản lý và phát triển Core Banking',
        status: 'active',
        sortNo: 0,
        memberCount: 7,
        teamCount: 15,
      }).code,
    ).toBe('BIDV110B803');
    expect(
      TeamInfoSchema.parse({
        id: 1,
        orgId: 1,
        code: 'BIDV110B8031000',
        name: 'Ban Giám đốc',
        description: null,
        status: 'active',
        memberCount: 1,
        memberPreview: [
          { userId: '000006', fullName: 'Người xem báo cáo Demo' },
        ],
      }).memberPreview,
    ).toHaveLength(1);
  });

  it('a team patch clears its code or description with null', () => {
    expect(
      UpdateTeamCommandSchema.parse({ code: null, description: null }),
    ).toEqual({ code: null, description: null });
    expect(() => UpdateTeamCommandSchema.parse({ name: null })).toThrow();
  });
});
