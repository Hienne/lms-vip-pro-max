import { EnvelopeSchema } from '@lms/contracts';
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
        expect(EnvelopeSchema.parse(body).status).toBe('ERROR');
      }
    },
  );

  it('error examples are keyed by scenario name, not by HTTP status', () => {
    for (const examples of Object.values(endpointExamples)) {
      for (const scenario of Object.keys(examples.errors ?? {})) {
        expect(scenario).not.toMatch(/^\d+$/);
      }
    }
  });

  it('every example belongs to a registered endpoint', () => {
    expect(MOCK_FIXTURES.size).toBe(Object.keys(endpointExamples).length);
  });
});
