import { ApiErrorSchema, authEndpoints } from '@lms/contracts';
import { endpointExamples, MOCK_FIXTURES } from './lib/examples';

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
        expect(() => ApiErrorSchema.parse(body)).not.toThrow();
      }
    },
  );

  it('every example belongs to a registered endpoint', () => {
    expect(MOCK_FIXTURES.size).toBe(Object.keys(endpointExamples).length);
  });

  it('answers the mock-only auth endpoints', () => {
    for (const endpoint of Object.values(authEndpoints)) {
      expect(MOCK_FIXTURES.has(endpoint)).toBe(true);
    }
  });
});
