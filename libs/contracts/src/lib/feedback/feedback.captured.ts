/**
 * Lesson feedback answers written from the backend's views (`LearningFeedbackViews`) and the values
 * Checkpoint A recorded on the local stack (2026-11-02: lesson 1, `hocvien` rated 5 and `hocvien.tichhop`
 * rated 3, so 4.0 over 2). They are NOT yet copies of the live wire bytes: recapture them from the
 * local stack (`docs/conventions/workspace.md`, "Run against a local backend") and replace these
 * when a signed-in session is at hand.
 *
 * `lessonFeedback` is what `hocvien` sees. `lessonFeedbackOther` is what `hocvien.tichhop` sees on
 * the same lesson: the same comment with `mine: false`, and none of `hocvien`'s questions or reports.
 */
export const capturedFeedback = {
  lessonFeedback: {
    rating: { average: 4.0, count: 2 },
    myStars: 5,
    comments: {
      items: [
        {
          id: 6,
          authorName: 'Học viên tiền gửi Demo',
          text: 'Trang ba rất rõ',
          anchor: { type: 'pdf', blockId: 32, page: 3, second: null },
          createTime: '2026-11-02T04:31:08.402113Z',
          mine: true,
        },
        {
          id: 3,
          authorName: 'Học viên tiền gửi Demo',
          text: 'Nhận xét cả bài',
          anchor: { type: 'none', blockId: null, page: null, second: null },
          createTime: '2026-11-02T04:12:44.118902Z',
          mine: true,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 2,
      totalPages: 1,
    },
    mine: [
      {
        id: 7,
        kind: 'question',
        text: 'Đoạn này giải thích gì?',
        anchor: { type: 'video', blockId: 33, page: null, second: 12 },
        status: 'new',
        reply: null,
        replyTime: null,
        createTime: '2026-11-02T04:35:19.776204Z',
      },
      {
        id: 5,
        kind: 'report',
        text: 'Sai thông tin ở trang 2',
        anchor: { type: 'pdf', blockId: 32, page: 2, second: null },
        status: 'new',
        reply: null,
        replyTime: null,
        createTime: '2026-11-02T04:20:02.350871Z',
      },
    ],
  },
  lessonFeedbackOther: {
    rating: { average: 4.0, count: 2 },
    myStars: 3,
    comments: {
      items: [
        {
          id: 6,
          authorName: 'Học viên tiền gửi Demo',
          text: 'Trang ba rất rõ',
          anchor: { type: 'pdf', blockId: 32, page: 3, second: null },
          createTime: '2026-11-02T04:31:08.402113Z',
          mine: false,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    },
    mine: [],
  },
  /** A lesson nobody has touched yet: `rating` and `myStars` are null, the lists are empty. */
  lessonFeedbackEmpty: {
    rating: null,
    myStars: null,
    comments: { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
    mine: [],
  },
  rateLesson: { average: 4.0, count: 2, myStars: 5 },
  sendComment: {
    id: 6,
    kind: 'comment',
    text: 'Trang ba rất rõ',
    anchor: { type: 'pdf', blockId: 32, page: 3, second: null },
    status: null,
    reply: null,
    replyTime: null,
    createTime: '2026-11-02T04:31:08.402113Z',
  },
  sendQuestion: {
    id: 7,
    kind: 'question',
    text: 'Đoạn này giải thích gì?',
    anchor: { type: 'video', blockId: 33, page: null, second: 12 },
    status: 'new',
    reply: null,
    replyTime: null,
    createTime: '2026-11-02T04:35:19.776204Z',
  },
  lessonComments: {
    items: [
      {
        id: 3,
        authorName: 'Học viên tiền gửi Demo',
        text: 'Nhận xét cả bài',
        anchor: { type: 'none', blockId: null, page: null, second: null },
        createTime: '2026-11-02T04:12:44.118902Z',
        mine: true,
      },
    ],
    page: 1,
    size: 1,
    totalElements: 2,
    totalPages: 2,
  },
} as const;
