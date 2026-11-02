import {
  AddNoteCommandSchema,
  BookmarkCommandSchema,
  SavedQuerySchema,
  type Anchor,
  type BookmarkToggle,
  type LessonBookmarkView,
  type LessonNoteView,
  type SavedItemView,
  type SavedPage,
} from '@lms/contracts';
import type { FakeRequest } from '../backend/fake-backend';
import type { LearnerEnrollments } from './learner-enrollments';
import { locateLesson, resolveAnchor, sameAnchor } from './lesson-anchors';
import { refuse } from './learning-reply';
import type { LessonNoteSeeds } from './learning.fixtures';

/** The most notes, and the most bookmarks, a learner keeps on one lesson. */
export const MAX_PER_LESSON = 500;

interface Row {
  readonly id: number;
  readonly userId: string;
  readonly lessonId: number;
  readonly anchor: Anchor;
  /** The note's text, or the bookmark's label. */
  readonly text: string;
  readonly createTime: string;
}

const numeric = (value: string | undefined): number | undefined =>
  value === undefined || value === '' ? undefined : Number(value);

const clock = (second: number) =>
  `${Math.floor(second / 60)}:${String(second % 60).padStart(2, '0')}`;

const newestFirst = (a: Row, b: Row) =>
  b.createTime.localeCompare(a.createTime) || b.id - a.id;

/**
 * The learner's notes and bookmarks in memory. What the mock does is what the backend checks: the
 * lesson belongs to a course the caller is enrolled in (and has not left), the anchor points at a
 * real page or second of the block's ready file, a bookmark is one per spot and the server names
 * it. Reads and writes are the caller's own; another learner's id answers "not found".
 */
export class LearnerNotes {
  private notes: Row[] = [];
  private bookmarks: Row[] = [];
  private nextId = 1;
  private clock = Date.now();

  constructor(
    private readonly enrollments: LearnerEnrollments,
    private readonly callerId: (request: FakeRequest) => string,
    seeds: LessonNoteSeeds,
  ) {
    this.seed(seeds);
  }

  /** `GET /lessons/{lessonId}/notes` */
  notesOf(request: FakeRequest): LessonNoteView[] {
    const { userId, lessonId } = this.lessonOf(request);
    return this.notes
      .filter((r) => r.userId === userId && r.lessonId === lessonId)
      .sort(newestFirst)
      .map(this.noteView);
  }

  /** `POST /lessons/{lessonId}/notes` */
  addNote(request: FakeRequest): LessonNoteView {
    const { userId, lessonId, located } = this.lessonOf(request);
    const parsed = AddNoteCommandSchema.safeParse(request.body);
    if (!parsed.success) return refuse('validationFailed');
    const anchor = resolveAnchor(located.lesson, parsed.data.anchor);
    const mine = this.notes.filter(
      (r) => r.userId === userId && r.lessonId === lessonId,
    );
    if (mine.length >= MAX_PER_LESSON) return refuse('noteLimit');
    const row = this.add(
      this.notes,
      userId,
      lessonId,
      anchor,
      parsed.data.text,
    );
    return this.noteView(row);
  }

  /** `DELETE /notes/{noteId}` */
  deleteNote(request: FakeRequest): null {
    this.remove(this.notes, this.callerId(request), request.params['noteId']);
    return null;
  }

  /** `GET /lessons/{lessonId}/bookmarks` */
  bookmarksOf(request: FakeRequest): LessonBookmarkView[] {
    const { userId, lessonId } = this.lessonOf(request);
    return this.bookmarks
      .filter((r) => r.userId === userId && r.lessonId === lessonId)
      .sort(newestFirst)
      .map(this.bookmarkView);
  }

  /** `PUT /lessons/{lessonId}/bookmarks`: off when the spot is already marked, on otherwise. */
  toggleBookmark(request: FakeRequest): BookmarkToggle {
    const { userId, lessonId, located } = this.lessonOf(request);
    const parsed = BookmarkCommandSchema.safeParse(request.body);
    if (!parsed.success) return refuse('validationFailed');
    const anchor = resolveAnchor(located.lesson, parsed.data.anchor);
    const existing = this.bookmarks.find(
      (r) =>
        r.userId === userId &&
        r.lessonId === lessonId &&
        sameAnchor(r.anchor, anchor),
    );
    if (existing) {
      this.bookmarks = this.bookmarks.filter((r) => r !== existing);
      return { saved: false, bookmark: null };
    }
    const mine = this.bookmarks.filter(
      (r) => r.userId === userId && r.lessonId === lessonId,
    );
    if (mine.length >= MAX_PER_LESSON) return refuse('noteLimit');
    const block = located.lesson.blocks.find(
      (b) => b.block.id === anchor.blockId,
    );
    const spot =
      anchor.type === 'pdf'
        ? `trang ${anchor.page}`
        : clock(anchor.second ?? 0);
    const row = this.add(
      this.bookmarks,
      userId,
      lessonId,
      anchor,
      `${block?.block.title ?? ''} — ${spot}`,
    );
    return { saved: true, bookmark: this.bookmarkView(row) };
  }

