import { z } from 'zod';
import { PageSchema } from '../http/page';

export const AnchorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pdf'), page: z.number().int().min(1) }),
  z.object({ type: z.literal('video'), seconds: z.number().nonnegative() }),
]);
export const SavedItemSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  courseTitle: z.string(),
  lessonId: z.string(),
  lessonTitle: z.string(),
  anchor: AnchorSchema,
  label: z.string().nullable(),
  text: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export const SavedPageSchema = PageSchema(SavedItemSchema).extend({
  counts: z.object({
    notes: z.number().int().nonnegative(),
    bookmarks: z.number().int().nonnegative(),
  }),
});
export const AddNoteCommandSchema = z.object({
  lessonId: z.string().min(1),
  anchor: AnchorSchema,
  text: z.string().trim().min(1).max(4000),
});
export const BookmarkCommandSchema = z.object({
  lessonId: z.string().min(1),
  anchor: AnchorSchema,
  label: z.string().max(200).nullable(),
});
export const CertificateSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  courseCode: z.string(),
  courseTitle: z.string(),
  userName: z.string(),
  completedAt: z.iso.datetime({ offset: true }),
  score: z.number().min(0).max(100).nullable(),
  verificationCode: z.string(),
  issuedAt: z.iso.datetime({ offset: true }),
  fileName: z.string(),
});
export const AchievementsSchema = z.object({
  points: z.object({
    total: z.number(),
    parts: z.object({
      lessons: z.number(),
      quizzes: z.number(),
      courses: z.number(),
      streak: z.number(),
    }),
  }),
  streak: z.number(),
  badges: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      earned: z.boolean(),
      earnedAt: z.iso.datetime({ offset: true }).nullable(),
      progress: z
        .object({
          current: z.number(),
          target: z.number().positive(),
          unit: z.enum(['course', 'day', 'quiz']),
        })
        .nullable(),
    }),
  ),
  recentEvents: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['lesson', 'quiz', 'course', 'badge']),
      label: z.string(),
      at: z.iso.datetime({ offset: true }),
      points: z.number(),
    }),
  ),
});
export const NotificationKindSchema = z.enum([
  'due',
  'assigned',
  'result',
  'certificate',
  'badge',
  'other',
]);
export const NotificationSchema = z.object({
  id: z.string(),
  kind: NotificationKindSchema,
  text: z.string(),
  target: z
    .discriminatedUnion('type', [
      z.object({ type: z.literal('course'), id: z.string() }),
      z.object({
        type: z.literal('quizResult'),
        id: z.string(),
        quizId: z.string(),
      }),
      z.object({ type: z.literal('certificate'), id: z.string() }),
      z.object({ type: z.literal('progress'), id: z.string() }),
    ])
    .nullable(),
  at: z.iso.datetime({ offset: true }),
  readAt: z.iso.datetime({ offset: true }).nullable(),
  dueAt: z.iso.datetime({ offset: true }).nullable(),
});
export type SavedItem = z.infer<typeof SavedItemSchema>;
export type Anchor = z.infer<typeof AnchorSchema>;
export type AddNoteCommand = z.infer<typeof AddNoteCommandSchema>;
export type BookmarkCommand = z.infer<typeof BookmarkCommandSchema>;
export type Certificate = z.infer<typeof CertificateSchema>;
export type Achievements = z.infer<typeof AchievementsSchema>;
export type PersonalNotification = z.infer<typeof NotificationSchema>;
