import {
  type Me,
  type MenuKey,
  MenuKeySchema,
  type Profile,
} from '@lms/contracts';

/** Stand-in for `joinedAt`, which `/me` does not have and `Profile` requires. */
const NO_JOIN_DATE = '1970-01-01T00:00:00.000Z';

const ALL_MENUS: readonly MenuKey[] = MenuKeySchema.options;

function scopeLabel({ user, roleGrants }: Me): string {
  switch (roleGrants[0]?.scope.type) {
    case 'GLOBAL':
      return 'Toàn hệ thống';
    case 'ORG':
      return user.orgName ?? '—';
    case 'TEAM':
      return user.teamName ?? '—';
    case 'OWN':
      return 'Cá nhân';
    default:
      return '—';
  }
}

/**
 * Adapts the backend's `/me` to the `Profile` the app already renders. Every menu is granted
 * and the home is `/learn` until permissions are mapped; fields `/me` lacks are defaulted for
 * display only.
 */
export function toProfile(me: Me): Profile {
  const { user, roleGrants } = me;
  const grant = roleGrants[0];
  return {
    id: user.userId,
    staffCode: user.userId,
    name: user.fullName,
    email: user.email ?? '',
    title: user.positionName ?? '',
    status: user.status,
    roleId: grant?.roleCode ?? '',
    roleName: grant?.roleName ?? '',
    unitId: String(user.orgId ?? ''),
    unitName: user.orgName ?? '',
    groupId: String(user.teamId ?? ''),
    groupName: user.teamName ?? '',
    scopeUnitId: null,
    scopeName: scopeLabel(me),
    joinedAt: user.lastSyncTime ?? NO_JOIN_DATE,
    lastLoginAt: user.lastSyncTime ?? null,
    // TODO(backend): derive the menus and home from `functions` / `functionScopes`.
    menus: [...ALL_MENUS],
    homePath: '/learn',
  };
}
