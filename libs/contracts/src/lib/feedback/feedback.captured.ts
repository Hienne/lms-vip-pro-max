/**
 * Responses captured from the local backend on 2026-11-02 (signed in as `hocvien`, lesson 1 of
 * course 1, which `hocvien.tichhop` shares; the video comment is on block 33's second 12). They
 * prove the feedback schemas parse what the server really sends: `lessonFeedback` is `GET
 * .../lessons/1/feedback`, `rateLesson` the answer to `PUT .../rating`, `sendComment` a comment sent
 * with a video anchor, `lessonComments` page 0 of `GET .../comments?size=1`, `courseCard` the card
 * of `GET /courses/1` with its `rating`, and `ratingRefusal` the whole envelope of a rating of 0
 * stars. Recapture them from the local stack (`docs/conventions/workspace.md`, "Run against a
 * local backend") when the backend's views change.
 *
 * Three more are NOT captures but the same answers reshaped, so a spec can reach the cases the
 * capture did not: `lessonFeedbackOther` is what `hocvien.tichhop` sees (the comments with `mine:
 * false`, no questions or reports, its own stars), `lessonFeedbackEmpty` is a lesson nobody has
 * touched and `sendQuestion` is the question already inside `lessonFeedback.mine`.
 */
export const capturedFeedback = {
  lessonFeedback: {
    rating: {
      average: 4,
      count: 2,
    },
    myStars: 5,
    comments: {
      items: [
        {
          id: 8,
          authorName: 'Học viên tích hợp Demo',
          text: 'Đồng ý với bạn',
          anchor: {
            type: 'none',
            blockId: null,
            page: null,
            second: null,
          },
          createTime: '2026-11-02T04:46:37.940745Z',
          mine: false,
        },
        {
          id: 3,
          authorName: 'Học viên tiền gửi Demo',
          text: 'Bài học rất rõ ràng',
          anchor: {
            type: 'none',
            blockId: null,
            page: null,
            second: null,
          },
          createTime: '2026-11-02T04:46:37.504692Z',
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
        id: 5,
        kind: 'report',
        text: 'Hình minh họa bị mờ',
        anchor: {
          type: 'none',
          blockId: null,
          page: null,
          second: null,
        },
        status: 'new',
        reply: null,
        replyTime: null,
        createTime: '2026-11-02T04:46:37.573384Z',
      },
      {
        id: 4,
        kind: 'question',
        text: 'Bước 3 nghĩa là gì?',
        anchor: {
          type: 'none',
          blockId: null,
          page: null,
          second: null,
        },
        status: 'new',
        reply: null,
        replyTime: null,
        createTime: '2026-11-02T04:46:37.540466Z',
      },
    ],
  },
  lessonFeedbackOther: {
    rating: {
      average: 4,
      count: 2,
    },
    myStars: 3,
    comments: {
      items: [
        {
          id: 8,
          authorName: 'Học viên tích hợp Demo',
          text: 'Đồng ý với bạn',
          anchor: {
            type: 'none',
            blockId: null,
            page: null,
            second: null,
          },
          createTime: '2026-11-02T04:46:37.940745Z',
          mine: false,
        },
        {
          id: 3,
          authorName: 'Học viên tiền gửi Demo',
          text: 'Bài học rất rõ ràng',
          anchor: {
            type: 'none',
            blockId: null,
            page: null,
            second: null,
          },
          createTime: '2026-11-02T04:46:37.504692Z',
          mine: false,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 2,
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
  rateLesson: {
    average: 4,
    count: 2,
    myStars: 5,
  },
  sendComment: {
    id: 9,
    kind: 'comment',
    text: 'Đoạn 0:12 giải thích rất rõ',
    anchor: {
      type: 'video',
      blockId: 33,
      page: null,
      second: 12,
    },
    status: null,
    reply: null,
    replyTime: null,
    createTime: '2026-11-02T05:29:01.242465Z',
  },
  sendQuestion: {
    id: 4,
    kind: 'question',
    text: 'Bước 3 nghĩa là gì?',
    anchor: {
      type: 'none',
      blockId: null,
      page: null,
      second: null,
    },
    status: 'new',
    reply: null,
    replyTime: null,
    createTime: '2026-11-02T04:46:37.540466Z',
  },
  lessonComments: {
    items: [
      {
        id: 8,
        authorName: 'Học viên tích hợp Demo',
        text: 'Đồng ý với bạn',
        anchor: {
          type: 'none',
          blockId: null,
          page: null,
          second: null,
        },
        createTime: '2026-11-02T04:46:37.940745Z',
        mine: false,
      },
    ],
    page: 0,
    size: 1,
    totalElements: 2,
    totalPages: 2,
  },
  courseCard: {
    courseId: 1,
    revisionId: 1,
    code: 'FE-DEMO-C1',
    title: 'Tổng quan hệ thống Core Banking',
    programId: 1,
    moduleId: 1,
    level: 'basic',
    requirement: 'mandatory',
    publicationState: 'published',
    lifecycleStatus: 'active',
    lessonCount: 5,
    durationSeconds: 3300,
    assignedCount: 3,
    enrollmentId: 3,
    learningStatus: 'in_progress',
    progressPercent: 50,
    dueAt: '2026-11-02T04:44:04.124202Z',
    assigned: true,
    overdue: true,
    updateTime: '2026-10-31T04:44:04.124202Z',
    cycleNo: 1,
    startedAt: '2026-10-25T04:44:04.124202Z',
    lastAccessAt: '2026-10-31T17:35:34.319481Z',
    completedAt: null,
    lastLessonId: 2,
    lastBlockId: 4,
    completedRequiredLessonCount: 2,
    requiredLessonCount: 5,
    deadlineStatus: 'overdue_active',
    mediaAssetId: null,
    lastPdfPage: null,
    lastVideoPositionSeconds: null,
    fieldId: 1,
    fieldName: 'Nghiệp vụ Core Banking',
    programName: 'Nền tảng nghiệp vụ Core Banking',
    moduleName: 'Tổng quan',
    failed: true,
    bestScorePercent: 12.5,
    rating: {
      average: 4,
      count: 2,
    },
  },
  ratingRefusal: {
    responseId: '2da688ff-48ad-4e91-9cc0-23290649873a',
    timestamp: '2026-11-02T05:29:01.429023Z',
    status: 'ERROR',
    messageCode: 'CORE-VALIDATION_FAILED',
    message: 'Số sao phải từ 1 đến 5.',
    messageTitle: 'Thông tin chưa hợp lệ',
    data: null,
    errors: [
      {
        field: 'stars',
        code: 'OUT_OF_RANGE',
        message: 'Số sao phải từ 1 đến 5.',
      },
    ],
  },
} as const;
