/**
 * Writes the OpenAPI 3.1 document Prism serves.
 * Operations come from the endpoint registries in @lms/contracts and examples
 * from @lms/mocks (docs/conventions/contracts-and-mocks.md → Prism). The health
 * endpoint is a registered endpoint like any other: Prism refuses a document
 * without operations.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import {
  ApiErrorSchema,
  endpointRegistries,
  type AnyEndpoint,
} from '@lms/contracts';
import { endpointExamples, errorExamples } from '@lms/mocks';

const outFile = process.argv[2];
if (!outFile) {
  throw new Error('Usage: build-spec <output-file>');
}

type Json = Record<string, unknown>;

function jsonSchema(schema: z.ZodType): Json {
  const result = z.toJSONSchema(schema, {
    target: 'draft-2020-12',
    io: 'input',
  }) as Json;
  delete result['$schema'];
  return result;
}

function parameters(endpoint: AnyEndpoint): Json[] {
  const fromShape = (
    schema: z.ZodObject | undefined,
    location: 'path' | 'query',
  ): Json[] => {
    if (!schema) return [];
    const { properties = {}, required = [] } = jsonSchema(schema) as {
      properties?: Record<string, Json>;
      required?: string[];
    };
    return Object.entries(properties).map(([name, propSchema]) => ({
      name,
      in: location,
      required: location === 'path' || required.includes(name),
      schema: propSchema,
    }));
  };
  return [
    ...fromShape(endpoint.params, 'path'),
    ...fromShape(endpoint.query, 'query'),
  ];
}

function jsonContent(schema: Json, examples: Record<string, unknown>): Json {
  return {
    'application/json': {
      schema,
      examples: Object.fromEntries(
        Object.entries(examples).map(([name, value]) => [name, { value }]),
      ),
    },
  };
}

function operation(operationId: string, endpoint: AnyEndpoint): Json {
  const found = endpointExamples[operationId];
  if (!found) {
    throw new Error(`@lms/mocks has no example for "${operationId}"`);
  }
  const responses: Json = {
    '200': {
      description: 'Success',
      content: jsonContent(jsonSchema(endpoint.response), {
        default: found.default,
        ...found.roles,
      }),
    },
  };
  for (const status of endpoint.errors) {
    responses[String(status)] = {
      description: `Error ${status}`,
      content: jsonContent(jsonSchema(ApiErrorSchema), {
        default: found.errors?.[status] ?? errorExamples[status],
      }),
    };
  }
  const params = parameters(endpoint);
  return {
    operationId,
    summary: endpoint.summary,
    ...(params.length ? { parameters: params } : {}),
    ...(endpoint.body
      ? {
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: jsonSchema(endpoint.body) },
            },
          },
        }
      : {}),
    responses,
  };
}

const paths: Record<string, Json> = {};
for (const registry of endpointRegistries) {
  for (const [operationId, endpoint] of Object.entries(registry)) {
    const path = endpoint.path;
    paths[path] = {
      ...paths[path],
      [endpoint.method]: operation(operationId, endpoint),
    };
  }
}

const document = {
  openapi: '3.1.0',
  info: { title: 'Core Banking Academy API (mock)', version: '0.0.0' },
  paths,
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(document, null, 2)}\n`);
console.log(`OpenAPI written to ${outFile}`);
