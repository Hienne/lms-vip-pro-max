import { endpointRegistries } from '@lms/contracts';
import { buildSpec, type Json } from './openapi';

type Operation = {
  operationId: string;
  responses: Record<
    string,
    { content: Record<string, { examples: Record<string, unknown> }> }
  >;
};

const paths = buildSpec()['paths'] as Record<string, Record<string, Operation>>;

describe('buildSpec', () => {
  it('declares an OpenAPI 3.1 document', () => {
    const doc: Json = buildSpec();
    expect(doc['openapi']).toBe('3.1.0');
  });

  describe.each(endpointRegistries.flatMap((r) => Object.entries(r)))(
    '%s',
    (operationId, endpoint) => {
      const operation = paths[endpoint.path]?.[endpoint.method];

      it('is present with its operationId', () => {
        expect(operation?.operationId).toBe(operationId);
      });

      it('has a default example on the success response', () => {
        const examples =
          operation?.responses['200']?.content['application/json']?.examples;
        expect(examples).toHaveProperty('default');
      });

      it.each([...endpoint.errors])(
        'has a default example for status %i',
        (status) => {
          const examples =
            operation?.responses[String(status)]?.content['application/json']
              ?.examples;
          expect(examples).toHaveProperty('default');
        },
      );
    },
  );
});
