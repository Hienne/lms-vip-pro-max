import {
  adminOrgEndpoints,
  type AnyEndpoint,
  type Envelope,
  authEndpoints,
  healthEndpoints,
  shellEndpoints,
} from '@lms/contracts';
import {
  adminMetaFixture,
  deleteRoleNotPermitted,
  deleteRoleRejected,
  roleMissing,
  saveRoleRejected,
  systemRoleLocked,
  deleteGroupRejected,
  groupMissing,
  orgFixtures,
  saveGroupRejected,
  saveUnitNotPermitted,
  saveUnitRejected,
  unitAdminOrg,
  unitMissing,
  resetPasswordResult,
  saveUserNotPermitted,
  saveUserRejected,
  setUserStatusRejected,
  unitAdminMetaFixture,
  unitAdminUserList,
  userDetailFixture,
  userNotPermitted,
  userListFixtures,
  userMissing,
} from './admin-org/admin-org.fixtures';
import {
  demoAccountFixtures,
  loginDemoLocked,
  loginDemoNotFound,
  loginInvalid,
  loginLocked,
  loginResult,
  loginUnauthorized,
  changePasswordInvalid,
  profileFixtures,
  updateProfileInvalid,
} from './auth/auth.fixtures';
import {
  groupFixtures,
  roleFixtures,
  unitFixtures,
} from './identity/identity.fixtures';
import { sessionExpired } from './error-envelopes';
import { healthOk } from './health/health.fixtures';
import { navCountsFixtures } from './shell/shell.fixtures';

/** Named response examples of one endpoint; `default` is the 2xx body. */
export interface EndpointExamples {
  readonly default: unknown;
  /** Role-dependent bodies, keyed `learner`, `admin`, ... */
  readonly roles?: Readonly<Record<string, unknown>>;
  /** The `ERROR` envelopes this endpoint can answer, keyed by scenario name; for specs. */
  readonly errors?: Readonly<Record<string, Envelope>>;
}

/** Keyed by the endpoint's key in its registry. */
export const endpointExamples: Readonly<Record<string, EndpointExamples>> = {
  health: { default: healthOk },
  login: {
    default: loginResult,
    errors: {
      wrongCredentials: loginUnauthorized,
      invalidInput: loginInvalid,
      accountLocked: loginLocked,
    },
  },
  loginDemo: {
    default: loginResult,
    errors: {
      accountMissing: loginDemoNotFound,
      accountLocked: loginDemoLocked,
    },
  },
  logout: { default: true },
  profile: {
    default: profileFixtures['learner'],
    roles: profileFixtures,
    errors: { sessionExpired: sessionExpired },
  },
  // The mock is stateless and a PUT carries no role example, so the app reloads the profile (a GET
  // with the role's example) instead of applying this body.
  updateProfile: {
    default: profileFixtures['learner'],
    errors: {
      sessionExpired: sessionExpired,
      rejected: updateProfileInvalid,
    },
  },
  changePassword: {
    default: true,
    errors: {
      sessionExpired: sessionExpired,
      rejected: changePasswordInvalid,
    },
  },
  demoAccounts: { default: demoAccountFixtures },
  users: {
    default: userListFixtures,
    roles: { admin: userListFixtures, 'unit-admin': unitAdminUserList },
  },
  // The mock is stateless: every user page answers with the seed's demo learner.
  user: {
    default: userDetailFixture,
    errors: { notPermitted: userNotPermitted, missing: userMissing },
  },
  saveUser: {
    default: userListFixtures[0],
    errors: { notPermitted: saveUserNotPermitted, rejected: saveUserRejected },
  },
  setUserStatus: {
    default: userListFixtures[0],
    errors: { rejected: setUserStatusRejected, missing: userMissing },
  },
  resetPassword: {
    default: resetPasswordResult,
    errors: { missing: userMissing },
  },
  adminMeta: {
    default: adminMetaFixture,
    roles: { admin: adminMetaFixture, 'unit-admin': unitAdminMetaFixture },
  },
  org: {
    default: orgFixtures,
    roles: { admin: orgFixtures, 'unit-admin': unitAdminOrg },
  },
  // The mock is stateless: the mutations answer a seed record, and the app reloads `org` instead.
  saveUnit: {
    default: unitFixtures[0],
    errors: { notPermitted: saveUnitNotPermitted, rejected: saveUnitRejected },
  },
  setUnitStatus: {
    default: unitFixtures[0],
    errors: { missing: unitMissing },
  },
  saveGroup: {
    default: groupFixtures[0],
    errors: { rejected: saveGroupRejected },
  },
  deleteGroup: {
    default: true,
    errors: { missing: groupMissing, rejected: deleteGroupRejected },
  },
  roles: { default: roleFixtures },
  // The mock is stateless: the mutations answer a seed role, and the app reloads `roles` instead.
  saveRole: {
    default: roleFixtures[4],
    errors: {
      locked: systemRoleLocked,
      missing: roleMissing,
      rejected: saveRoleRejected,
    },
  },
  deleteRole: {
    default: true,
    errors: {
      notPermitted: deleteRoleNotPermitted,
      missing: roleMissing,
      rejected: deleteRoleRejected,
    },
  },
  navCounts: {
    default: navCountsFixtures['learner'],
    roles: navCountsFixtures,
  },
};

const registries = [
  healthEndpoints,
  authEndpoints,
  shellEndpoints,
  adminOrgEndpoints,
] as const;

/**
 * The examples of every endpoint that has some, keyed by the endpoint object itself, which is
 * how the app's dev mock API looks a request up. An endpoint missing here is not mocked.
 */
export const MOCK_FIXTURES: ReadonlyMap<AnyEndpoint, EndpointExamples> =
  new Map(
    registries
      .flatMap((registry) => Object.entries(registry))
      .flatMap(([key, endpoint]) => {
        const examples = endpointExamples[key];
        return examples ? [[endpoint, examples] as const] : [];
      }),
  );
