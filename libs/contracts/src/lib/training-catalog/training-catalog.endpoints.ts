import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import {
  BusinessModuleSchema,
  ExpectedVersionQuerySchema,
  ListByOwnerOrgQuerySchema,
  ListModulesQuerySchema,
  SaveCatalogItemCommandSchema,
  TrainingFieldSchema,
  TrainingProgramSchema,
} from './training-catalog.schema';

const idParams = z.object({ id: z.number().int() });

/** The backend's training catalogue endpoints (/api/v1/training-catalog). No GET by id, no delete. */
export const trainingCatalogEndpoints = {
  listFields: defineEndpoint({
    method: 'get',
    path: '/api/v1/training-catalog/fields',
    query: ListByOwnerOrgQuerySchema,
    response: PageSchema(TrainingFieldSchema),
  }),
  createField: defineEndpoint({
    method: 'post',
    path: '/api/v1/training-catalog/fields',
    body: SaveCatalogItemCommandSchema,
    response: TrainingFieldSchema,
  }),
  updateField: defineEndpoint({
    method: 'put',
    path: '/api/v1/training-catalog/fields/{id}',
    params: idParams,
    query: ExpectedVersionQuerySchema,
    body: SaveCatalogItemCommandSchema,
    response: TrainingFieldSchema,
  }),
  listPrograms: defineEndpoint({
    method: 'get',
    path: '/api/v1/training-catalog/programs',
    query: ListByOwnerOrgQuerySchema,
    response: PageSchema(TrainingProgramSchema),
  }),
  createProgram: defineEndpoint({
    method: 'post',
    path: '/api/v1/training-catalog/programs',
    body: SaveCatalogItemCommandSchema,
    response: TrainingProgramSchema,
  }),
  updateProgram: defineEndpoint({
    method: 'put',
    path: '/api/v1/training-catalog/programs/{id}',
    params: idParams,
    query: ExpectedVersionQuerySchema,
    body: SaveCatalogItemCommandSchema,
    response: TrainingProgramSchema,
  }),
  listModules: defineEndpoint({
    method: 'get',
    path: '/api/v1/training-catalog/modules',
    query: ListModulesQuerySchema,
    response: PageSchema(BusinessModuleSchema),
  }),
  createModule: defineEndpoint({
    method: 'post',
    path: '/api/v1/training-catalog/modules',
    body: SaveCatalogItemCommandSchema,
    response: BusinessModuleSchema,
  }),
  updateModule: defineEndpoint({
    method: 'put',
    path: '/api/v1/training-catalog/modules/{id}',
    params: idParams,
    query: ExpectedVersionQuerySchema,
    body: SaveCatalogItemCommandSchema,
    response: BusinessModuleSchema,
  }),
} as const;
