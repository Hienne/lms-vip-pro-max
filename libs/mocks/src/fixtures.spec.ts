import {
  adminOrgEndpoints,
  authV1Endpoints,
  EnvelopeSchema,
  identityEndpoints,
  organizationEndpoints,
  shellEndpoints,
} from '@lms/contracts';
import { FakeBackend } from './lib/backend/fake-backend';
import { MOCK_FIXTURES } from './lib/examples';

describe('fixtures match their contracts', () => {
  it.each([...MOCK_FIXTURES])(
    '%# default and role examples parse',
    (endpoint, examples) => {
      expect(() => endpoint.response.parse(examples.default)).not.toThrow();
      for (const [role, body] of Object.entries(examples.roles ?? {})) {
        expect(() => endpoint.response.parse(body), role).not.toThrow();
      }
    },
  );

  it.each([...MOCK_FIXTURES])(
    '%# endpoint-specific errors parse',
    (_, examples) => {
      for (const body of Object.values(examples.errors ?? {})) {
        expect(EnvelopeSchema.parse(body).status).toBe('ERROR');
      }
    },
  );

  it('error examples are keyed by scenario name, not by HTTP status', () => {
    for (const examples of MOCK_FIXTURES.values()) {
      for (const scenario of Object.keys(examples.errors ?? {})) {
        expect(scenario).not.toMatch(/^\d+$/);
      }
    }
  });

  it('answers exactly the endpoints declared served: mock', () => {
    const mockOnly = [
      ...Object.values(adminOrgEndpoints),
      ...Object.values(authV1Endpoints),
      ...Object.values(identityEndpoints),
      ...Object.values(organizationEndpoints),
      ...Object.values(shellEndpoints),
    ].filter((endpoint) => endpoint.served === 'mock');
    expect(
      [...MOCK_FIXTURES.keys()].sort((a, b) => a.path.localeCompare(b.path)),
    ).toEqual(mockOnly.sort((a, b) => a.path.localeCompare(b.path)));
  });

  it('keeps the backend endpoints out of the static fixtures and in the fake backend', () => {
    const backend = new FakeBackend();
    for (const endpoint of [
      ...Object.values(authV1Endpoints),
      ...Object.values(identityEndpoints),
      ...Object.values(organizationEndpoints),
    ]) {
      expect(MOCK_FIXTURES.has(endpoint), endpoint.path).toBe(false);
      expect(backend.answers(endpoint), endpoint.path).toBe(true);
    }
  });
});
