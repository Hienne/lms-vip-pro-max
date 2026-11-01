import { Dialog } from '@angular/cdk/dialog';
import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  personalEndpoints,
  type AnchorCommand,
  type BookmarkCommand,
  type LessonNoteView,
} from '@lms/contracts';
import { confirm } from '@lms/ui';
import { filter } from 'rxjs';
import { LearningChanges } from '../../../../core/data-access/learning-changes';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';

/**
 * The learner's notes and bookmarks on one lesson: both lists, and the commands that change them.
 * `lessonId` is `undefined` while the lesson cannot be read, which keeps the lists idle. Call it in a
 * store's field initializer. Every change reloads both lists and tells "Đã lưu & ghi chú" to reload.
 */
export function lessonNotes(lessonId: () => number | undefined) {
  const client = inject(EndpointClient);
  const dialog = inject(Dialog);
  const destroyRef = inject(DestroyRef);
  const changes = inject(LearningChanges);
  const listChanged = invalidation();
  /** Bumped when a note was saved, so the note form can start empty again. */
  const noteAdded = invalidation();

  const notes = serverData(
    (id: number) =>
      client.call(personalEndpoints.lessonNotes, { params: { lessonId: id } }),
    { params: lessonId, reloadOn: listChanged },
  );
  const bookmarks = serverData(
    (id: number) =>
      client.call(personalEndpoints.lessonBookmarks, {
        params: { lessonId: id },
      }),
    { params: lessonId, reloadOn: listChanged },
  );

  const adding = serverMutation(
    (input: {
      readonly lessonId: number;
      readonly anchor: AnchorCommand;
      readonly text: string;
    }) =>
      client.call(personalEndpoints.addNote, {
        params: { lessonId: input.lessonId },
        body: { anchor: input.anchor, text: input.text },
      }),
    {
      errors: 'toast',
      success: () => 'Đã lưu ghi chú',
      invalidates: [listChanged, noteAdded, changes.saved],
    },
  );
  const removing = serverMutation(
    (noteId: number) =>
      client.call(personalEndpoints.deleteNote, { params: { noteId } }),
    {
      errors: 'toast',
      success: () => 'Đã xóa ghi chú',
      invalidates: [listChanged, changes.saved],
    },
  );
  const toggling = serverMutation(
    (input: {
      readonly lessonId: number;
      readonly anchor: BookmarkCommand['anchor'];
    }) =>
      client.call(personalEndpoints.toggleBookmark, {
        params: { lessonId: input.lessonId },
        body: { anchor: input.anchor },
      }),
    {
      errors: 'toast',
      success: (_, result) => (result.saved ? 'Đã đánh dấu' : 'Đã bỏ đánh dấu'),
      invalidates: [listChanged, changes.saved],
    },
  );

  return {
    notes: notes.value,
    bookmarks: bookmarks.value,
    loading: notes.isLoading,
    error: notes.error,
    saving: adding.isPending,
    toggling: toggling.isPending,
    added: noteAdded.version,
    retry: () => {
      notes.reload();
      bookmarks.reload();
    },
    add: (input: {
      readonly lessonId: number;
      readonly anchor: AnchorCommand;
      readonly text: string;
    }) => adding.run(input),
    toggle: (input: {
      readonly lessonId: number;
      readonly anchor: BookmarkCommand['anchor'];
    }) => toggling.run(input),
    /** Asks first: a deleted note cannot come back. */
    remove: (note: LessonNoteView) =>
      confirm(dialog, {
        title: 'Xóa ghi chú?',
        message: 'Ghi chú sẽ bị xóa vĩnh viễn.',
        confirmLabel: 'Xóa',
        tone: 'danger',
      })
        .pipe(filter(Boolean), takeUntilDestroyed(destroyRef))
        .subscribe(() => removing.run(note.id)),
  };
}
