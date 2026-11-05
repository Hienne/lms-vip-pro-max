import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import {
  BusinessModuleSchema,
  CatalogTreeSchema,
  ExpectedVersionQuerySchema,
  ListByOwnerOrgQuerySchema,
  ListCatalogTreeQuerySchema,
  ListModulesQuerySchema,
  SaveCatalogItemCommandSchema,
  TrainingFieldSchema,
  TrainingProgramSchema,
} from './training-catalog.schema';

const idParams = z.object({ id: z.number().int() });

/**
 * The backend's training catalogue endpoints (/api/v1/training-catalog). No GET by id. Mockup
 * `api/admin.js`: `tree`, `saveNode`, `duplicate`, `deleteNode`; a status change is the update PUT
 * with the new status.
 */
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
  /** `admin.tree`: fields, programs and courses of an owner org in one call. */
  tree: defineEndpoint({
    method: 'get',
    path: '/api/v1/training-catalog/tree',
    query: ListCatalogTreeQuerySchema,
    response: CatalogTreeSchema,
  }),
  /** `admin.duplicate` for a program: a draft with a draft of each course, nothing about learners. */
  copyProgram: defineEndpoint({
    method: 'post',
    path: '/api/v1/training-catalog/programs/{id}/copy',
    params: idParams,
    response: TrainingProgramSchema,
  }),
  /** `admin.deleteNode` for a field with no programs or modules; otherwise `LEARNING-CATALOG_IN_USE`. */
  deleteField: defineEndpoint({
    method: 'delete',
    path: '/api/v1/training-catalog/fields/{id}',
    params: idParams,
    query: ExpectedVersionQuerySchema,
    response: z.null(),
  }),
  /** `admin.deleteNode` for a program with no courses or bank questions; otherwise `LEARNING-CATALOG_IN_USE`. */
  deleteProgram: defineEndpoint({
    method: 'delete',
    path: '/api/v1/training-catalog/programs/{id}',
    params: idParams,
    query: ExpectedVersionQuerySchema,
    response: z.null(),
  }),
} as const;
