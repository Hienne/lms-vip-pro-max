import { toUrl } from '../http/endpoint';
import { organizationEndpoints } from './organization.endpoints';
import {
  ListOrgsQuerySchema,
  OrganizationContentsSchema,
  OrganizationImportResultSchema,
  OrganizationInfoSchema,
  OrganizationTreeNodeSchema,
  OrgTreeQuerySchema,
  ORG_IMPORT_LIMITS,
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
      ['orgTree', 'get', '/api/v1/orgs/tree'],
      ['orgContents', 'get', '/api/v1/orgs/{orgId}/contents'],
      ['orgImportTemplate', 'get', '/api/v1/orgs/import-template'],
      ['importOrgs', 'post', '/api/v1/orgs/import'],
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

  it('reads one tree level by parent, paged up to 100 nodes', () => {
    expect(OrgTreeQuerySchema.parse({ page: 0, size: 50 })).toEqual({
      page: 0,
      size: 50,
    });
    expect(OrgTreeQuerySchema.parse({ parentId: 1 })).toEqual({ parentId: 1 });
    expect(() => OrgTreeQuerySchema.parse({ size: 101 })).toThrow();
    expect(() => OrgTreeQuerySchema.parse({ rootOnly: true })).toThrow();
  });

  it('parses a tree node without counts', () => {
    const node = OrganizationTreeNodeSchema.parse({
      id: 2,
      parentId: 1,
      orgType: 'DEPARTMENT',
      code: 'DEMO_PHONG',
      name: 'Phòng Core',
      status: 'active',
      sortNo: 1,
      hasChildren: false,
    });
    expect(node.hasChildren).toBe(false);
    expect(node).not.toHaveProperty('memberCount');
  });

  it('parses the panel contents of a node (IDENTITY.md example)', () => {
    const contents = OrganizationContentsSchema.parse({
      organization: {
        id: 1,
        parentId: null,
        orgType: 'UNIT',
        code: 'DEMO_BAN',
        name: 'Ban Core Banking',
        status: 'active',
        sortNo: 0,
        memberCount: 7,
        teamCount: 1,
      },
      administrators: [],
      teams: {
        items: [
          {
            id: 10,
            orgId: 1,
            code: 'DEP',
            name: 'Nhóm tiền gửi',
            description: null,
            status: 'active',
            memberCount: 0,
            memberPreview: [],
          },
        ],
        page: 0,
        size: 6,
        totalElements: 1,
        totalPages: 1,
      },
    });
    expect(contents.teams.items[0].name).toBe('Nhóm tiền gửi');
  });

  it('parses a check and an import result', () => {
    expect(
      OrganizationImportResultSchema.parse({
        dryRun: true,
        organizationCount: 2,
        teamCount: 3,
        createdOrganizations: 0,
        createdTeams: 0,
      }).teamCount,
    ).toBe(3);
    expect(() =>
      OrganizationImportResultSchema.parse({ dryRun: false }),
    ).toThrow();
  });

  it('downloads the template as a file and sends the import as multipart with dryRun in the query', () => {
    expect(organizationEndpoints.orgImportTemplate.responseType).toBe('blob');
    const importOrgs = organizationEndpoints.importOrgs;
    expect(importOrgs.encoding).toBe('multipart');
    const file = new File(['x'], 'don-vi.xlsx');
    expect(importOrgs.body.parse({ file })).toEqual({ file });
    expect(importOrgs.query.parse({ dryRun: true })).toEqual({ dryRun: true });
    expect(() => importOrgs.query.parse({})).toThrow();
    expect(ORG_IMPORT_LIMITS).toEqual({
      maxBytes: 5 * 1024 * 1024,
      extension: '.xlsx',
      maxRows: 1000,
    });
  });
});
