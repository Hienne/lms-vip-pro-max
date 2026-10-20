import {
  adminOrgEndpoints,
  assessmentEndpoints,
  authV1Endpoints,
  learningDashboardEndpoints,
  personalEndpoints,
  reportEndpoints,
  type AnyEndpoint,
  identityEndpoints,
  organizationEndpoints,
  shellEndpoints,
} from '@lms/contracts';
import { FakeBackend } from './lib/backend/fake-backend';

const everyEndpoint: readonly AnyEndpoint[] = [
  ...Object.values(adminOrgEndpoints),
  ...Object.values(assessmentEndpoints),
  ...Object.values(authV1Endpoints),
  ...Object.values(learningDashboardEndpoints),
  ...Object.values(identityEndpoints),
  ...Object.values(organizationEndpoints),
  ...Object.values(personalEndpoints),
  ...Object.values(reportEndpoints),
  ...Object.values(shellEndpoints),
];

describe('FakeBackend and the endpoint registries', () => {
  it('answers every endpoint the app declares, the backend ones and the served: mock ones', () => {
    const backend = new FakeBackend();
    for (const endpoint of everyEndpoint) {
      expect(backend.answers(endpoint), endpoint.path).toBe(true);
    }
  });

  it('declares the endpoints the backend lacks as served: mock', () => {
    const mock = everyEndpoint
      .filter((endpoint) => endpoint.served === 'mock')
      .map((endpoint) => endpoint.path)
      .sort();
    expect(mock).toEqual(
      [
        ...Object.values(adminOrgEndpoints),
        ...Object.values(assessmentEndpoints),
        ...Object.values(learningDashboardEndpoints),
        ...Object.values(personalEndpoints),
        ...Object.values(reportEndpoints),
        shellEndpoints.navCounts,
      ]
        .map((endpoint) => endpoint.path)
        .sort(),
    );
  });

  // Role CRUD takes a body and is covered by the FakeBackend spec.
  it.each(
    everyEndpoint.filter(
      (endpoint) =>
        endpoint.served === 'mock' &&
        endpoint.method === 'get' &&
        endpoint !== adminOrgEndpoints.saveRole &&
        endpoint !== adminOrgEndpoints.deleteRole,
    ),
  )('answers the read %# with a body its contract parses', (endpoint) => {
    const reply = new FakeBackend().handle(endpoint, {
      token: null,
      params: {
        userId: '000004',
        quizId: 'q1',
        attemptId: 'at-demo',
        certificateId: 'cert1',
        dim: 'learners',
      },
      query: { dim: 'learners' },
      body: undefined,
    });
    const data =
      endpoint.responseType === 'blob' && reply && 'binary' in reply
        ? reply.binary
        : reply?.body.data;
    expect(() => endpoint.response.parse(data)).not.toThrow();
  });
});
