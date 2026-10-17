import { toUrl } from '../http/endpoint';
import { adminOrgEndpoints } from './admin-org.endpoints';
import { SaveRoleCommandSchema } from './admin-org.schema';

describe('admin-org endpoints (mock only)', () => {
  it('keeps only what the backend lacks: role CRUD and the user detail tabs', () => {
    expect(Object.keys(adminOrgEndpoints).sort()).toEqual(
      [
        'deleteRole',
        'roles',
        'saveRole',
        'userAttempts',
        'userAudit',
        'userCourses',
      ].sort(),
    );
  });

  it('builds the per-user urls from the staff code, leading zeros kept', () => {
    expect(toUrl(adminOrgEndpoints.userCourses, { userId: '000004' })).toBe(
      '/api/admin/users/000004/courses',
    );
    expect(toUrl(adminOrgEndpoints.userAudit, { userId: '000004' })).toBe(
      '/api/admin/users/000004/audit',
    );
  });

  it('saves a role as a name, a description and backend function codes', () => {
    const command = {
      name: 'Kiểm soát',
      description: '',
      menus: ['REPORTING'],
    };
    expect(SaveRoleCommandSchema.parse(command)).toEqual(command);
    expect(() =>
      SaveRoleCommandSchema.parse({ ...command, menus: ['reports'] }),
    ).toThrow();
    expect(toUrl(adminOrgEndpoints.deleteRole, { roleId: 'x' })).toBe(
      '/api/admin/roles/x',
    );
    expect(adminOrgEndpoints.deleteRole.method).toBe('delete');
  });
});
