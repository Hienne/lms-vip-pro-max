import { toUrl } from '../http/endpoint';
import { adminOrgEndpoints } from './admin-org.endpoints';
import {
  SaveUserCommandSchema,
  SaveRoleCommandSchema,
  SetUnitStatusCommandSchema,
  SetUserStatusCommandSchema,
  UserDetailSchema,
} from './admin-org.schema';

describe('admin-org endpoints', () => {
  it('keeps the mockup function names as keys', () => {
    expect(Object.keys(adminOrgEndpoints).sort()).toEqual(
      [
        'adminMeta',
        'deleteGroup',
        'deleteRole',
        'org',
        'resetPassword',
        'roles',
        'saveGroup',
        'saveRole',
        'saveUnit',
        'saveUser',
        'setUnitStatus',
        'setUserStatus',
        'user',
        'users',
      ].sort(),
    );
  });

  it('builds the per-user urls from the user id', () => {
    expect(toUrl(adminOrgEndpoints.user, { userId: 'l1' })).toBe(
      '/api/admin/users/l1',
    );
    expect(toUrl(adminOrgEndpoints.setUserStatus, { userId: 'l1' })).toBe(
      '/api/admin/users/l1/status',
    );
  });

  it('builds the unit and group urls from their ids', () => {
    expect(toUrl(adminOrgEndpoints.setUnitStatus, { unitId: 'u2' })).toBe(
      '/api/admin/units/u2/status',
    );
    expect(toUrl(adminOrgEndpoints.deleteGroup, { groupId: 'g4' })).toBe(
      '/api/admin/groups/g4',
    );
    expect(adminOrgEndpoints.deleteGroup.method).toBe('delete');
  });

  it('saves a role as a name, a description and menu keys', () => {
    const command = { name: 'Kiểm soát', description: '', menus: ['reports'] };
    expect(SaveRoleCommandSchema.parse(command)).toEqual(command);
    expect(() =>
      SaveRoleCommandSchema.parse({ ...command, menus: ['admin.everything'] }),
    ).toThrow();
    expect(toUrl(adminOrgEndpoints.deleteRole, { roleId: 'x' })).toBe(
      '/api/admin/roles/x',
    );
  });

  it('only pauses or reactivates a unit', () => {
    expect(SetUnitStatusCommandSchema.parse({ status: 'paused' })).toEqual({
      status: 'paused',
    });
    expect(() =>
      SetUnitStatusCommandSchema.parse({ status: 'locked' }),
    ).toThrow();
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
