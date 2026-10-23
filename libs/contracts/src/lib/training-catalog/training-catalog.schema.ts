import { z } from 'zod';
import { BackendDateTimeSchema } from '../http/datetime';
import { PageQuerySchema } from '../http/page';

// Mirrors the backend's training catalogue (/api/v1/training-catalog). A field (lĩnh vực) and a
// program (chương trình) belong to an owner org; a module (nghiệp vụ) sits under a field. Courses
// point at a program and a module through their draft. Every list is cut to the caller's scope by
// the server, and every row carries `rowVersion`, sent back as `expectedVersion` on update.

export const CatalogStatusSchema = z.enum([
  'draft',
  'published',
  'paused',
  'archived',
]);
export type CatalogStatus = z.infer<typeof CatalogStatusSchema>;

export const TrainingFieldSchema = z.object({
  id: z.number().int(),
  ownerOrgId: z.number().int(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  status: CatalogStatusSchema,
  sortNo: z.number().int().nullish(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type TrainingField = z.infer<typeof TrainingFieldSchema>;

export const TrainingProgramSchema = z.object({
  id: z.number().int(),
  fieldId: z.number().int().nullish(),
  ownerOrgId: z.number().int(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  status: CatalogStatusSchema,
  sortNo: z.number().int().nullish(),
  copiedFromProgramId: z.number().int().nullish(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type TrainingProgram = z.infer<typeof TrainingProgramSchema>;

/** The backend returns neither `description` nor `ownerOrgId` for a module. */
export const BusinessModuleSchema = z.object({
  id: z.number().int(),
  fieldId: z.number().int(),
  code: z.string(),
  name: z.string(),
  status: CatalogStatusSchema,
  sortNo: z.number().int().nullish(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type BusinessModule = z.infer<typeof BusinessModuleSchema>;

/** Field rules shared by the catalogue forms and the schemas. */
export const CATALOG_LIMITS = {
  code: 50,
  name: 255,
  description: 10000,
} as const;

/** Fields and programs are listed per owner org; the org is required. */
export const ListByOwnerOrgQuerySchema = PageQuerySchema.omit({
  sort: true,
}).extend({
  ownerOrgId: z.number().int().positive(),
});
export type ListByOwnerOrgQuery = z.infer<typeof ListByOwnerOrgQuerySchema>;

/** Modules are listed per field; the field is required. */
export const ListModulesQuerySchema = PageQuerySchema.omit({
  sort: true,
}).extend({
  fieldId: z.number().int().positive(),
});
export type ListModulesQuery = z.infer<typeof ListModulesQuerySchema>;

/**
 * One body for fields, programs and modules (`CatalogRequest`). `fieldId` is the parent of a
 * module. An update replaces the row but cannot move it to another org or field.
 */
export const SaveCatalogItemCommandSchema = z.object({
  ownerOrgId: z.number().int().positive(),
  fieldId: z.number().int().positive().optional(),
  code: z.string().max(CATALOG_LIMITS.code),
  name: z.string().max(CATALOG_LIMITS.name),
  description: z.string().max(CATALOG_LIMITS.description).optional(),
  status: CatalogStatusSchema,
  sortNo: z.number().int().nonnegative().optional(),
});
export type SaveCatalogItemCommand = z.infer<
  typeof SaveCatalogItemCommandSchema
>;

/** The row's `rowVersion`, as read; a stale one is refused. */
export const ExpectedVersionQuerySchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});
export type ExpectedVersionQuery = z.infer<typeof ExpectedVersionQuerySchema>;
