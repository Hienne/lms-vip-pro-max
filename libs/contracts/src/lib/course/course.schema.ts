import { z } from 'zod';
import { BackendDateTimeSchema } from '../http/datetime';
import { PageQuerySchema } from '../http/page';
import { RatingSummarySchema } from '../feedback/feedback.schema';

// Mirrors the backend's course authoring endpoints (/api/v1/courses, /api/v1/instructor,
// /api/v1/learning-assets). A course has revisions: one draft at a time and the published ones,
// which are frozen. A draft is saved whole: chapters, lessons and blocks are not edited one by one,
// and every save issues new ids for them (order follows the arrays). Every row carries
// `rowVersion`, sent back as `expectedVersion`.
//
// Status fields the backend has not enumerated yet (`lifecycleStatus`, `publicationState`,
// `learningStatus`, a revision's `state`, a share's or an asset's `status`) are plain strings until
// it does; the enums below are the values its request bodies accept.

export const CourseLevelSchema = z.enum(['basic', 'intermediate', 'advanced']);
export type CourseLevel = z.infer<typeof CourseLevelSchema>;

/** Whether a course is an obligation or a choice: the default of a course, or of one assignment. */
export const RequirementSchema = z.enum(['mandatory', 'optional']);
export type Requirement = z.infer<typeof RequirementSchema>;

export const LessonTypeSchema = z.enum(['content', 'quiz', 'scorm']);
export type LessonType = z.infer<typeof LessonTypeSchema>;

export const BlockTypeSchema = z.enum([
  'video',
  'pdf',
  'text',
  'process',
  'image',
  'attachment',
]);
export type BlockType = z.infer<typeof BlockTypeSchema>;

export const BodyFormatSchema = z.enum(['markdown', 'html', 'plain']);
export type BodyFormat = z.infer<typeof BodyFormatSchema>;

/** How a block counts as done; the server measures it. */
export const CompletionModeSchema = z.enum([
  'manual',
  'video_coverage',
  'pdf_end',
  'open',
]);
export type CompletionMode = z.infer<typeof CompletionModeSchema>;

export const AssetUsageSchema = z.enum([
  'primary',
  'attachment',
  'image',
  'poster',
]);
export type AssetUsage = z.infer<typeof AssetUsageSchema>;

/** The states an author may set on a course; publishing is its own command. */
export const CourseLifecycleSchema = z.enum(['active', 'paused', 'archived']);
export type CourseLifecycle = z.infer<typeof CourseLifecycleSchema>;

/** Field rules shared by the authoring forms and the schemas. */
export const COURSE_LIMITS = {
  code: 50,
  title: 255,
  summary: 30000,
  objective: 2000,
  coverIcon: 50,
  body: 100000,
  caption: 5000,
  altText: 255,
  stepDescription: 10000,
  /** Items per array: objectives, chapters, lessons per chapter, blocks per lesson. */
  items: 100,
  assetsPerBlock: 20,
  stepsPerBlock: 200,
  videoChapters: 50,
  chapterTitle: 120,
  transcriptLines: 2000,
  transcriptText: 1000,
  lessonSeconds: 86400,
  rewardPoints: 100000,
} as const;

// ---- Read models ----------------------------------------------------------------------------

