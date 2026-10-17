import {
  adminOrgEndpoints,
  type AnyEndpoint,
  type Envelope,
  shellEndpoints,
} from '@lms/contracts';
import {
  deleteRoleNotPermitted,
  deleteRoleRejected,
  roleFixtures,
  roleMissing,
  saveRoleRejected,
  systemRoleLocked,
  userAttemptFixtures,
  userAuditFixtures,
  userCourseFixtures,
} from './admin-org/admin-org.fixtures';
import { sessionExpired } from './error-envelopes';
import { navCountsFixtures } from './shell/shell.fixtures';

/** Named response examples of one mock-only endpoint; `default` is the 2xx body. */
export interface EndpointExamples {
  readonly default: unknown;
  /** Role-dependent bodies, keyed by the backend role code (`LEARNER`, `ADMIN`, ...) of the signed-in demo user. */
  readonly roles?: Readonly<Record<string, unknown>>;
  /** The `ERROR` envelopes this endpoint can answer, keyed by scenario name; for specs. */
  readonly errors?: Readonly<Record<string, Envelope>>;
}

/**
 * The examples of the endpoints the backend does not have (role CRUD, a user's courses, attempts
 * and audit, the shell's nav counts), keyed by the endpoint object itself, which is how the app's
 * dev mock API looks a request up. The endpoints the backend does have are answered by
 * `FakeBackend`; an endpoint in neither goes to the network. The mock is stateless here: a
 * mutation answers a seed record and the app reloads the list instead.
 */
export const MOCK_FIXTURES: ReadonlyMap<AnyEndpoint, EndpointExamples> =
  new Map<AnyEndpoint, EndpointExamples>([
    [
      adminOrgEndpoints.userCourses,
      { default: userCourseFixtures, errors: { sessionExpired } },
    ],
    [adminOrgEndpoints.userAttempts, { default: userAttemptFixtures }],
    [adminOrgEndpoints.userAudit, { default: userAuditFixtures }],
    [adminOrgEndpoints.roles, { default: roleFixtures }],
    [
      adminOrgEndpoints.saveRole,
      {
        default: roleFixtures[roleFixtures.length - 1],
        errors: {
          locked: systemRoleLocked,
          missing: roleMissing,
          rejected: saveRoleRejected,
        },
      },
    ],
    [
      adminOrgEndpoints.deleteRole,
      {
        default: true,
        errors: {
          notPermitted: deleteRoleNotPermitted,
          missing: roleMissing,
          rejected: deleteRoleRejected,
        },
      },
    ],
    [
      shellEndpoints.navCounts,
      { default: navCountsFixtures['LEARNER'], roles: navCountsFixtures },
    ],
  ]);
