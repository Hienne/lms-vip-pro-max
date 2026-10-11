/**
 * Writes the OpenAPI 3.1 document Prism serves.
 * Paths come from the endpoint registries in @lms/contracts and examples from
 * @lms/mocks (docs/conventions/contracts-and-mocks.md → Prism). `/api/health`
 * is infrastructure: Prism refuses a document without operations, and it lets
 * the dev proxy be checked before any contract exists.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const outFile = process.argv[2];
if (!outFile) {
  throw new Error('Usage: build-spec <output-file>');
}

const document = {
  openapi: '3.1.0',
  info: { title: 'Core Banking Academy API (mock)', version: '0.0.0' },
  paths: {
    '/api/health': {
      get: {
        operationId: 'health',
        summary: 'Mock server liveness',
        responses: {
          '200': {
            description: 'Mock server is up',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', const: 'ok' } },
                  required: ['status'],
                },
                example: { status: 'ok' },
              },
            },
          },
        },
      },
    },
  },
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(document, null, 2)}\n`);
console.log(`OpenAPI written to ${outFile}`);