export const CourseSchema = z.object({
  id: z.number().int(),
  code: z.string(),
  ownerOrgId: z.number().int(),
  ownerTeamId: z.number().int().nullish(),
  ownerUserId: z.string().nullish(),
  /** Absent until the first publish. */
  publishedRevisionId: z.number().int().nullish(),
  lifecycleStatus: z.string(),
  copiedFromCourseId: z.number().int().nullish(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type Course = z.infer<typeof CourseSchema>;

export const CourseRevisionSchema = z.object({
  id: z.number().int(),
  courseId: z.number().int(),
  revisionNo: z.number().int(),
  state: z.string(),
  basedOnRevisionId: z.number().int().nullish(),
  programId: z.number().int().nullish(),
  moduleId: z.number().int().nullish(),
  title: z.string().nullish(),
  summary: z.string().nullish(),
  level: CourseLevelSchema.nullish(),
  defaultRequirement: RequirementSchema.nullish(),
  coverAssetId: z.number().int().nullish(),
  coverIcon: z.string().nullish(),
  coverColor: z.string().nullish(),
  publishedAt: BackendDateTimeSchema.nullish(),
  publishedBy: z.string().nullish(),
  /** The content was written by the AI course generation: publishing needs the author's review confirmation. */
  aiGenerated: z.boolean().optional(),
  /** Who confirmed the review when the revision was published, and when. */
  reviewConfirmedBy: z.string().nullish(),
  reviewConfirmedAt: BackendDateTimeSchema.nullish(),
  /** Send it as `expectedVersion` to save or publish this revision. */
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type CourseRevision = z.infer<typeof CourseRevisionSchema>;

export const CourseObjectiveSchema = z.object({
  id: z.number().int(),
  revisionId: z.number().int(),
  description: z.string(),
  sortNo: z.number().int(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type CourseObjective = z.infer<typeof CourseObjectiveSchema>;

export const CourseCompletionRuleSchema = z.object({
  id: z.number().int(),
  revisionId: z.number().int(),
  requireAllRequiredLessons: z.boolean().nullish(),
  requireAllRequiredQuizzes: z.boolean().nullish(),
  finalQuizId: z.number().int().positive().nullish(),
  rewardPoints: z.number().int().nullish(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type CourseCompletionRule = z.infer<typeof CourseCompletionRuleSchema>;

export const CourseChapterSchema = z.object({
  id: z.number().int(),
  revisionId: z.number().int(),
  title: z.string(),
  sortNo: z.number().int(),
  /** The chapter of the revision this one was cloned from. */
  sourceChapterId: z.number().int().nullish(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type CourseChapter = z.infer<typeof CourseChapterSchema>;

export const LessonAiStateSchema = z.enum([
  'pending',
  'writing',
  'written',
  'user_edited',
]);
export type LessonAiState = z.infer<typeof LessonAiStateSchema>;

export const ScormCompletionRuleSchema = z.enum([
  'completed_or_passed',
  'passed',
]);
export type ScormCompletionRule = z.infer<typeof ScormCompletionRuleSchema>;

export const CourseLessonSchema = z.object({
  id: z.number().int(),
  chapterId: z.number().int(),
  title: z.string(),
  lessonType: LessonTypeSchema,
  estimatedDurationSeconds: z.number().nullish(),
  isRequired: z.boolean().nullish(),
  sortNo: z.number().int(),
  sourceLessonId: z.number().int().nullish(),
  /** The quiz a `quiz` lesson opens (a quiz of the same course); null for a content lesson. */
  quizId: z.number().int().nullish(),
  scormPackageId: z.number().int().positive().nullish(),
  scormCompletionRule: ScormCompletionRuleSchema.nullish(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
  /** Set for a lesson the AI manages; read-only, the server keeps it (a save never sends it). */
  aiState: LessonAiStateSchema.nullish(),
});
export type CourseLesson = z.infer<typeof CourseLessonSchema>;

/** A video chapter: where it starts, in seconds (may be a decimal), and its title. */
export const VideoChapterSchema = z.object({
  startSeconds: z.number(),
  title: z.string(),
});
export type VideoChapter = z.infer<typeof VideoChapterSchema>;

/**
 * A line of a video's transcript. `startSeconds` is `null` when the transcript has no times: the
 * backend takes either all lines timed or none, so a transcript never mixes them.
 */
export const TranscriptLineSchema = z.object({
  startSeconds: z.number().nullable(),
  text: z.string(),
});
export type TranscriptLine = z.infer<typeof TranscriptLineSchema>;

export const LessonBlockSchema = z.object({
  id: z.number().int(),
  lessonId: z.number().int(),
  blockType: BlockTypeSchema,
  title: z.string(),
  body: z.string().nullish(),
  bodyFormat: BodyFormatSchema.nullish(),
  completionMode: CompletionModeSchema,
  completionThreshold: z.number().nullish(),
  isRequired: z.boolean().nullish(),
  sortNo: z.number().int(),
  sourceBlockId: z.number().int().nullish(),
  /** Chapters and transcript of a `video` block, in time order; the backend sends `[]` when it has none. */
  videoChapters: z.array(VideoChapterSchema).default([]),
  transcript: z.array(TranscriptLineSchema).default([]),
  /** Learners may seek freely in this `video` block; an older backend omits it, which reads as off. */
  allowSeeking: z.boolean().default(false),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type LessonBlock = z.infer<typeof LessonBlockSchema>;

/** Where an asset is used in a block. */
export const BlockAssetSchema = z.object({
  id: z.number().int(),
  blockId: z.number().int(),
  assetId: z.number().int(),
  usage: AssetUsageSchema,
  caption: z.string().nullish(),
  altText: z.string().nullish(),
  sortNo: z.number().int().nullish(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type BlockAsset = z.infer<typeof BlockAssetSchema>;

/** One step of a `process` block. */
export const ProcessStepSchema = z.object({
  id: z.number().int(),
  blockId: z.number().int(),
  title: z.string(),
  description: z.string().nullish(),
  sortNo: z.number().int(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type ProcessStep = z.infer<typeof ProcessStepSchema>;

/** An uploaded file's metadata; the file itself is read through `getAssetContent`. */
export const LearningAssetSchema = z.object({
  id: z.number().int(),
  ownerOrgId: z.number().int(),
  uploadedBy: z.string().nullish(),
  storageType: z.string().nullish(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  checksumSha256: z.string().nullish(),
  durationSeconds: z.number().nullish(),
  pageCount: z.number().int().nullish(),
  width: z.number().int().nullish(),
  height: z.number().int().nullish(),
  status: z.string(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type LearningAsset = z.infer<typeof LearningAssetSchema>;

export const AssetDetailSchema = z.object({
  usage: BlockAssetSchema,
  asset: LearningAssetSchema,
});
export type AssetDetail = z.infer<typeof AssetDetailSchema>;

export const BlockDetailSchema = z.object({
  block: LessonBlockSchema,
  assets: z.array(AssetDetailSchema),
  steps: z.array(ProcessStepSchema),
});
export type BlockDetail = z.infer<typeof BlockDetailSchema>;

export const LessonDetailSchema = z.object({
  lesson: CourseLessonSchema,
  blocks: z.array(BlockDetailSchema),
});
export type LessonDetail = z.infer<typeof LessonDetailSchema>;

export const ChapterDetailSchema = z.object({
  chapter: CourseChapterSchema,
  lessons: z.array(LessonDetailSchema),
});
export type ChapterDetail = z.infer<typeof ChapterDetailSchema>;

/** A course with one revision's whole content tree, in order. */
export const CourseDetailSchema = z.object({
  course: CourseSchema,
  revision: CourseRevisionSchema,
  objectives: z.array(CourseObjectiveSchema),
  chapters: z.array(ChapterDetailSchema),
  completionRule: CourseCompletionRuleSchema.nullish(),
  /** The `FINAL_EXAM` quiz the revision must pass to complete; `null` when it has none. */
  finalQuizId: z.number().int().nullable().default(null),
});
export type CourseDetail = z.infer<typeof CourseDetailSchema>;

/** The backend's deadline state of a learner's card, apart from the learning status. */
export const DeadlineStatusSchema = z.enum([
  'not_active',
  'no_deadline',
  'on_time_active',
  'overdue_active',
  'completed_on_time',
  'completed_late',
]);
export type DeadlineStatus = z.infer<typeof DeadlineStatusSchema>;

/**
 * A row of a course list: the learner's catalogue and courses, and the instructor's courses.
 * The learner fields (`enrollmentId`, `learningStatus`, `progressPercent`, `dueAt`, `assigned`,
 * `overdue`) are the server's results; the instructor list fills `assignedCount`.
 */
export const CourseCardSchema = z.object({
  courseId: z.number().int(),
  revisionId: z.number().int().nullish(),
  code: z.string(),
  title: z.string().nullish(),
  programId: z.number().int().nullish(),
  moduleId: z.number().int().nullish(),
  level: CourseLevelSchema.nullish(),
  requirement: RequirementSchema.nullish(),
  publicationState: z.string().nullish(),
  lifecycleStatus: z.string().nullish(),
  lessonCount: z.number().int().nullish(),
  durationSeconds: z.number().nullish(),
  /** Distinct people assigned. */
  assignedCount: z.number().int().nullish(),
  enrollmentId: z.number().int().nullish(),
  learningStatus: z.string().nullish(),
  /** Required-lesson learning progress; 100% does not imply course completion. */
  progressPercent: z.number().nullish(),
  dueAt: BackendDateTimeSchema.nullish(),
  assigned: z.boolean().nullish(),
  overdue: z.boolean().nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
  /** The learner's cycle, dates and resume point (the server's results, `nullish` in the instructor list). */
  cycleNo: z.number().int().nullish(),
  startedAt: BackendDateTimeSchema.nullish(),
  lastAccessAt: BackendDateTimeSchema.nullish(),
  completedAt: BackendDateTimeSchema.nullish(),
  lastLessonId: z.number().int().nullish(),
  lastBlockId: z.number().int().nullish(),
  completedRequiredLessonCount: z.number().int().nullish(),
  requiredLessonCount: z.number().int().nullish(),
  deadlineStatus: DeadlineStatusSchema.nullish(),
  mediaAssetId: z.number().int().nullish(),
  lastPdfPage: z.number().int().nullish(),
  lastVideoPositionSeconds: z.number().nullish(),
  /** The programme's field and the programme and module names; null when the course has none. */
  fieldId: z.number().int().nullish(),
  fieldName: z.string().nullish(),
  programName: z.string().nullish(),
  moduleName: z.string().nullish(),
  /** The caller took the final exam and never passed it: the server's result, false in the instructor list. */
  failed: z.boolean().nullish(),
  /**
   * The best graded score on the course's published final exam, as a percentage; null when the course
   * has no final exam, the caller has no graded attempt, or in the instructor list. The server's result.
   */
  bestScorePercent: z.number().nullish(),
  /**
   * The average and the number of the learners' live ratings over every revision of the course; null
   * until someone rates. The server's result.
   */
  rating: RatingSummarySchema.nullish(),
  /**
   * The enrollment id of the certificate of this card's cycle: set when the cycle is completed, null
   * otherwise. The server's rule; the app never infers a certificate from `learningStatus`.
   */
  certificateId: z.number().int().nullish(),
  /**
   * The card revision's cover image, an asset the caller reads through `getAssetContent`; null when the
   * course has none. Who may read it is the server's rule (SPEC-learning-ui).
   */
  coverAssetId: z.number().int().nullish(),
});
export type CourseCard = z.infer<typeof CourseCardSchema>;

/** The right of one org (and optionally its subtree) to assign or self-enrol in a course. */
export const CourseShareSchema = z.object({
  id: z.number().int(),
  courseId: z.number().int(),
  orgId: z.number().int(),
  includeDescendants: z.boolean(),
  canAssign: z.boolean(),
  canSelfEnroll: z.boolean(),
  status: z.enum(['active', 'revoked']),
  sharedBy: z.string().nullish(),
  sharedAt: BackendDateTimeSchema.nullish(),
  revokedAt: BackendDateTimeSchema.nullish(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type CourseShare = z.infer<typeof CourseShareSchema>;

// ---- Queries and commands -------------------------------------------------------------------

/**
 * The filters of every course list. `learningStatus` and `state` take the server's values, not
 * enumerated yet.
 */
export const CourseListQuerySchema = PageQuerySchema.extend({
  q: z.string().optional(),
  fieldId: z.number().int().positive().optional(),
  programId: z.number().int().positive().optional(),
  moduleId: z.number().int().positive().optional(),
  level: CourseLevelSchema.optional(),
  requirement: RequirementSchema.optional(),
  learningStatus: z.string().optional(),
  state: z.string().optional(),
});
export type CourseListQuery = z.infer<typeof CourseListQuerySchema>;

export const AssetUseInputSchema = z.object({
  assetId: z.number().int().positive(),
  usage: AssetUsageSchema,
  caption: z.string().max(COURSE_LIMITS.caption).optional(),
  altText: z.string().max(COURSE_LIMITS.altText).optional(),
});
export type AssetUseInput = z.infer<typeof AssetUseInputSchema>;

export const StepInputSchema = z.object({
  title: z.string().max(COURSE_LIMITS.title),
  description: z.string().max(COURSE_LIMITS.stepDescription).optional(),
});
export type StepInput = z.infer<typeof StepInputSchema>;

export const BlockInputSchema = z.object({
  blockType: BlockTypeSchema,
  title: z.string().max(COURSE_LIMITS.title),
  body: z.string().max(COURSE_LIMITS.body).optional(),
  bodyFormat: BodyFormatSchema.optional(),
  completionMode: CompletionModeSchema,
  /** Percent, 1 to 100 (video coverage). */
  completionThreshold: z.number().min(1).max(100).optional(),
  isRequired: z.boolean().optional(),
  assets: z.array(AssetUseInputSchema).max(COURSE_LIMITS.assetsPerBlock),
  steps: z.array(StepInputSchema).max(COURSE_LIMITS.stepsPerBlock),
  /**
   * A tree save replaces them, so a client that does not edit them sends back what it loaded; left
   * out (or empty) they are cleared. Only a `video` block may have them.
   */
  videoChapters: z
    .array(
      VideoChapterSchema.extend({
        title: z.string().max(COURSE_LIMITS.chapterTitle),
      }),
    )
    .max(COURSE_LIMITS.videoChapters)
    .optional(),
  transcript: z
    .array(
      TranscriptLineSchema.extend({
        text: z.string().max(COURSE_LIMITS.transcriptText),
      }),
    )
    .max(COURSE_LIMITS.transcriptLines)
    .optional(),
  /** Only a `video` block may set it; left out it is off. */
  allowSeeking: z.boolean().optional(),
});
export type BlockInput = z.infer<typeof BlockInputSchema>;

export const LessonInputSchema = z.object({
  title: z.string().max(COURSE_LIMITS.title),
  lessonType: LessonTypeSchema,
  estimatedDurationSeconds: z.number().min(0).max(COURSE_LIMITS.lessonSeconds),
  isRequired: z.boolean().optional(),
  /** Only for a `quiz` lesson; a draft may leave it empty, publishing needs it. */
  quizId: z.number().int().positive().nullish(),
  scormPackageId: z.number().int().positive().nullish(),
  scormCompletionRule: ScormCompletionRuleSchema.nullish(),
  blocks: z.array(BlockInputSchema).max(COURSE_LIMITS.items),
});
export type LessonInput = z.infer<typeof LessonInputSchema>;

export const ChapterInputSchema = z.object({
  title: z.string().max(COURSE_LIMITS.title),
  lessons: z.array(LessonInputSchema).max(COURSE_LIMITS.items),
});
export type ChapterInput = z.infer<typeof ChapterInputSchema>;

/**
 * Replaces the whole draft tree (`DraftRequest`). `expectedVersion` is the draft revision's
 * `rowVersion`; read the tree again after a save, since its ids change.
 */
export const SaveDraftCommandSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  programId: z.number().int().positive().optional(),
  moduleId: z.number().int().positive().optional(),
  title: z.string().max(COURSE_LIMITS.title).optional(),
  summary: z.string().max(COURSE_LIMITS.summary).optional(),
  level: CourseLevelSchema.optional(),
  defaultRequirement: RequirementSchema,
  coverAssetId: z.number().int().positive().optional(),
  coverIcon: z.string().max(COURSE_LIMITS.coverIcon).optional(),
  coverColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  objectives: z
    .array(z.string().max(COURSE_LIMITS.objective))
    .max(COURSE_LIMITS.items),
  chapters: z.array(ChapterInputSchema).max(COURSE_LIMITS.items),
  rewardPoints: z
    .number()
    .int()
    .min(0)
    .max(COURSE_LIMITS.rewardPoints)
    .optional(),
  /** The course's `FINAL_EXAM` quiz that completion requires. Left out, the save clears it. */
  finalQuizId: z.number().int().positive().optional(),
});
export type SaveDraftCommand = z.infer<typeof SaveDraftCommandSchema>;

/**
 * Creates the course and its first draft. Without `draft` the draft is empty; with it the whole
 * tree is written in the same call, so a course is never left half made.
 */
export const CreateCourseCommandSchema = z.object({
  ownerOrgId: z.number().int().positive(),
  ownerTeamId: z.number().int().positive().optional(),
  code: z.string().max(COURSE_LIMITS.code),
  title: z.string().max(COURSE_LIMITS.title).optional(),
  draft: SaveDraftCommandSchema.omit({ expectedVersion: true }).optional(),
});
export type CreateCourseCommand = z.infer<typeof CreateCourseCommandSchema>;

/** A command that only carries the target's `rowVersion` (publish). */
export const VersionCommandSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});
export type VersionCommand = z.infer<typeof VersionCommandSchema>;

/** `expectedVersion` is the course's `rowVersion`. Learning history is kept. */
export const ChangeCourseStateCommandSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  status: CourseLifecycleSchema,
});
export type ChangeCourseStateCommand = z.infer<
  typeof ChangeCourseStateCommandSchema
>;

/** A new course with a new code; learners, assignments and shares are not copied. */
export const CopyCourseCommandSchema = z.object({
  code: z.string().max(COURSE_LIMITS.code),
});
export type CopyCourseCommand = z.infer<typeof CopyCourseCommandSchema>;

/**
 * Shares (or, with `active: false`, revokes) use rights; content editing is never shared. Every
 * field is sent each time: the server saves the row as sent and has no defaults.
 */
export const ShareCourseCommandSchema = z.object({
  orgId: z.number().int().positive(),
  includeDescendants: z.boolean(),
  canAssign: z.boolean(),
  canSelfEnroll: z.boolean(),
  active: z.boolean(),
});
export type ShareCourseCommand = z.infer<typeof ShareCourseCommandSchema>;

/** A learner sends both ids of their own enrolment; an author sends neither. */
export const AssetContentQuerySchema = z.object({
  blockId: z.number().int().positive().optional(),
  enrollmentId: z.number().int().positive().optional(),
});
export type AssetContentQuery = z.infer<typeof AssetContentQuerySchema>;
