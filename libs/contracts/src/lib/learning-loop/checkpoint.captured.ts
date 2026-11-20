/**
 * Responses in the shape `CheckpointApiIT` (corebanking-academy, ticket 01) asserts: the question
 * payload has no key, the answer carries it. Written from that test, not captured from a running
 * server; recapture them from the local stack once the backend runs it.
 */
export const capturedCheckpoint = {
  checkpoint: {
    lessonId: 41,
    questions: [
      {
        questionId: 301,
        questionVersion: 2,
        questionType: 'SINGLE',
        content: 'Hạn mức giao dịch được kiểm soát ở bước nào?',
        options: [
          { id: 1001, content: 'Kiểm tra khi khởi tạo giao dịch' },
          { id: 1002, content: 'Chỉ kiểm tra cuối ngày' },
          { id: 1003, content: 'Không cần kiểm tra' },
          { id: 1004, content: 'Do khách hàng tự xác nhận' },
        ],
      },
      {
        questionId: 302,
        questionVersion: 0,
        questionType: 'MULTIPLE',
        content: 'Chọn các thông tin bắt buộc khi mở tài khoản.',
        options: [
          { id: 1011, content: 'Giấy tờ định danh' },
          { id: 1012, content: 'Sở thích cá nhân' },
          { id: 1013, content: 'Địa chỉ liên hệ' },
        ],
      },
    ],
  },
  emptyCheckpoint: { lessonId: 42, questions: [] },
  answerWrong: {
    correct: false,
    correctOptionIds: [1001],
    explanation: 'Hạn mức được kiểm soát ngay khi khởi tạo giao dịch.',
  },
  answerRight: {
    correct: true,
    correctOptionIds: [1011, 1013],
    explanation: null,
  },
} as const;
