import { z } from 'zod';
import { PageSchema } from '../http/page';
import { AnchorCommandSchema, AnchorSchema } from '../personal/personal.schema';

/** The shortest and the longest comment, question or report the server accepts, after trimming. */
export const FEEDBACK_MIN_LENGTH = 5;
export const FEEDBACK_MAX_LENGTH = 1000;

/** The most comments, questions and reports one learner sends on one lesson per learning day. */
export const FEEDBACK_DAILY_LIMIT = 20;

/** What a learner can send: a rating is its own call. */
export const FeedbackKindSchema = z.enum(['comment', 'question', 'report']);

/** Where a question or a report stands. Only the instructor inbox moves it past `new`. */
export const FeedbackStatusSchema = z.enum(['new', 'answered', 'resolved']);

/** The average of the live ratings, to one decimal, and how many there are. */
export const RatingSummarySchema = z.object({
  average: z.number().min(1).max(5),
  count: z.number().int().positive(),
});

/** The lesson's rating after the caller's own was saved. */
export const LessonRatingResultSchema = z.object({
  average: z.number().min(1).max(5),
  count: z.number().int().positive(),
  myStars: z.number().int().min(1).max(5),
});

/** A public comment. `mine` is true for the caller's own; `authorName` is the author's full name. */
export const LessonCommentViewSchema = z.object({
  id: z.number().int(),
  authorName: z.string(),
  text: z.string(),
  anchor: AnchorSchema,
  createTime: z.iso.datetime({ offset: true }),
  mine: z.boolean(),
});

/** One of the caller's own questions or reports; `status` and `reply` are the instructor's side. */
export const FeedbackViewSchema = z.object({
  id: z.number().int(),
  kind: FeedbackKindSchema,
  text: z.string(),
  anchor: AnchorSchema,
  status: FeedbackStatusSchema.nullable(),
  reply: z.string().nullable(),
  replyTime: z.iso.datetime({ offset: true }).nullable(),
  createTime: z.iso.datetime({ offset: true }),
});

/**
 * Everything the section under a lesson shows: the rating (null until someone rates), the caller's
 * own stars (null until they rate), the first page of every learner's comments, and the caller's own
 * questions and reports. Other learners' questions and reports never appear.
 */
export const LessonFeedbackSchema = z.object({
  rating: RatingSummarySchema.nullable(),
  myStars: z.number().int().min(1).max(5).nullable(),
  comments: PageSchema(LessonCommentViewSchema),
  mine: z.array(FeedbackViewSchema),
});

/**
 * A question or report seen from the instructor's side, on a course they manage: where it was
 * sent (lesson, course) and who sent it. `authorName` is null when the sender can no longer be found.
 */
export const InstructorFeedbackViewSchema = z.object({
  id: z.number().int(),
  kind: z.enum(['question', 'report']),
  text: z.string(),
  anchor: AnchorSchema,
  status: FeedbackStatusSchema,
  reply: z.string().nullable(),
  replyTime: z.iso.datetime({ offset: true }).nullable(),
  createTime: z.iso.datetime({ offset: true }),
  lessonId: z.number().int(),
  lessonTitle: z.string(),
  courseId: z.number().int(),
  courseCode: z.string(),
  courseTitle: z.string(),
  authorName: z.string().nullable(),
});

/** How many questions and reports wait for an answer (`status` is `new`); the bell shows it. */
export const InstructorFeedbackSummarySchema = z.object({
  newCount: z.number().int().nonnegative(),
});

export const InstructorFeedbackQuerySchema = z.object({
  status: FeedbackStatusSchema.optional(),
  page: z.number().int().nonnegative().optional(),
  size: z.number().int().min(1).max(100).optional(),
});

/** The answer, 1 to 1000 characters after trimming; `resolve` closes the item instead of leaving it answered. */
export const ReplyFeedbackCommandSchema = z.object({
  reply: z.string().trim().min(1).max(FEEDBACK_MAX_LENGTH),
  resolve: z.boolean().optional(),
});

export const RateLessonCommandSchema = z.object({
  stars: z.number().int().min(1).max(5),
});

/** The position is sent with every kind; the server checks it against the lesson's real file. */
export const SendFeedbackCommandSchema = z.object({
  kind: FeedbackKindSchema,
  text: z.string().trim().min(FEEDBACK_MIN_LENGTH).max(FEEDBACK_MAX_LENGTH),
  anchor: AnchorCommandSchema,
});

export const LessonCommentsQuerySchema = z.object({
  page: z.number().int().nonnegative().optional(),
  size: z.number().int().min(1).max(100).optional(),
});

export type FeedbackKind = z.infer<typeof FeedbackKindSchema>;
export type FeedbackStatus = z.infer<typeof FeedbackStatusSchema>;
export type RatingSummary = z.infer<typeof RatingSummarySchema>;
export type LessonRatingResult = z.infer<typeof LessonRatingResultSchema>;
export type LessonCommentView = z.infer<typeof LessonCommentViewSchema>;
export type FeedbackView = z.infer<typeof FeedbackViewSchema>;
export type LessonFeedback = z.infer<typeof LessonFeedbackSchema>;
export type InstructorFeedbackView = z.infer<
  typeof InstructorFeedbackViewSchema
>;
export type InstructorFeedbackSummary = z.infer<
  typeof InstructorFeedbackSummarySchema
>;
export type ReplyFeedbackCommand = z.infer<typeof ReplyFeedbackCommandSchema>;
export type RateLessonCommand = z.infer<typeof RateLessonCommandSchema>;
export type SendFeedbackCommand = z.infer<typeof SendFeedbackCommandSchema>;
