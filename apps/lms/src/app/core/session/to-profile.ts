import type { FunctionCode, Me } from '@lms/contracts';
import { homePathFor, knownFunctions } from '../menu/menu-catalog';
import type { Profile } from './profile';

/**
 * Adapts the backend's `/me` to the `Profile` the app renders. The menus are the functions `/me`
 * lists that the app has a screen for; the home is the entry screen of the first of them after
 * the profile. Nothing is computed from role names: the backend decides what a role opens.
 */
export function toProfile(me: Me): Profile {
  const { user, roleGrants } = me;
  const functions = knownFunctions(
    me.functionDetails.filter((fn) => me.functions.includes(fn.code)),
  );
  const roleNames = [...new Set(roleGrants.map((grant) => grant.roleName))];
  return {
    userId: user.userId,
    username: user.username,
    fullName: user.fullName,
    email: user.email ?? null,
    positionName: user.positionName ?? null,
    status: user.status,
    authProvider: user.authProvider,
    mustChangePassword: user.mustChangePassword,
    org:
      user.orgId == null
        ? null
        : {
            id: user.orgId,
            code: user.orgCode ?? null,
            name: user.orgName ?? '',
            type: user.orgType ?? null,
          },
    team:
      user.teamId == null
        ? null
        : {
            id: user.teamId,
            code: user.teamCode ?? null,
            name: user.teamName ?? '',
          },
    grants: roleGrants,
    functions,
    menus: functions.map((fn) => fn.code as FunctionCode),
    homePath: user.mustChangePassword
      ? '/change-password'
      : homePathFor(functions),
    roleText: roleNames.join(', '),
  };
}
