import { ApiErrorSchema, endpointRegistries } from '@lms/contracts';
import { endpointExamples, errorExamples } from './lib/examples';

const endpoints = endpointRegistries.flatMap((registry) =>
  Object.entries(registry),
);

describe('fixtures match their contracts', () => {
  it.each(endpoints)('%s default example parses', (key, endpoint) => {
    const examples = endpointExamples[key];
    expect(examples, `no example for ${key}`).toBeDefined();
    expect(() => endpoint.response.parse(examples?.default)).not.toThrow();
    for (const [role, body] of Object.entries(examples?.roles ?? {})) {
      expect(() => endpoint.response.parse(body), role).not.toThrow();
    }
  });

  it.each(Object.entries(errorExamples))('error %s parses', (_, body) => {
    expect(() => ApiErrorSchema.parse(body)).not.toThrow();
  });
});
