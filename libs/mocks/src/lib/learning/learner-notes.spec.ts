import {
  authV1Endpoints,
  learnerEndpoints,
  personalEndpoints as e,
  SavedPageSchema,
  type AnyEndpoint,
  type LessonBookmarkView,
  type LessonNoteView,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';

describe('the lesson notes and bookmarks of the mock backend', () => {
  let backend: FakeBackend;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T09:00:00Z'));
    backend = new FakeBackend();
  });
  afterEach(() => vi.useRealTimers());

  const call = (
    endpoint: AnyEndpoint,
    token: string,
    request: {
      params?: Record<string, string>;
      query?: Record<string, string>;
      body?: unknown;
    } = {},
  ): FakeReply =>
    backend.handle(endpoint, {
      token,
      params: request.params ?? {},
      query: request.query ?? {},
      body: request.body,
    }) as FakeReply;

  const login = (username: string): string =>
    (
      backend.handle(authV1Endpoints.login, {
        token: null,
        params: {},
        query: {},
        body: { username, password: SEED_PASSWORD },
      })?.body.data as { accessToken: string }
    ).accessToken;

  /** The first lesson of course 1 holding a block of the type: its ids, as `hocvien` can see them. */
  const spot = (token: string, type: 'pdf' | 'video', courseId = '1') => {
    const card = call(learnerEndpoints.course, token, {
      params: { courseId },
    }).body.data as {
      card: { enrollmentId: number };
      content: {
        chapters: {
          lessons: {
            lesson: { id: number };
            blocks: { block: { id: number; blockType: string } }[];
          }[];
        }[];
      };
    };
    for (const chapter of card.content.chapters) {
      for (const { lesson, blocks } of chapter.lessons) {
        const block = blocks.find((b) => b.block.blockType === type);
        if (block) return { lessonId: lesson.id, blockId: block.block.id };
      }
    }
    throw new Error(`no ${type} block`);
  };

  const params = (lessonId: number) => ({ lessonId: String(lessonId) });
  const error = (reply: FakeReply) => reply.body.messageCode;

  it('seeds a PDF note, a video note and a PDF bookmark for the seed learner', () => {
    const token = login('hocvien');
    const saved = SavedPageSchema.parse(call(e.saved, token).body.data);
    expect(saved.counts).toEqual({ notes: 2, bookmarks: 1 });
    expect(saved.page.items.map((i) => [i.kind, i.anchor.type])).toEqual([
      ['note', 'video'],
      ['note', 'pdf'],
    ]);
    expect(saved.page.items[0].courseTitle).not.toBe('');
    const bookmarks = SavedPageSchema.parse(
      call(e.saved, token, { query: { kind: 'bookmarks' } }).body.data,
    );
    expect(bookmarks.page.items[0]).toMatchObject({
      kind: 'bookmark',
      text: null,
      label: expect.stringContaining('trang 2'),
    });
  });

  it('adds a note at a PDF page and lists it first', () => {
    const token = login('hocvien');
    const { lessonId, blockId } = spot(token, 'pdf');
    const added = call(e.addNote, token, {
      params: params(lessonId),
      body: { anchor: { type: 'pdf', blockId, page: 3 }, text: '  Ghi chú  ' },
    });
    expect(added.body.data).toMatchObject({
      lessonId,
      anchor: { type: 'pdf', blockId, page: 3, second: null },
      text: 'Ghi chú',
    });
    const listed = call(e.lessonNotes, token, { params: params(lessonId) }).body
      .data as LessonNoteView[];
    expect(listed[0].text).toBe('Ghi chú');
    expect(listed).toHaveLength(2);
  });

  it('refuses an anchor outside the file, of the wrong type or on a missing block', () => {
    const token = login('hocvien');
    const pdf = spot(token, 'pdf');
    const video = spot(token, 'video');
    const add = (lessonId: number, anchor: unknown) =>
      error(
        call(e.addNote, token, {
          params: params(lessonId),
          body: { anchor, text: 'x' },
        }),
      );
    expect(
      add(pdf.lessonId, { type: 'pdf', blockId: pdf.blockId, page: 13 }),
    ).toBe('LEARNING-INVALID_REFERENCE');
    expect(
      add(pdf.lessonId, { type: 'video', blockId: pdf.blockId, second: 1 }),
    ).toBe('LEARNING-INVALID_REFERENCE');
    expect(
      add(video.lessonId, {
        type: 'video',
        blockId: video.blockId,
        second: 601,
      }),
    ).toBe('LEARNING-INVALID_REFERENCE');
    expect(
      add(pdf.lessonId, { type: 'pdf', blockId: video.blockId, page: 1 }),
    ).toBe('LEARNING-INVALID_REFERENCE');
    expect(
      add(video.lessonId, {
        type: 'video',
        blockId: video.blockId,
        second: 600,
      }),
    ).toBe('CORE-SUCCESS');
  });

  it('refuses a blank note and a lesson the caller cannot see', () => {
    const token = login('hocvien');
    const { lessonId } = spot(token, 'pdf');
    expect(
      error(
        call(e.addNote, token, {
          params: params(lessonId),
          body: { anchor: { type: 'none' }, text: '  ' },
        }),
      ),
    ).toBe('CORE-VALIDATION_FAILED');
    expect(error(call(e.lessonNotes, token, { params: params(999_999) }))).toBe(
      'LEARNING-NOT_FOUND',
    );
    // `hocvien.tichhop` is not enrolled in course 5.
    expect(
      error(
        call(e.lessonNotes, login('hocvien.tichhop'), {
          params: params(spot(token, 'pdf', '5').lessonId),
        }),
      ),
    ).toBe('LEARNING-NOT_FOUND');
  });

  it('turns a bookmark on, names it, and turns it off at the same spot', () => {
    const token = login('hocvien');
    const { lessonId, blockId } = spot(token, 'video');
    const body = { anchor: { type: 'video', blockId, second: 75 } };
    const on = call(e.toggleBookmark, token, { params: params(lessonId), body })
      .body.data as {
      saved: boolean;
      bookmark: LessonBookmarkView;
    };
    expect(on.saved).toBe(true);
    expect(on.bookmark.label).toMatch(/ — 1:15$/);
    expect(
      call(e.lessonBookmarks, token, { params: params(lessonId) }).body.data,
    ).toHaveLength(1);
    expect(
      call(e.toggleBookmark, token, { params: params(lessonId), body }).body
        .data,
    ).toEqual({
      saved: false,
      bookmark: null,
    });
    expect(
      call(e.lessonBookmarks, token, { params: params(lessonId) }).body.data,
    ).toEqual([]);
    expect(
      error(
        call(e.toggleBookmark, token, {
          params: params(lessonId),
          body: { anchor: { type: 'none' } },
        }),
      ),
    ).toBe('CORE-VALIDATION_FAILED');
  });

  it("deletes only the caller's own rows, once", () => {
    const token = login('hocvien');
    const saved = SavedPageSchema.parse(call(e.saved, token).body.data);
    const note = saved.page.items[0];
    expect(
      error(
        call(e.deleteNote, login('hocvien.tichhop'), {
          params: { noteId: String(note.id) },
        }),
      ),
    ).toBe('LEARNING-NOT_FOUND');
    expect(
      call(e.deleteNote, token, { params: { noteId: String(note.id) } }).body
        .data,
    ).toBeNull();
    expect(
      error(call(e.deleteNote, token, { params: { noteId: String(note.id) } })),
    ).toBe('LEARNING-NOT_FOUND');
    expect(
      SavedPageSchema.parse(call(e.saved, token).body.data).counts.notes,
    ).toBe(1);
    const bookmark = SavedPageSchema.parse(
      call(e.saved, token, { query: { kind: 'bookmarks' } }).body.data,
    ).page.items[0];
    expect(
      call(e.deleteBookmark, token, {
        params: { bookmarkId: String(bookmark.id) },
      }).body.data,
    ).toBeNull();
    expect(
      SavedPageSchema.parse(call(e.saved, token).body.data).counts.bookmarks,
    ).toBe(0);
  });

  it('pages the saved list and refuses a size over 100', () => {
    const token = login('hocvien');
    const page = SavedPageSchema.parse(
      call(e.saved, token, { query: { size: '1' } }).body.data,
    );
    expect(page.page).toMatchObject({
      size: 1,
      totalElements: 2,
      totalPages: 2,
    });
    expect(page.page.items).toHaveLength(1);
    expect(error(call(e.saved, token, { query: { size: '101' } }))).toBe(
      'CORE-VALIDATION_FAILED',
    );
  });

  it('stops at 500 notes on one lesson', () => {
    const token = login('hocvien');
    const { lessonId } = spot(token, 'pdf');
    const add = () =>
      call(e.addNote, token, {
        params: params(lessonId),
        body: { anchor: { type: 'none' }, text: 'n' },
      });
    // The seed already holds one note on this lesson.
    for (let i = 0; i < 499; i += 1) expect(error(add())).toBe('CORE-SUCCESS');
    expect(error(add())).toBe('LEARNING-NOTE_LIMIT');
  });
});