  /** `DELETE /bookmarks/{bookmarkId}` */
  deleteBookmark(request: FakeRequest): null {
    this.remove(
      this.bookmarks,
      this.callerId(request),
      request.params['bookmarkId'],
    );
    return null;
  }

  /** `GET /saved`: one tab's rows, newest first, and both counts. */
  saved(request: FakeRequest): SavedPage {
    const userId = this.callerId(request);
    const parsed = SavedQuerySchema.safeParse({
      kind: request.query['kind'],
      page: numeric(request.query['page']),
      size: numeric(request.query['size']),
    });
    if (!parsed.success) return refuse('validationFailed');
    const { kind = 'notes', page = 0, size = 20 } = parsed.data;
    const rows = (kind === 'notes' ? this.notes : this.bookmarks)
      .filter((r) => r.userId === userId)
      .sort(newestFirst);
    const items = rows.flatMap((row): SavedItemView[] => {
      const located = locateLesson(this.enrollments, userId, row.lessonId);
      return located
        ? [
            {
              kind: kind === 'notes' ? 'note' : 'bookmark',
              id: row.id,
              lessonId: row.lessonId,
              anchor: row.anchor,
              text: kind === 'notes' ? row.text : null,
              label: kind === 'notes' ? null : row.text,
              createTime: row.createTime,
              courseId: located.courseId,
              courseTitle: located.courseTitle,
              lessonTitle: located.lesson.lesson.title,
            },
          ]
        : [];
    });
    const count = (list: readonly Row[]) =>
      list.filter(
        (r) =>
          r.userId === userId &&
          locateLesson(this.enrollments, userId, r.lessonId),
      ).length;
    return {
      page: {
        items: items.slice(page * size, page * size + size),
        page,
        size,
        totalElements: items.length,
        totalPages: Math.ceil(items.length / size),
      },
      counts: { notes: count(this.notes), bookmarks: count(this.bookmarks) },
    };
  }

  private noteView = (row: Row): LessonNoteView => ({
    id: row.id,
    lessonId: row.lessonId,
    anchor: row.anchor,
    text: row.text,
    createTime: row.createTime,
  });

  private bookmarkView = (row: Row): LessonBookmarkView => ({
    id: row.id,
    lessonId: row.lessonId,
    anchor: row.anchor,
    label: row.text,
    createTime: row.createTime,
  });

  private add(
    list: Row[],
    userId: string,
    lessonId: number,
    anchor: Anchor,
    text: string,
  ): Row {
    // Each row is a second after the last, so "newest first" is stable even within one test.
    this.clock = Math.max(this.clock + 1000, Date.now());
    const row: Row = {
      id: this.nextId++,
      userId,
      lessonId,
      anchor,
      text,
      createTime: new Date(this.clock).toISOString(),
    };
    list.push(row);
    return row;
  }

  private remove(list: Row[], userId: string, id: string | undefined): void {
    const index = list.findIndex(
      (r) => r.id === Number(id) && r.userId === userId,
    );
    if (index < 0) return refuse('learningNotFound');
    list.splice(index, 1);
  }

  private lessonOf(request: FakeRequest) {
    const userId = this.callerId(request);
    const lessonId = Number(request.params['lessonId']);
    const located = locateLesson(this.enrollments, userId, lessonId);
    if (!located) return refuse('learningNotFound');
    return { userId, lessonId, located };
  }

  /** The seed learner's notes and bookmark, anchored on the first PDF and video of their course. */
  private seed(seeds: LessonNoteSeeds): void {
    const record = this.enrollments.of(seeds.userId, seeds.courseId);
    if (!record) return;
    this.clock = Date.now() - 3 * 86_400_000;
    const spots = record.content.chapters
      .flatMap((c) => c.lessons)
      .flatMap((lesson) =>
        lesson.blocks.map((b) => ({ lesson, block: b.block })),
      );
    const find = (type: 'pdf' | 'video') =>
      spots.find((s) => s.block.blockType === type);
    for (const seed of seeds.rows) {
      const spot = find(seed.type);
      if (!spot) continue;
      const anchor: Anchor =
        seed.type === 'pdf'
          ? { type: 'pdf', blockId: spot.block.id, page: seed.at, second: null }
          : {
              type: 'video',
              blockId: spot.block.id,
              page: null,
              second: seed.at,
            };
      const lessonId = spot.lesson.lesson.id;
      if (seed.kind === 'note') {
        this.add(this.notes, seeds.userId, lessonId, anchor, seed.text);
      } else {
        const spotLabel =
          seed.type === 'pdf' ? `trang ${seed.at}` : clock(seed.at);
        this.add(
          this.bookmarks,
          seeds.userId,
          lessonId,
          anchor,
          `${spot.block.title} — ${spotLabel}`,
        );
      }
    }
  }
}
