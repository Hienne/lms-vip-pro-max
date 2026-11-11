import { z } from 'zod';

/** The level the author targets; the server stores it with the job. */
export const CourseJobLevelSchema = z.enum([
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
]);
export type CourseJobLevel = z.infer<typeof CourseJobLevelSchema>;

export const CourseJobStatusSchema = z.enum([
  'queued',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'cancelled',
]);
export type CourseJobStatus = z.infer<typeof CourseJobStatusSchema>;

/** Jobs the server still works on or waits for the author on; the owl follows these. */
export const LIVE_COURSE_JOB_STATUSES: readonly CourseJobStatus[] = [
  'queued',
  'running',
];

/**
 * What the start form collects. The unit is only sent by an admin; an instructor's course always
 * belongs to their own unit. Programme and competency are the author's choice, never the model's.
 */
export const CourseJobInputsSchema = z.object({
  targetLearners: z.string().trim().min(1).max(500),
  level: CourseJobLevelSchema,
  chapters: z.number().int().min(1).max(20).nullish(),
  durationMinutes: z.number().int().min(15).max(1200).nullish(),
  programmeId: z.number().int().positive(),
  competencyId: z.number().int().positive(),
  ownerOrgId: z.number().int().positive().nullish(),
});
export type CourseJobInputs = z.infer<typeof CourseJobInputsSchema>;

/** `inputs` is the JSON text of {@link CourseJobInputs}, sent as one form field next to the file. */
export const StartCourseJobCommandSchema = z.object({
  file: z.file(),
  inputs: z.string(),
});
export type StartCourseJobCommand = z.infer<typeof StartCourseJobCommandSchema>;

export const CourseJobSourceSchema = z.object({
  documentId: z.number().int().nullable(),
  fileName: z.string(),
  status: z.string(),
});

export const CourseJobStepSchema = z.object({
  kind: z.string(),
  itemKey: z.string(),
  status: z.string(),
  errorMessage: z.string().nullish(),
});

export const CourseJobSchema = z.object({
  jobId: z.number().int(),
  status: CourseJobStatusSchema,
  step: z.string().nullish(),
  progress: z.number().int().min(0).max(100),
  error: z.string().nullish(),
  inputs: CourseJobInputsSchema,
  ownerOrgId: z.number().int(),
  source: CourseJobSourceSchema.nullish(),
  createdDraftId: z.number().int().nullish(),
  steps: z.array(CourseJobStepSchema),
  createTime: z.iso.datetime({ offset: true }),
  updateTime: z.iso.datetime({ offset: true }),
});
export type CourseJob = z.infer<typeof CourseJobSchema>;

export const CourseJobSummarySchema = z.object({
  jobId: z.number().int(),
  status: CourseJobStatusSchema,
  step: z.string().nullish(),
  progress: z.number().int().min(0).max(100),
  error: z.string().nullish(),
  sourceFileName: z.string().nullish(),
  createdDraftId: z.number().int().nullish(),
  createTime: z.iso.datetime({ offset: true }),
});
export type CourseJobSummary = z.infer<typeof CourseJobSummarySchema>;

/** The screen where an author follows a job, reviews it and asks for the draft. */
export const courseJobReviewPath = (jobId: number): string =>
  `/admin/courses/ai-drafts/${jobId}`;
