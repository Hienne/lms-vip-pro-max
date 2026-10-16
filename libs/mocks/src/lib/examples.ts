import {
  adminOrgEndpoints,
  type AnyEndpoint,
  type ApiError,
  authEndpoints,
  healthEndpoints,
  shellEndpoints,
} from '@lms/contracts';
import {
  adminMetaFixture,
  deleteRoleForbidden,
  deleteRoleInvalid,
  roleNotFound,
  saveRoleInvalid,
  saveRoleLocked,
  deleteGroupInvalid,
  groupNotFound,
  orgFixtures,
  saveGroupInvalid,
  saveUnitForbidden,
  saveUnitInvalid,
  unitAdminOrg,
  unitNotFound,
  resetPasswordResult,
  saveUserForbidden,
  saveUserInvalid,
  setUserStatusInvalid,
  unitAdminMetaFixture,
  unitAdminUserList,
  userDetailFixture,
  userForbidden,
  userListFixtures,
  userNotFound,
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
  profileUnauthorized,
  updateProfileInvalid,
} from './auth/auth.fixtures';
import {
  groupFixtures,
  roleFixtures,
  unitFixtures,
} from './identity/identity.fixtures';
import { healthOk } from './health/health.fixtures';
import { navCountsFixtures } from './shell/shell.fixtures';

/** Named response examples of one endpoint; `default` is the 2xx body. */
export interface EndpointExamples {
  readonly default: unknown;
  /** Role-dependent bodies, keyed `learner`, `admin`, ... */
  readonly roles?: Readonly<Record<string, unknown>>;
  /** The mockup's specific error bodies for this endpoint, keyed by status; for specs. */
  readonly errors?: Readonly<Partial<Record<number, ApiError>>>;
}

/** Keyed by the endpoint's key in its registry. */
export const endpointExamples: Readonly<Record<string, EndpointExamples>> = {
  health: { default: healthOk },
  login: {
    default: loginResult,
    errors: { 401: loginUnauthorized, 422: loginInvalid, 423: loginLocked },
  },
  loginDemo: {
    default: loginResult,
    errors: { 404: loginDemoNotFound, 423: loginDemoLocked },
  },
  logout: { default: true },
  profile: {
    default: profileFixtures['learner'],
    roles: profileFixtures,
    errors: { 401: profileUnauthorized },
  },
  // The mock is stateless and a PUT carries no role example, so the app reloads the profile (a GET
  // with the role's example) instead of applying this body.
  updateProfile: {
    default: profileFixtures['learner'],
    errors: { 401: profileUnauthorized, 422: updateProfileInvalid },
  },
  changePassword: {
    default: true,
    errors: { 401: profileUnauthorized, 422: changePasswordInvalid },
  },
  demoAccounts: { default: demoAccountFixtures },
  users: {
    default: userListFixtures,
    roles: { admin: userListFixtures, 'unit-admin': unitAdminUserList },
  },
  // The mock is stateless: every user page answers with the seed's demo learner.
  user: {
    default: userDetailFixture,
    errors: { 403: userForbidden, 404: userNotFound },
  },
  saveUser: {
    default: userListFixtures[0],
    errors: { 403: saveUserForbidden, 422: saveUserInvalid },
  },
  setUserStatus: {
    default: userListFixtures[0],
    errors: { 422: setUserStatusInvalid, 404: userNotFound },
  },
  resetPassword: {
    default: resetPasswordResult,
    errors: { 404: userNotFound },
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
    errors: { 403: saveUnitForbidden, 422: saveUnitInvalid },
  },
  setUnitStatus: {
    default: unitFixtures[0],
    errors: { 404: unitNotFound },
  },
  saveGroup: {
    default: groupFixtures[0],
    errors: { 422: saveGroupInvalid },
  },
  deleteGroup: {
    default: true,
    errors: { 404: groupNotFound, 422: deleteGroupInvalid },
  },
  roles: { default: roleFixtures },
  // The mock is stateless: the mutations answer a seed role, and the app reloads `roles` instead.
  saveRole: {
    default: roleFixtures[4],
    errors: { 403: saveRoleLocked, 404: roleNotFound, 422: saveRoleInvalid },
  },
  deleteRole: {
    default: true,
    errors: {
      403: deleteRoleForbidden,
      404: roleNotFound,
      422: deleteRoleInvalid,
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
