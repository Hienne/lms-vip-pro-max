import {
  adminOrgEndpoints,
  AgentStreamEventSchema,
  agentEndpoints,
  authV1Endpoints,
  identityEndpoints,
  knowledgeEndpoints,
  organizationEndpoints,
  RoleSchema,
  shellEndpoints,
  type AnyEndpoint,
  type KnowledgeDocument,
  type Me,
  type Page,
  type UserSummary,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from './fake-backend';
import {
  SEED_FUNCTIONS,
  SEED_GRANTS,
  SEED_ORGS,
  SEED_PASSWORD,
  SEED_ROLES,
  SEED_TEAMS,
  SEED_USERS,
} from './seed';
import { seedMe } from './seed-me';

interface Call {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}

describe('FakeBackend', () => {
  let backend: FakeBackend;
  beforeEach(() => (backend = new FakeBackend()));

  const call = (
    endpoint: AnyEndpoint,
    token: string | null,
    { params = {}, query = {}, body }: Call = {},
  ): FakeReply =>
    backend.handle(endpoint, { token, params, query, body }) as FakeReply;

  const login = (username: string, password = SEED_PASSWORD): string => {
    const reply = call(authV1Endpoints.login, null, {
      body: { username, password },
    });
    expect(reply.status).toBe(200);
    return (reply.body.data as { accessToken: string }).accessToken;
  };

  const code = (reply: FakeReply) => reply.body.messageCode;

  describe('the seed', () => {
    it('is the backend demo database', () => {
      expect(SEED_ORGS).toHaveLength(1);
      expect(SEED_TEAMS).toHaveLength(15);
      expect(SEED_USERS).toHaveLength(7);
      expect(SEED_GRANTS).toHaveLength(8);
      expect(SEED_ROLES).toHaveLength(5);
      expect(SEED_FUNCTIONS).toHaveLength(17);
      expect(SEED_USERS.map((u) => u.userId)).toEqual([
        '000001',
        '000002',
        '000003',
        '000004',
        '000005',
        '000006',
        '000007',
      ]);
    });

    it('opens the screens of role_functions for each role', () => {
      const functions = (id: string) => seedMe(id).functions;
      expect(functions('000004')).toEqual([
        'PROFILE',
        'COURSE_LEARNING',
        'LEARNING_PROGRESS',
        'QUIZ_TAKING',
        'KNOWLEDGE_HUB',
        'AI_ASSISTANT',
        'ISSUE_HUB',
      ]);
      expect(functions('000006')).toEqual([
        'PROFILE',
        'REPORTING',
        'AI_ASSISTANT',
      ]);
      expect(functions('000001')).toContain('ROLE_MANAGEMENT');
      expect(functions('000001')).not.toContain('COURSE_LEARNING');
    });

    it('gives the instructor both of their grants', () => {
      const me: Me = seedMe('000005');
      expect(me.roles).toEqual(['INSTRUCTOR', 'LEARNER']);
      expect(me.roleGrants.map((g) => g.scope.type).sort()).toEqual([
        'ORG',
        'OWN',
      ]);
      expect(me.user.teamName).toBe('Nhóm phát triển Core Banking');
    });
  });

  describe('sign in', () => {
    it('refuses a wrong password with HTTP 401 and the backend message', () => {
      const reply = call(authV1Endpoints.login, null, {
        body: { username: 'super.admin', password: 'sai' },
      });
      expect(reply.status).toBe(401);
      expect(code(reply)).toBe('IDENTITY-CREDENTIALS_INVALID');
      expect(reply.body.message).toBe(
        'Tên đăng nhập hoặc mật khẩu không đúng.',
      );
    });

    it('takes the staff code or the username, case-insensitively', () => {
      expect(login('000004')).toBeTruthy();
      expect(login('HocVien')).toBeTruthy();
    });

    it('answers HTTP 401 CORE-UNAUTHENTICATED without a token', () => {
      const reply = call(authV1Endpoints.me, null);
      expect(reply.status).toBe(401);
      expect(code(reply)).toBe('CORE-UNAUTHENTICATED');
    });

    it('does not let a locked account in', () => {
      const root = login('super.admin');
      call(identityEndpoints.setUserStatus, root, {
        params: { userId: '000007' },
        body: { status: 'locked' },
      });
      const reply = call(authV1Endpoints.login, null, {
        body: { username: 'hocvien.tichhop', password: SEED_PASSWORD },
      });
      expect(code(reply)).toBe('IDENTITY-CREDENTIALS_INVALID');
    });

    it('revokes every token on logout', () => {
      const token = login('hocvien');
      expect(call(authV1Endpoints.logout, token).status).toBe(200);
      expect(call(authV1Endpoints.me, token).status).toBe(401);
    });
  });

  describe('forced password change', () => {
    function newUserToken(root: string): string {
      const created = call(identityEndpoints.createUser, root, {
        body: {
          userId: '000100',
          username: 'moi',
          fullName: 'Người mới',
          initialPassword: 'Tam@1234',
          initialRoleGrants: [{ roleId: 3, scope: 'OWN' }],
        },
      });
      expect(created.status).toBe(201);
      return login('moi', 'Tam@1234');
    }

    it('creates the account with mustChangePassword and refuses every screen but the password', () => {
      const token = newUserToken(login('super.admin'));
      const me = call(authV1Endpoints.me, token).body.data as Me;
      expect(me.user.mustChangePassword).toBe(true);
      const refused = call(identityEndpoints.listUsers, token);
      expect(refused.status).toBe(403);
      expect(code(refused)).toBe('IDENTITY-PASSWORD_CHANGE_REQUIRED');
      expect(
        call(authV1Endpoints.updateMe, token, { body: { fullName: 'x' } })
          .status,
      ).toBe(403);
    });

    it('changes the password, revokes the token and clears the flag', () => {
      const token = newUserToken(login('super.admin'));
      const changed = call(authV1Endpoints.changePassword, token, {
        body: { currentPassword: 'Tam@1234', newPassword: 'Moi@5678' },
      });
      expect(changed.status).toBe(200);
      expect(call(authV1Endpoints.me, token).status).toBe(401);
      const fresh = login('moi', 'Moi@5678');
      const me = call(authV1Endpoints.me, fresh).body.data as Me;
      expect(me.user.mustChangePassword).toBe(false);
    });

    it('checks the current password, the length and that the new one differs', () => {
      const token = login('hocvien');
      const change = (currentPassword: string, newPassword: string) =>
        call(authV1Endpoints.changePassword, token, {
          body: { currentPassword, newPassword },
        });
      expect(code(change('sai', 'Moi@5678'))).toBe(
        'IDENTITY-CURRENT_PASSWORD_INCORRECT',
      );
      expect(code(change(SEED_PASSWORD, '12345'))).toBe(
        'CORE-VALIDATION_FAILED',
      );
      expect(code(change(SEED_PASSWORD, 'é'.repeat(37)))).toBe(
        'CORE-VALIDATION_FAILED',
      );
      expect(code(change(SEED_PASSWORD, SEED_PASSWORD))).toBe(
        'CORE-VALIDATION_FAILED',
      );
    });
  });

  describe('profile', () => {
    it('keeps omitted fields, clears null ones and refuses an empty or unknown patch', () => {
      const token = login('hocvien');
      const patch = (body: unknown) =>
        call(authV1Endpoints.updateMe, token, { body });
      const first = patch({ email: null, positionName: 'Chuyên gia' });
      const me = first.body.data as Me;
      expect(me.user.email).toBeNull();
      expect(me.user.positionName).toBe('Chuyên gia');
      expect(me.user.fullName).toBe('Học viên tiền gửi Demo');
      expect(code(patch({}))).toBe('CORE-VALIDATION_FAILED');
      expect(patch({}).body.message).toContain('cung cấp thông tin');
      expect(patch({ username: 'x' }).body.message).toContain('username');
      expect(code(patch({ fullName: null }))).toBe('CORE-VALIDATION_FAILED');
      expect(code(patch({ fullName: '   ' }))).toBe('CORE-VALIDATION_FAILED');
      expect(code(patch({ email: 'khong-hop-le' }))).toBe(
        'CORE-VALIDATION_FAILED',
      );
    });
  });

  describe('users', () => {
    const list = (token: string, query: Record<string, string> = {}) =>
      call(identityEndpoints.listUsers, token, { query });
    const page = (reply: FakeReply) => reply.body.data as Page<UserSummary>;

    it('lists every user for the root, sorted by name, 0-based pages', () => {
      const body = page(list(login('super.admin')));
      expect(body.totalElements).toBe(7);
      expect(body.page).toBe(0);
      expect(body.items.map((u) => u.fullName)).toEqual(
        [...body.items.map((u) => u.fullName)].sort((a, b) =>
          a.localeCompare(b, 'vi'),
        ),
      );
    });

    it('filters by q, status, role and team, and pages on the server', () => {
      const token = login('super.admin');
      expect(
        page(list(token, { q: 'tích hợp' })).items.map((u) => u.userId),
      ).toEqual(['000007']);
      expect(page(list(token, { roleCode: 'LEARNER' })).totalElements).toBe(3);
      expect(page(list(token, { teamId: '9' })).items[0]?.userId).toBe(
        '000005',
      );
      const second = page(
        list(token, { size: '3', page: '2', sort: 'id,asc' }),
      );
      expect(second.items.map((u) => u.userId)).toEqual(['000007']);
      expect(second.totalPages).toBe(3);
    });

    it('rejects a bad size or sort field', () => {
      const token = login('super.admin');
      expect(code(list(token, { size: '101' }))).toBe('CORE-VALIDATION_FAILED');
      expect(code(list(token, { sort: 'email,asc' }))).toBe(
        'CORE-VALIDATION_FAILED',
      );
    });

    it('refuses a learner with HTTP 403 CORE-ACCESS_DENIED', () => {
      const reply = list(login('hocvien'));
      expect(reply.status).toBe(403);
      expect(code(reply)).toBe('CORE-ACCESS_DENIED');
    });

    it('shows an org admin only the users of their org, and does not let them edit admins', () => {
      const token = login('quantri.ban');
      const body = page(list(token));
      expect(body.totalElements).toBe(7);
      const root = body.items.find((u) => u.userId === '000001');
      expect(root?.editable).toBe(false);
      expect(body.items.find((u) => u.userId === '000004')?.editable).toBe(
        true,
      );
    });

    it('creates a user with a duplicate check on userId and username', () => {
      const token = login('super.admin');
      const body = {
        userId: '000100',
        username: 'Moi.Nguoi',
        fullName: 'Người mới',
        initialPassword: 'Tam@1234',
      };
      const created = call(identityEndpoints.createUser, token, { body });
      expect(created.status).toBe(201);
      expect(
        (created.body.data as { user: { username: string } }).user.username,
      ).toBe('moi.nguoi');
      expect(
        code(
          call(identityEndpoints.createUser, token, {
            body: { ...body, userId: '000101' },
          }),
        ),
      ).toBe('IDENTITY-IDENTIFIER_EXISTS');
      expect(
        code(
          call(identityEndpoints.createUser, token, {
            body: {
              ...body,
              userId: '000101',
              username: 'x',
              initialPassword: '123',
            },
          }),
        ),
      ).toBe('CORE-VALIDATION_FAILED');
    });

    it('rolls back a user whose initial grant is invalid', () => {
      const token = login('quantri.ban');
      const reply = call(identityEndpoints.createUser, token, {
        body: {
          userId: '000100',
          username: 'moi',
          fullName: 'Người mới',
          initialPassword: 'Tam@1234',
          initialRoleGrants: [{ roleId: 1, scope: 'GLOBAL' }],
        },
      });
      expect(code(reply)).toBe('IDENTITY-SCOPE_INVALID');
      expect(
        page(list(login('super.admin'))).items.some(
          (u) => u.userId === '000100',
        ),
      ).toBe(false);
    });

    it('moves a user to another team and revokes their ORG/TEAM grants', () => {
      const root = login('super.admin');
      const moved = call(identityEndpoints.updateUser, root, {
        params: { userId: '000005' },
        body: { teamId: 11 },
      });
      const detail = moved.body.data as {
        user: { teamId: number };
        roleGrants: { scope: { type: string } }[];
      };
      expect(detail.user.teamId).toBe(11);
      expect(detail.roleGrants.map((g) => g.scope.type)).toEqual(['OWN']);
    });

    it('checks that the team belongs to the org', () => {
      const root = login('super.admin');
      const created = call(organizationEndpoints.createOrg, root, {
        body: { orgType: 'UNIT', code: 'KHAC', name: 'Đơn vị khác', sortNo: 1 },
      });
      const otherOrg = (created.body.data as { id: number }).id;
      const reply = call(identityEndpoints.updateUser, root, {
        params: { userId: '000004' },
        body: { orgId: otherOrg, teamId: 7 },
      });
      expect(code(reply)).toBe('IDENTITY-MEMBERSHIP_INVALID');
    });

    it('locks an account and protects the last super admin', () => {
      const root = login('super.admin');
      const locked = call(identityEndpoints.setUserStatus, root, {
        params: { userId: '000004' },
        body: { status: 'locked' },
      });
      expect(
        (locked.body.data as { user: { status: string } }).user.status,
      ).toBe('locked');
      // A second super admin may lock the first; nobody may lock the last one.
      const rootId = SEED_USERS[0].userId;
      call(identityEndpoints.grantRole, root, {
        params: { userId: '000002' },
        body: { roleId: 1, scope: 'GLOBAL' },
      });
      const second = login('quantri');
      expect(
        call(identityEndpoints.setUserStatus, second, {
          params: { userId: rootId },
          body: { status: 'inactive' },
        }).status,
      ).toBe(200);
    });
  });

  describe('roles and grants', () => {
    const roles = (token: string) =>
      call(identityEndpoints.listRoles, token).body.data as {
        code: string;
        roleId: number;
        assignableScopes: string[];
        capabilities: string[];
      }[];

    it('offers the root every scope and an org admin no GLOBAL', () => {
      const root = roles(login('super.admin'));
      expect(
        root.find((r) => r.code === 'SUPER_ADMIN')?.assignableScopes,
      ).toEqual(['GLOBAL']);
      expect(
        root.find((r) => r.code === 'SUPER_ADMIN')?.capabilities,
      ).toContain('ADMIN_ROLE_GRANT');
      const orgAdmin = roles(login('quantri.ban'));
      expect(
        orgAdmin.find((r) => r.code === 'INSTRUCTOR')?.assignableScopes,
      ).toEqual(['OWN', 'TEAM', 'ORG']);
      expect(
        orgAdmin.find((r) => r.code === 'ADMIN')?.assignableScopes,
      ).toEqual([]);
      const global = roles(login('quantri'));
      expect(global.find((r) => r.code === 'ADMIN')?.assignableScopes).toEqual(
        [],
      );
    });

    it('grants a role with a scope, refuses a duplicate and a self grant, and revokes', () => {
      const root = login('super.admin');
      const grant = {
        params: { userId: '000007' },
        body: { roleId: 5, scope: 'TEAM', teamId: 11 },
      };
      const created = call(identityEndpoints.grantRole, root, grant);
      expect(created.status).toBe(201);
      const { grantId } = created.body.data as { grantId: number };
      expect(code(call(identityEndpoints.grantRole, root, grant))).toBe(
        'IDENTITY-ROLE_GRANT_EXISTS',
      );
      expect(
        code(
          call(identityEndpoints.grantRole, root, {
            params: { userId: '000001' },
            body: { roleId: 5, scope: 'GLOBAL' },
          }),
        ),
      ).toBe('CORE-ACCESS_DENIED');
      expect(
        code(
          call(identityEndpoints.grantRole, root, {
            params: { userId: '000007' },
            body: { roleId: 4, scope: 'ORG' },
          }),
        ),
      ).toBe('IDENTITY-SCOPE_INVALID');
      const revoked = call(identityEndpoints.revokeRole, root, {
        params: { userId: '000007', grantId: String(grantId) },
      });
      expect(revoked.status).toBe(200);
      expect(
        code(
          call(identityEndpoints.revokeRole, root, {
            params: { userId: '000007', grantId: String(grantId) },
          }),
        ),
      ).toBe('CORE-RESOURCE_NOT_FOUND');
    });

    it('keeps the administrator grants for the super admin only', () => {
      const orgAdmin = login('quantri.ban');
      const reply = call(identityEndpoints.grantRole, orgAdmin, {
        params: { userId: '000004' },
        body: { roleId: 2, scope: 'ORG', orgId: 1 },
      });
      expect(code(reply)).toBe('IDENTITY-SCOPE_INVALID');
    });
  });

  describe('organisation', () => {
    const orgs = (token: string, query: Record<string, string> = {}) =>
      call(organizationEndpoints.listOrgs, token, { query });

    it('lists the roots, then the children of a node', () => {
      const root = login('super.admin');
      const created = call(organizationEndpoints.createOrg, root, {
        body: {
          orgType: 'DEPARTMENT',
          parentId: 1,
          code: 'PB1',
          name: 'Phòng 1',
          sortNo: 1,
        },
      });
      expect(created.status).toBe(201);
      const roots = orgs(root, { rootOnly: 'true' }).body.data as Page<{
        id: number;
      }>;
      expect(roots.items.map((o) => o.id)).toEqual([1]);
      const children = orgs(root, { parentId: '1' }).body.data as Page<{
        code: string;
      }>;
      expect(children.items.map((o) => o.code)).toEqual(['PB1']);
    });

    it('lets only a global admin create an org or change its status', () => {
      const orgAdmin = login('quantri.ban');
      const create = call(organizationEndpoints.createOrg, orgAdmin, {
        body: { orgType: 'UNIT', code: 'X', name: 'X', sortNo: 0 },
      });
      expect(create.status).toBe(403);
      const rename = call(organizationEndpoints.updateOrg, orgAdmin, {
        params: { orgId: '1' },
        body: { name: 'Tên mới' },
      });
      expect(rename.status).toBe(200);
      const status = call(organizationEndpoints.updateOrg, orgAdmin, {
        params: { orgId: '1' },
        body: { status: 'inactive' },
      });
      expect(code(status)).toBe('CORE-ACCESS_DENIED');
    });

    it('checks the hierarchy and the unique code', () => {
      const root = login('super.admin');
      const dept = (body: object) =>
        call(organizationEndpoints.createOrg, root, { body });
      expect(
        code(
          dept({ orgType: 'DEPARTMENT', code: 'PB', name: 'Phòng', sortNo: 0 }),
        ),
      ).toBe('ORGANIZATION-HIERARCHY_INVALID');
      expect(
        code(
          dept({
            orgType: 'UNIT',
            code: 'bidv110b803',
            name: 'Trùng',
            sortNo: 0,
          }),
        ),
      ).toBe('ORGANIZATION-ORG_CODE_EXISTS');
    });

    it('administrators of a node are the ADMIN ORG grants held there', () => {
      const detail = call(organizationEndpoints.getOrg, login('super.admin'), {
        params: { orgId: '1' },
      }).body.data as {
        administrators: { userId: string }[];
        organization: { memberCount: number; teamCount: number };
      };
      expect(detail.administrators.map((a) => a.userId)).toEqual(['000003']);
      expect(detail.organization).toMatchObject({
        memberCount: 7,
        teamCount: 15,
      });
    });

    it('previews five members of a team and counts them all', () => {
      const root = login('super.admin');
      const created = call(organizationEndpoints.createTeam, root, {
        params: { orgId: '1' },
        body: { name: 'Nhóm thử' },
      });
      const team = created.body.data as {
        id: number;
        code: string | null;
        memberCount: number;
      };
      expect(team.code).toBeNull();
      expect(team.memberCount).toBe(0);
      const teams = call(organizationEndpoints.listTeams, root, {
        params: { orgId: '1' },
        query: { size: '100' },
      }).body.data as Page<{ id: number }>;
      expect(teams.totalElements).toBe(16);
    });

    it('deletes an empty team but not one with members or grants', () => {
      const root = login('super.admin');
      const created = call(organizationEndpoints.createTeam, root, {
        params: { orgId: '1' },
        body: { name: 'Nhóm thử' },
      });
      const { id } = created.body.data as { id: number };
      expect(
        call(organizationEndpoints.deleteTeam, root, {
          params: { teamId: String(id) },
        }).status,
      ).toBe(200);
      const inUse = call(organizationEndpoints.deleteTeam, root, {
        params: { teamId: '7' },
      });
      expect(inUse.status).toBe(200);
      expect(code(inUse)).toBe('ORGANIZATION-TEAM_IN_USE');
      // Team 1 holds a (still active) REPORT_VIEWER grant and a member.
      expect(
        code(
          call(organizationEndpoints.deleteTeam, root, {
            params: { teamId: '1' },
          }),
        ),
      ).toBe('ORGANIZATION-TEAM_IN_USE');
    });

    it('a team patch clears its code with null and rejects a duplicate code', () => {
      const root = login('super.admin');
      const patch = (teamId: string, body: unknown) =>
        call(organizationEndpoints.updateTeam, root, {
          params: { teamId },
          body,
        });
      const cleared = patch('2', { code: null });
      expect((cleared.body.data as { code: string | null }).code).toBeNull();
      expect(code(patch('3', { code: 'bidv110b8031000' }))).toBe(
        'ORGANIZATION-TEAM_CODE_EXISTS',
      );
    });
  });

  describe('the endpoints the backend lacks', () => {
    const roles = () =>
      RoleSchema.array().parse(call(adminOrgEndpoints.roles, null).body.data);
    const save = (body: unknown) =>
      call(adminOrgEndpoints.saveRole, null, { body });
    const remove = (roleId: string) =>
      call(adminOrgEndpoints.deleteRole, null, { params: { roleId } });
    const draft = {
      name: 'Kiểm soát',
      description: 'Xem báo cáo',
      menus: ['PROFILE', 'REPORTING'],
    };

    it('lists the five system roles and one custom role, counting the holders of a system role', () => {
      const list = roles();
      expect(list.filter((r) => r.system)).toHaveLength(5);
      expect(list.find((r) => r.id === 'learner')?.userCount).toBeGreaterThan(
        0,
      );
      expect(list.find((r) => r.id === 'content-lead')?.system).toBe(false);
    });

    it('adds a role that the next list shows', () => {
      const reply = save(draft);
      expect(reply.status).toBe(200);
      const created = RoleSchema.parse(reply.body.data);
      expect(created).toMatchObject({ ...draft, system: false, userCount: 0 });
      expect(roles().map((r) => r.id)).toContain(created.id);
    });

    it('changes a role that the next list shows', () => {
      save({ ...draft, id: 'content-lead' });
      expect(roles().find((r) => r.id === 'content-lead')).toMatchObject(draft);
    });

    it('refuses a locked role, a missing one and a duplicate name', () => {
      expect(save({ ...draft, id: 'admin' }).body.message).toContain('bị khóa');
      expect(save({ ...draft, id: 'nope' }).body.message).toContain(
        'không tồn tại',
      );
      expect(save({ ...draft, name: 'học viên' }).body.status).toBe('ERROR');
      expect(save({ ...draft, name: ' ' }).body.messageCode).toBe(
        'CORE-VALIDATION_FAILED',
      );
      expect(roles()).toHaveLength(6);
    });

    it('deletes a custom role from the next list, and refuses a system or a missing one', () => {
      expect(remove('content-lead').body.data).toBe(true);
      expect(roles().map((r) => r.id)).not.toContain('content-lead');
      expect(remove('learner').body.status).toBe('ERROR');
      expect(remove('content-lead').body.status).toBe('ERROR');
    });

    it("answers the nav counts of the most powerful role of the caller, the learner's for a stranger", () => {
      const counts = (token: string | null) =>
        call(shellEndpoints.navCounts, token).body.data;
      // `notifications` is the caller's due reminders; `inbox` is the role's fixture.
      expect(counts(login('giangvien'))).toEqual({
        notifications: 0,
        inbox: 3,
      });
      expect(counts(login('hocvien'))).toEqual({ notifications: 3, inbox: 0 });
      expect(counts('not-issued-here')).toEqual({ notifications: 2, inbox: 0 });
    });
  });

  describe('knowledge', () => {
    const file = (name: string, content = 'nội dung') =>
      new File([content], name, { type: 'text/markdown' });
    const items = (reply: FakeReply) =>
      (reply.body.data as Page<KnowledgeDocument>).items;

    it('lists everyone’s documents to any signed-in user, newest first', () => {
      const reply = call(knowledgeEndpoints.documents, login('hocvien'));
      expect(reply.status).toBe(200);
      expect(items(reply).map((d) => d.id)).toEqual([3, 2, 1]);
    });

    it('narrows the list to the caller’s own uploads and to the statuses asked for', () => {
      const token = login('giangvien');
      expect(
        items(
          call(knowledgeEndpoints.documents, token, {
            query: { mine: 'true' },
          }),
        ).map((d) => d.id),
      ).toEqual([2, 1]);
      expect(
        items(
          call(knowledgeEndpoints.documents, token, {
            query: { status: 'failed,processing' },
          }),
        ).map((d) => d.id),
      ).toEqual([3, 2]);
      expect(
        code(
          call(knowledgeEndpoints.documents, token, {
            query: { status: 'weird' },
          }),
        ),
      ).toBe('CORE-VALIDATION_FAILED');
    });

    it('queues an upload for its uploader, then moves it to processing and ready as it is read', () => {
      const token = login('giangvien');
      const created = call(knowledgeEndpoints.uploadDocument, token, {
        body: { file: file('quy-trinh.md') },
      });
      expect(created.status).toBe(201);
      const document = created.body.data as KnowledgeDocument;
      expect(document).toMatchObject({
        fileName: 'quy-trinh.md',
        status: 'queued',
        chunkCount: 0,
        uploadedBy: { userId: '000005', fullName: 'Giảng viên Demo' },
      });
      const status = () =>
        (
          call(knowledgeEndpoints.document, token, {
            params: { documentId: String(document.id) },
          }).body.data as KnowledgeDocument
        ).status;
      expect(status()).toBe('processing');
      expect(status()).toBe('ready');
      expect(status()).toBe('ready');
    });

    it('shows an uploaded document to other roles as well', () => {
      call(knowledgeEndpoints.uploadDocument, login('giangvien'), {
        body: { file: file('chung.md') },
      });
      const names = items(
        call(knowledgeEndpoints.documents, login('hocvien')),
      ).map((d) => d.fileName);
      expect(names).toContain('chung.md');
    });

    it('refuses an unsupported, empty or oversized file with the backend codes', () => {
      const token = login('giangvien');
      const upload = (body: unknown) =>
        code(call(knowledgeEndpoints.uploadDocument, token, { body }));
      expect(upload({ file: file('tinh.exe') })).toBe(
        'KNOWLEDGE-FILE_TYPE_UNSUPPORTED',
      );
      expect(upload({ file: file('rong.md', '') })).toBe(
        'KNOWLEDGE-FILE_INVALID',
      );
      const big = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'lon.pdf');
      expect(upload({ file: big })).toBe('KNOWLEDGE-FILE_TOO_LARGE');
      expect(upload({})).toBe('CORE-VALIDATION_FAILED');
    });

    it('refuses a missing document as not found', () => {
      const reply = call(knowledgeEndpoints.document, login('hocvien'), {
        params: { documentId: '99' },
      });
      expect(code(reply)).toBe('CORE-RESOURCE_NOT_FOUND');
    });

    it('answers a question with citations, and the fixed sentence when the question says "không có"', () => {
      const token = login('hocvien');
      const found = call(knowledgeEndpoints.ask, token, {
        body: { question: 'EOD là gì?' },
      });
      expect(found.body.data).toMatchObject({ found: true });
      const none = call(knowledgeEndpoints.ask, token, {
        body: { question: 'Tài liệu không có mục này?' },
      });
      expect(none.body.data).toEqual({
        answer: 'Không tìm thấy thông tin này trong tài liệu.',
        found: false,
        citations: [],
      });
    });

    it('replays the answer as stream events and refuses an invalid question before streaming', () => {
      const token = login('hocvien');
      const stream = call(knowledgeEndpoints.askStream, token, {
        body: { question: 'EOD là gì?' },
      });
      expect(stream.events?.map((e) => (e as { type: string }).type)).toEqual([
        'retrieved',
        'delta',
        'delta',
        'delta',
        'delta',
        'delta',
        'done',
      ]);
      expect(
        code(
          call(knowledgeEndpoints.askStream, token, {
            body: { question: '  ' },
          }),
        ),
      ).toBe('CORE-VALIDATION_FAILED');
      expect(
        code(
          call(knowledgeEndpoints.askStream, token, {
            body: { question: 'x'.repeat(301) },
          }),
        ),
      ).toBe('CORE-VALIDATION_FAILED');
    });

    it('needs a signed-in user for every knowledge endpoint', () => {
      for (const endpoint of Object.values(knowledgeEndpoints)) {
        const reply = call(endpoint, null, {
          params: { documentId: '1' },
          body: { question: 'a' },
        });
        expect(reply.status, endpoint.path).toBe(401);
      }
    });
  });

  describe('the quick assistant', () => {
    const turn = (token: string | null, content: string) =>
      call(agentEndpoints.stream, token, {
        body: { messages: [{ role: 'user', content }] },
      });
    const events = (reply: FakeReply) =>
      (reply.events ?? []).map((e) => AgentStreamEventSchema.parse(e));
    const types = (reply: FakeReply) => events(reply).map((e) => e.type);
    const actionOf = (reply: FakeReply) => {
      const event = events(reply).find((e) => e.type === 'action_required');
      if (event?.type !== 'action_required') throw new Error('no action');
      return event.action;
    };
    const meOf = (token: string) =>
      call(authV1Endpoints.me, token).body.data as Me;

    it('answers a document question with a tool line, text and the citations', () => {
      const reply = turn(login('hocvien'), 'EOD là gì?');
      expect(types(reply)).toEqual(['tool', 'delta', 'delta', 'delta', 'done']);
      expect(events(reply)[0]).toEqual({
        type: 'tool',
        name: 'search_documents',
      });
      const done = events(reply).at(-1);
      expect(done?.type === 'done' && done.citations.length).toBe(2);
      const streamed = events(reply)
        .flatMap((e) => (e.type === 'delta' ? [e.text] : []))
        .join('');
      expect(done?.type === 'done' && done.answer).toBe(streamed);
    });

    it('answers the fixed sentence with no sources when the question says "không có trong tài liệu"', () => {
      const reply = turn(login('hocvien'), 'Việc X không có trong tài liệu?');
      expect(types(reply)).toEqual(['tool', 'done']);
      expect(events(reply)[1]).toEqual({
        type: 'done',
        answer: 'Không tìm thấy thông tin này trong tài liệu.',
        citations: [],
      });
    });

    it('fails mid-stream with the AI unavailable code when the question says "lỗi AI"', () => {
      const reply = turn(login('hocvien'), 'Thử lỗi AI giúp mình');
      expect(types(reply)).toEqual(['tool', 'error']);
      expect(events(reply)[1]).toMatchObject({
        type: 'error',
        messageCode: 'ASSISTANT-AI_UNAVAILABLE',
      });
    });

    it('opens a screen the caller is granted, ignoring case and accents', () => {
      const reply = turn(login('quantri'), 'MỞ TRANG quản ly người dung');
      expect(events(reply)).toEqual([
        { type: 'tool', name: 'open_screen' },
        { type: 'navigate', path: '/admin/users', title: 'Quản lý người dùng' },
        {
          type: 'done',
          answer: 'Đã mở trang Quản lý người dùng.',
          citations: [],
        },
      ]);
    });

    it('refuses in words a screen the caller is not granted, without navigating', () => {
      const reply = turn(login('hocvien'), 'mở trang quản lý người dùng');
      expect(types(reply)).not.toContain('navigate');
      const done = events(reply).at(-1);
      expect(done).toEqual({
        type: 'done',
        answer:
          'Bạn không có quyền mở màn hình này hoặc màn hình không tồn tại.',
        citations: [],
      });
    });

    it('proposes a profile change with the seeded value as "from" and changes nothing yet', () => {
      const token = login('hocvien');
      const before = meOf(token).user.positionName;
      const reply = turn(
        token,
        'Đổi chức danh của tôi thành Chuyên viên chính',
      );
      expect(types(reply)).toEqual(['tool', 'action_required', 'done']);
      expect(actionOf(reply)).toMatchObject({
        tool: 'update_profile',
        title: 'Cập nhật hồ sơ cá nhân',
        changes: [
          {
            field: 'positionName',
            label: 'Chức danh',
            from: before,
            to: 'Chuyên viên chính',
          },
        ],
      });
      expect(meOf(token).user.positionName).toBe(before);
    });

    it('proposes the email and the full name too, and refuses a value the profile rules reject', () => {
      const token = login('hocvien');
      expect(
        actionOf(turn(token, 'đổi email của tôi thành moi@example.test'))
          .changes[0],
      ).toMatchObject({ field: 'email', to: 'moi@example.test' });
      expect(
        actionOf(turn(token, 'sửa họ tên của mình thành Nguyễn Văn Minh'))
          .changes[0],
      ).toMatchObject({ field: 'fullName', to: 'Nguyễn Văn Minh' });
      const bad = turn(token, 'đổi email của tôi thành khong-phai-email');
      expect(types(bad)).not.toContain('action_required');
      expect(events(bad).at(-1)).toMatchObject({
        type: 'done',
        answer: 'Email không hợp lệ hoặc dài quá 100 ký tự.',
      });
    });

    it('says nothing changes when the value is already the current one', () => {
      const token = login('hocvien');
      const current = meOf(token).user.positionName as string;
      const reply = turn(token, `đổi chức danh của tôi thành ${current}`);
      expect(types(reply)).not.toContain('action_required');
      expect(events(reply).at(-1)).toMatchObject({
        answer: 'Hồ sơ đã có đúng giá trị này, không cần thay đổi.',
      });
    });

    it('offers no profile change to an account that is not local', () => {
      const token = login('hocvien');
      const users = (
        backend as unknown as {
          users: { userId: string; authProvider: string }[];
        }
      ).users;
      users.find((u) => u.userId === '000004')!.authProvider = 'SSO';
      const reply = turn(token, 'đổi chức danh của tôi thành Chuyên viên');
      expect(types(reply)).not.toContain('action_required');
    });

    it('confirms once: the profile changes, /auth/me shows it, a second confirm is not found', () => {
      const token = login('hocvien');
      const action = actionOf(
        turn(token, 'Đổi chức danh của tôi thành Chuyên viên chính'),
      );
      const reply = call(agentEndpoints.confirmAction, token, {
        params: { actionId: action.id },
      });
      expect(reply.status).toBe(200);
      expect(reply.body.data).toMatchObject({
        actionId: action.id,
        tool: 'update_profile',
        message: 'Đã cập nhật hồ sơ.',
        data: { user: { positionName: 'Chuyên viên chính' } },
      });
      expect(meOf(token).user.positionName).toBe('Chuyên viên chính');
      expect(
        code(
          call(agentEndpoints.confirmAction, token, {
            params: { actionId: action.id },
          }),
        ),
      ).toBe('ASSISTANT-ACTION_NOT_FOUND');
    });

    it('answers not found for another user’s action, a cancelled one and an unknown id', () => {
      const owner = login('hocvien');
      const other = login('giangvien');
      const action = actionOf(
        turn(owner, 'Đổi chức danh của tôi thành Chuyên viên chính'),
      );
      expect(
        code(
          call(agentEndpoints.confirmAction, other, {
            params: { actionId: action.id },
          }),
        ),
      ).toBe('ASSISTANT-ACTION_NOT_FOUND');
      expect(
        code(
          call(agentEndpoints.cancelAction, other, {
            params: { actionId: action.id },
          }),
        ),
      ).toBe('ASSISTANT-ACTION_NOT_FOUND');
      expect(
        call(agentEndpoints.cancelAction, owner, {
          params: { actionId: action.id },
        }).status,
      ).toBe(200);
      expect(
        code(
          call(agentEndpoints.confirmAction, owner, {
            params: { actionId: action.id },
          }),
        ),
      ).toBe('ASSISTANT-ACTION_NOT_FOUND');
      expect(
        code(
          call(agentEndpoints.confirmAction, owner, {
            params: { actionId: 'khong-co' },
          }),
        ),
      ).toBe('ASSISTANT-ACTION_NOT_FOUND');
    });

    it('answers stale when the profile changed after the proposal', () => {
      const token = login('hocvien');
      const action = actionOf(
        turn(token, 'Đổi chức danh của tôi thành Chuyên viên chính'),
      );
      call(authV1Endpoints.updateMe, token, {
        body: { positionName: 'Chức danh khác' },
      });
      expect(
        code(
          call(agentEndpoints.confirmAction, token, {
            params: { actionId: action.id },
          }),
        ),
      ).toBe('ASSISTANT-ACTION_STALE');
    });

    it('lets an action expire after ten minutes', () => {
      vi.useFakeTimers();
      try {
        const token = login('hocvien');
        const action = actionOf(
          turn(token, 'Đổi chức danh của tôi thành Chuyên viên chính'),
        );
        vi.advanceTimersByTime(10 * 60_000 + 1);
        expect(
          code(
            call(agentEndpoints.confirmAction, token, {
              params: { actionId: action.id },
            }),
          ),
        ).toBe('ASSISTANT-ACTION_NOT_FOUND');
      } finally {
        vi.useRealTimers();
      }
    });

    it('refuses an invalid command before streaming and needs a signed-in user', () => {
      const token = login('hocvien');
      const bad = (messages: unknown) =>
        code(call(agentEndpoints.stream, token, { body: { messages } }));
      expect(bad([])).toBe('CORE-VALIDATION_FAILED');
      expect(bad([{ role: 'assistant', content: 'x' }])).toBe(
        'CORE-VALIDATION_FAILED',
      );
      expect(bad([{ role: 'user', content: '  ' }])).toBe(
        'CORE-VALIDATION_FAILED',
      );
      expect(bad([{ role: 'user', content: 'x'.repeat(501) }])).toBe(
        'CORE-VALIDATION_FAILED',
      );
      for (const endpoint of Object.values(agentEndpoints)) {
        const reply = call(endpoint, null, {
          params: { actionId: 'a' },
          body: { messages: [{ role: 'user', content: 'a' }] },
        });
        expect(reply.status, endpoint.path).toBe(401);
      }
    });
  });
});
