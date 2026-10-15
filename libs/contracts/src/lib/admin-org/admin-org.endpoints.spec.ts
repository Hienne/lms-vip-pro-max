import { toUrl } from '../http/endpoint';
import { adminOrgEndpoints } from './admin-org.endpoints';
import {
  SaveUserCommandSchema,
  SetUserStatusCommandSchema,
  UserDetailSchema,
} from './admin-org.schema';

describe('admin-org endpoints', () => {
  it('keeps the mockup function names as keys', () => {
    expect(Object.keys(adminOrgEndpoints).sort()).toEqual(
      [
        'adminMeta',
        'resetPassword',
        'saveUser',
        'setUserStatus',
        'user',
        'users',
      ].sort(),
    );
  });

  it.each([
    ['users', [401, 403]],
    ['user', [401, 403, 404]],
    ['saveUser', [401, 403, 422]],
    ['setUserStatus', [401, 403, 404, 422]],
    ['resetPassword', [401, 403, 404]],
    ['adminMeta', [401, 403]],
  ] as const)('%s declares its error statuses', (key, statuses) => {
    expect(adminOrgEndpoints[key].errors).toEqual(statuses);
  });

  it('builds the per-user urls from the user id', () => {
    expect(toUrl(adminOrgEndpoints.user, { userId: 'l1' })).toBe(
      '/api/admin/users/l1',
    );
    expect(toUrl(adminOrgEndpoints.setUserStatus, { userId: 'l1' })).toBe(
      '/api/admin/users/l1/status',
    );
  });

  it('takes the role as an id and the scope as a unit id or null', () => {
    const command = {
      name: 'An',
      email: 'an@demo.cb',
      title: '',
      unitId: 'u1',
      groupId: 'g1',
      roleId: 'content-lead',
      scopeUnitId: null,
    };
    expect(SaveUserCommandSchema.parse(command)).toEqual(command);
    expect(() =>
      SaveUserCommandSchema.parse({ ...command, scopeUnitId: undefined }),
    ).toThrow();
  });

  it('only moves an account between the three known states', () => {
    expect(() =>
      SetUserStatusCommandSchema.parse({ status: 'gone' }),
    ).toThrow();
  });

  it('has no competency or per-action permission in the user page', () => {
    expect(UserDetailSchema.shape).not.toHaveProperty('competency');
    expect(UserDetailSchema.shape).not.toHaveProperty('perms');
    expect(UserDetailSchema.shape).toHaveProperty('role');
  });
});
