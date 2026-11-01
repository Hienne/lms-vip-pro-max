/**
 * Responses captured from the local backend on 2026-11-01 (signed in as `hocvien`, demo course
 * DEMO-MEDIA: lesson 16 "Bài 1: Tài liệu PDF" with PDF block 32, lesson 17 "Bài 2: Video" with
 * video block 33). They prove the note and bookmark schemas parse what the server really sends.
 * Recapture them from the local stack (`docs/conventions/workspace.md`, "Run against a local
 * backend") when the backend's views change. `savedNotes` and `savedBookmarks` are `GET /saved` and
 * `GET /saved?kind=bookmarks`; `addNote` is a PDF note on page 3; `bookmarkOn` and `bookmarkOff` are
 * two consecutive toggles of the same video second; deletes answer `data: null`.
 */
export const capturedPersonal = {
  lessonNotes: [
    {
      id: 2,
      lessonId: 16,
      anchor: { type: 'none', blockId: null, page: null, second: null },
      text: 'Cả bài',
      createTime: '2026-11-01T14:13:26.196248Z',
    },
  ],
  addNote: {
    id: 4,
    lessonId: 16,
    anchor: { type: 'pdf', blockId: 32, page: 3, second: null },
    text: 'Ghi chú trang 3',
    createTime: '2026-11-01T14:25:31.977017Z',
  },
  deleteNote: null,
  lessonBookmarks: [
    {
      id: 3,
      lessonId: 16,
      anchor: { type: 'pdf', blockId: 32, page: 2, second: null },
      label: 'Tài liệu Core Banking — trang 2',
      createTime: '2026-11-01T14:13:26.383593Z',
    },
  ],
  bookmarkOn: {
    saved: true,
    bookmark: {
      id: 4,
      lessonId: 17,
      anchor: { type: 'video', blockId: 33, page: null, second: 20 },
      label: 'Video giới thiệu — 0:20',
      createTime: '2026-11-01T14:25:32.008648Z',
    },
  },
  bookmarkOff: { saved: false, bookmark: null },
  deleteBookmark: null,
  savedNotes: {
    page: {
      items: [
        {
          kind: 'note',
          id: 3,
          lessonId: 17,
          anchor: { type: 'video', blockId: 33, page: null, second: 12 },
          text: 'Mốc 0:12',
          label: null,
          createTime: '2026-11-01T14:13:26.224852Z',
          courseId: 7,
          courseTitle: 'Demo tài liệu PDF và video',
          lessonTitle: 'Bài 2: Video',
        },
        {
          kind: 'note',
          id: 2,
          lessonId: 16,
          anchor: { type: 'none', blockId: null, page: null, second: null },
          text: 'Cả bài',
          label: null,
          createTime: '2026-11-01T14:13:26.196248Z',
          courseId: 7,
          courseTitle: 'Demo tài liệu PDF và video',
          lessonTitle: 'Bài 1: Tài liệu PDF',
        },
      ],
      page: 0,
      size: 20,
      totalElements: 2,
      totalPages: 1,
    },
    counts: { notes: 2, bookmarks: 1 },
  },
  savedBookmarks: {
    page: {
      items: [
        {
          kind: 'bookmark',
          id: 3,
          lessonId: 16,
          anchor: { type: 'pdf', blockId: 32, page: 2, second: null },
          text: null,
          label: 'Tài liệu Core Banking — trang 2',
          createTime: '2026-11-01T14:13:26.383593Z',
          courseId: 7,
          courseTitle: 'Demo tài liệu PDF và video',
          lessonTitle: 'Bài 1: Tài liệu PDF',
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    },
    counts: { notes: 2, bookmarks: 1 },
  },
} as const;
