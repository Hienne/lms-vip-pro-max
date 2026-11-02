import { z } from 'zod';
import { PageSchema } from '../http/page';

/** Where a note or bookmark sits in a lesson: a PDF page, a whole video second, or the lesson itself. */
export const AnchorTypeSchema = z.enum(['none', 'pdf', 'video']);

/** An anchor as the server sends it: the fields that do not apply to its type are `null`. */
export const AnchorSchema = z.object({
  type: AnchorTypeSchema,
  blockId: z.number().int().nullable(),
  page: z.number().int().nullable(),
  second: z.number().int().nullable(),
});

/** An anchor as the learner sends it; the server checks it against the lesson's real file. */
export const AnchorCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({
    type: z.literal('pdf'),
    blockId: z.number().int(),
    page: z.number().int().min(1),
  }),
  z.object({
    type: z.literal('video'),
    blockId: z.number().int(),
    second: z.number().int().min(0),
  }),
]);

/** A bookmark can only point into a file. */
export const BookmarkAnchorCommandSchema = z.discriminatedUnion('type', [
  AnchorCommandSchema.options[1],
  AnchorCommandSchema.options[2],
]);

/** The longest note the server accepts, after trimming. */
export const NOTE_MAX_LENGTH = 4000;

export const LessonNoteViewSchema = z.object({
  id: z.number().int(),
  lessonId: z.number().int(),
  anchor: AnchorSchema,
  text: z.string(),
  createTime: z.iso.datetime({ offset: true }),
});

/** The server writes the label ("{block} — trang n" or "{block} — m:ss"); the app only shows it. */
export const LessonBookmarkViewSchema = z.object({
  id: z.number().int(),
  lessonId: z.number().int(),
  anchor: AnchorSchema,
  label: z.string().nullable(),
  createTime: z.iso.datetime({ offset: true }),
});

/** One call turns a bookmark on or off: `saved` says which, `bookmark` is the new one when on. */
export const BookmarkToggleSchema = z.object({
  saved: z.boolean(),
  bookmark: LessonBookmarkViewSchema.nullable(),
});

export const SavedKindSchema = z.enum(['note', 'bookmark']);
export const SavedQueryKindSchema = z.enum(['notes', 'bookmarks']);

/** A row of the "Đã lưu" page: a note has `text`, a bookmark has `label`. */
export const SavedItemViewSchema = z.object({
  kind: SavedKindSchema,
  id: z.number().int(),
  lessonId: z.number().int(),
  anchor: AnchorSchema,
  text: z.string().nullable(),
  label: z.string().nullable(),
  createTime: z.iso.datetime({ offset: true }),
  courseId: z.number().int(),
  courseTitle: z.string(),
  lessonTitle: z.string(),
});

export const SavedPageSchema = z.object({
  page: PageSchema(SavedItemViewSchema),
  counts: z.object({
    notes: z.number().int().nonnegative(),
    bookmarks: z.number().int().nonnegative(),
  }),
});

export const SavedQuerySchema = z.object({
  kind: SavedQueryKindSchema.optional(),
  page: z.number().int().nonnegative().optional(),
  size: z.number().int().min(1).max(100).optional(),
});

export const AddNoteCommandSchema = z.object({
  anchor: AnchorCommandSchema,
  text: z.string().trim().min(1).max(NOTE_MAX_LENGTH),
});

export const BookmarkCommandSchema = z.object({
  anchor: BookmarkAnchorCommandSchema,
});

export type Anchor = z.infer<typeof AnchorSchema>;
export type AnchorCommand = z.infer<typeof AnchorCommandSchema>;
export type LessonNoteView = z.infer<typeof LessonNoteViewSchema>;
export type LessonBookmarkView = z.infer<typeof LessonBookmarkViewSchema>;
export type BookmarkToggle = z.infer<typeof BookmarkToggleSchema>;
export type SavedItemView = z.infer<typeof SavedItemViewSchema>;
export type SavedPage = z.infer<typeof SavedPageSchema>;
export type AddNoteCommand = z.infer<typeof AddNoteCommandSchema>;
export type BookmarkCommand = z.infer<typeof BookmarkCommandSchema>;
