import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import {
  AddNoteCommandSchema,
  BookmarkCommandSchema,
  BookmarkToggleSchema,
  LessonBookmarkViewSchema,
  LessonNoteViewSchema,
  SavedPageSchema,
  SavedQuerySchema,
} from './personal.schema';
const lessonParams = z.object({ lessonId: z.number().int() });
const LEARNING = '/api/v1/me/learning';
export const personalEndpoints = {
  /** The caller's notes on one lesson, newest first. */
  lessonNotes: defineEndpoint({
    method: 'get',
    path: `${LEARNING}/lessons/{lessonId}/notes`,
    params: lessonParams,
    response: z.array(LessonNoteViewSchema),
  }),
  /** Add a private note on a lesson, anchored to a PDF page, a video second or the whole lesson. */
  addNote: defineEndpoint({
    method: 'post',
    path: `${LEARNING}/lessons/{lessonId}/notes`,
    params: lessonParams,
    body: AddNoteCommandSchema,
    response: LessonNoteViewSchema,
  }),
  /** Delete the caller's note; the answer carries no data. */
  deleteNote: defineEndpoint({
    method: 'delete',
    path: `${LEARNING}/notes/{noteId}`,
    params: z.object({ noteId: z.number().int() }),
    response: z.null(),
  }),
  /** The caller's bookmarks on one lesson, newest first. */
  lessonBookmarks: defineEndpoint({
    method: 'get',
    path: `${LEARNING}/lessons/{lessonId}/bookmarks`,
    params: lessonParams,
    response: z.array(LessonBookmarkViewSchema),
  }),
  /** Turn the bookmark at an anchor on, or off when it is already on. */
  toggleBookmark: defineEndpoint({
    method: 'put',
    path: `${LEARNING}/lessons/{lessonId}/bookmarks`,
    params: lessonParams,
    body: BookmarkCommandSchema,
    response: BookmarkToggleSchema,
  }),
  /** Remove the caller's bookmark; the answer carries no data. */
  deleteBookmark: defineEndpoint({
    method: 'delete',
    path: `${LEARNING}/bookmarks/{bookmarkId}`,
    params: z.object({ bookmarkId: z.number().int() }),
    response: z.null(),
  }),
  /** The "Đã lưu" page: one tab's rows (`kind`, notes by default) plus both counts. */
  saved: defineEndpoint({
    method: 'get',
    path: `${LEARNING}/saved`,
    query: SavedQuerySchema,
    response: SavedPageSchema,
  }),
} as const;
