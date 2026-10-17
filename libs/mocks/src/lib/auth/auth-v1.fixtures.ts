import { envelopeOk } from '../envelope';

// Bodies of the backend's /api/v1/auth/* endpoints, as the wire carries them (enveloped).
// Not registered in `MOCK_FIXTURES`: the mock API forwards these endpoints to the network.

/** `envelopeOk` with the payload type kept, so specs can read `body.data`. */
function ok<T>(data: T) {
  return { ...envelopeOk(data), data };
}

export const loginV1Body = ok({
  accessToken: 'fixture.jwt.token',
  tokenType: 'Bearer',
  expiresInSeconds: 3600,
});

export const logoutV1Body = ok(null);

/** A real-shaped user: staff code with leading zeros, no email, no team. */
export const meV1Body = ok({
  user: {
    userId: '000123',
    username: 'demo.user',
    fullName: 'Nguyễn Văn Demo',
    email: null,
    status: 'active',
    authProvider: 'LOCAL',
    orgId: 7,
    orgCode: 'CBA',
    orgName: 'Ban QL&PT Core Banking',
    orgType: 'DIVISION',
    teamId: null,
    teamCode: null,
    teamName: null,
    positionName: 'Chuyên viên',
    lastSyncTime: '2026-10-16T08:30:00Z',
  },
  roles: ['LEARNER'],
  functions: ['LEARN_HOME'],
  roleGrants: [
    {
      roleCode: 'LEARNER',
      roleName: 'Học viên',
      scope: { type: 'ORG', orgId: 7, teamId: null },
    },
  ],
  functionDetails: [
    {
      id: 1,
      code: 'LEARN_HOME',
      name: 'Trang chủ học tập',
      routePattern: '/learn',
      parentFunctionId: null,
      sortNo: 10,
    },
  ],
  functionScopes: {
    LEARN_HOME: [{ type: 'ORG', orgId: 7, teamId: null }],
  },
});
