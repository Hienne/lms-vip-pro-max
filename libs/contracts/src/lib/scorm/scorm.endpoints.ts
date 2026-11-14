import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';

export const ScormStatusSchema = z.enum([
  'not attempted',
  'incomplete',
  'passed',
  'failed',
  'completed',
  'browsed',
]);
export const ScormProgressSchema = z.object({
  lessonStatus: ScormStatusSchema,
  scoreRaw: z.number().nullable(),
  scoreMin: z.number().nullable(),
  scoreMax: z.number().nullable(),
  lessonLocation: z.string(),
  resumable: z.boolean(),
  updateTime: z.iso.datetime({ offset: true }).nullable(),
});
export const ScormPackageSchema = z.object({
  id: z.number().int().positive(),
  ownerOrgId: z.number().int().positive(),
  title: z.string(),
  originalName: z.string(),
  sizeBytes: z.number().nonnegative(),
  fileCount: z.number().int().nonnegative(),
  scormVersion: z.literal('1.2'),
  published: z.boolean(),
  canManage: z.boolean(),
  rowVersion: z.number().int().nonnegative(),
  createTime: z.iso.datetime({ offset: true }),
  warnings: z.array(z.string()),
  progress: ScormProgressSchema,
});
export const ScormLaunchSchema = z.object({
  launchUrl: z.url(),
  expiresAt: z.iso.datetime({ offset: true }),
  preview: z.boolean(),
  progress: ScormProgressSchema,
});
export type ScormPackage = z.infer<typeof ScormPackageSchema>;
export type ScormProgress = z.infer<typeof ScormProgressSchema>;
export type ScormLaunch = z.infer<typeof ScormLaunchSchema>;
const params = z.object({ id: z.number().int().positive() });
export const scormEndpoints = {
  list: defineEndpoint({
    method: 'get',
    path: '/api/v1/scorm/packages',
    query: z.object({
      q: z.string().max(200).optional(),
      page: z.number().int().nonnegative(),
      size: z.number().int().min(1).max(100),
    }),
    response: PageSchema(ScormPackageSchema),
  }),
  get: defineEndpoint({
    method: 'get',
    path: '/api/v1/scorm/packages/{id}',
    params,
    response: ScormPackageSchema,
  }),
  coursePackage: defineEndpoint({
    method: 'get',
    path: '/api/v1/scorm/packages/{id}',
    params,
    query: z.object({
      enrollmentId: z.number().int().positive(),
      lessonId: z.number().int().positive(),
    }),
    response: ScormPackageSchema,
  }),
  upload: defineEndpoint({
    method: 'post',
    path: '/api/v1/scorm/packages',
    encoding: 'multipart',
    query: z.object({ ownerOrgId: z.number().int().positive() }),
    body: z.object({ file: z.file().max(100 * 1024 * 1024) }),
    response: ScormPackageSchema,
  }),
  publish: defineEndpoint({
    method: 'post',
    path: '/api/v1/scorm/packages/{id}/publish',
    params,
    body: z.object({ expectedVersion: z.number().int().nonnegative() }),
    response: ScormPackageSchema,
  }),
  launch: defineEndpoint({
    method: 'post',
    path: '/api/v1/scorm/packages/{id}/launch',
    params,
    body: z.object({
      preview: z.boolean(),
      restart: z.boolean().optional(),
      enrollmentId: z.number().int().positive().optional(),
      lessonId: z.number().int().positive().optional(),
    }),
    response: ScormLaunchSchema,
  }),
  progress: defineEndpoint({
    method: 'get',
    path: '/api/v1/scorm/packages/{id}/progress',
    params,
    query: z.object({
      preview: z.boolean(),
      enrollmentId: z.number().int().positive().optional(),
      lessonId: z.number().int().positive().optional(),
    }),
    response: ScormProgressSchema,
  }),
} as const;
