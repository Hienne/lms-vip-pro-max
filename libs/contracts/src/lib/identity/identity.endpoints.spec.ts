import { toUrl } from '../http/endpoint';
import { identityEndpoints } from './identity.endpoints';
import {
  CreateUserCommandSchema,
  GrantRequestSchema,
  ListUsersQuerySchema,
  UpdateUserCommandSchema,
  UserSummarySchema,
} from './user.schema';

describe('identity endpoints', () => {
  it('declare the backend paths and methods', () => {
    expect(
      Object.entries(identityEndpoints).map(([key, e]) => [
        key,
        e.method,
        e.path,
      ]),
    ).toEqual([
      ['listUsers', 'get', '/api/v1/users'],
      ['createUser', 'post', '/api/v1/users'],
      ['getUser', 'get', '/api/v1/users/{userId}'],
      ['updateUser', 'patch', '/api/v1/users/{userId}'],
      ['setUserStatus', 'patch', '/api/v1/users/{userId}/status'],
      ['grantRole', 'post', '/api/v1/users/{userId}/role-grants'],
      ['revokeRole', 'delete', '/api/v1/users/{userId}/role-grants/{grantId}'],
      ['listRoles', 'get', '/api/v1/roles'],
      ['accessRequests', 'get', '/api/v1/access-requests'],
      [
        'rejectAccessRequest',
        'post',
        '/api/v1/access-requests/{requestId}/reject',
      ],
      [
        'approveAccessRequest',
        'post',
        '/api/v1/access-requests/{requestId}/approve',
      ],
      ['registrationUnits', 'get', '/api/v1/auth/registration-units'],
      ['registerRequest', 'post', '/api/v1/auth/register-request'],
      ['passwordResetRequest', 'post', '/api/v1/auth/password-reset-request'],
      [
        'resetPasswordForRequest',
        'post',
        '/api/v1/access-requests/{requestId}/reset-password',
      ],
    ]);
  });

  it('keeps the staff code a string with its leading zeros in the url', () => {
    expect(toUrl(identityEndpoints.getUser, { userId: '000004' })).toBe(
      '/api/v1/users/000004',
    );
    expect(
      toUrl(identityEndpoints.revokeRole, { userId: '000005', grantId: 7 }),
    ).toBe('/api/v1/users/000005/role-grants/7');
  });

  it('knows exactly the three account statuses', () => {
    expect(ListUsersQuerySchema.parse({ status: 'locked' })).toEqual({
      status: 'locked',
    });
    expect(() => ListUsersQuerySchema.parse({ status: 'suspended' })).toThrow();
    expect(() => ListUsersQuerySchema.parse({ size: 101 })).toThrow();
    expect(() => ListUsersQuerySchema.parse({ page: -1 })).toThrow();
  });

  it('parses a user row with null org and team and no email', () => {
    const row = UserSummarySchema.parse({
      userId: '000001',
      username: 'super.admin',
      fullName: 'Quản trị gốc Demo',
      email: null,
      status: 'active',
      authProvider: 'LOCAL',
      mustChangePassword: false,
      orgId: 1,
      orgName: 'Ban Quản lý và phát triển Core Banking',
      orgType: 'UNIT',
      teamId: null,
      teamName: null,
      positionName: 'Quản trị hệ thống',
      roleCodes: ['SUPER_ADMIN'],
      editable: true,
    });
    expect(row.userId).toBe('000001');
  });

  it('takes numeric ids and a scope field in a grant request', () => {
    expect(
      GrantRequestSchema.parse({ roleId: 4, scope: 'ORG', orgId: 1 }),
    ).toEqual({ roleId: 4, scope: 'ORG', orgId: 1 });
    expect(() =>
      GrantRequestSchema.parse({ roleId: '4', scope: 'ORG' }),
    ).toThrow();
    expect(() =>
      GrantRequestSchema.parse({ roleId: 4, type: 'ORG' }),
    ).toThrow();
  });

  it('creates a user with a temporary password and optional grants', () => {
    const command = {
      userId: '000008',
      username: 'moi',
      fullName: 'Người mới',
      initialPassword: 'Demo@123',
      initialRoleGrants: [{ roleId: 3, scope: 'OWN' }],
    };
    expect(CreateUserCommandSchema.parse(command)).toEqual(command);
  });

  it('updates a user with changed fields; null clears email, org and team', () => {
    expect(
      UpdateUserCommandSchema.parse({ teamId: null, email: null }),
    ).toEqual({ teamId: null, email: null });
    expect(() => UpdateUserCommandSchema.parse({ fullName: null })).toThrow();
  });
});
