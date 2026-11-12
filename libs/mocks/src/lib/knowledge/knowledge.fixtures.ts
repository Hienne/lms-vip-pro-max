import type {
  ChatAnswer,
  TextChunk,
  ChatStreamEvent,
  KnowledgeDocument,
} from '@lms/contracts';

// Fixed results of the backend's knowledge services (corebanking-academy, /api/v1/knowledge): the
// shared documents, a cited answer, the fixed not-found answer and the stream that sends them.
// Nothing here is computed; retrieval and answering are the backend's.

export const knowledgeDocumentFixtures: readonly KnowledgeDocument[] = [
  {
    id: 3,
    fileName: 'Checklist-van-hanh-cuoi-thang.md',
    title: 'Checklist-van-hanh-cuoi-thang.md',
    mimeType: 'text/markdown',
    sizeBytes: 1129,
    scope: 'unit',
    scopeOrgId: 1,
    status: 'failed',
    errorMessage: 'Tài liệu không có nội dung văn bản.',
    pageCount: null,
    chunkCount: 0,
    uploadedBy: { userId: '000004', fullName: 'Học viên tiền gửi Demo' },
    createdAt: '2026-10-22T09:30:00.000Z',
    processedAt: '2026-10-22T09:30:07.000Z',
  },
  {
    id: 2,
    fileName: 'Quy-trinh-ECR.docx',
    title: 'Quy-trinh-ECR.docx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sizeBytes: 4039,
    scope: 'unit',
    scopeOrgId: 1,
    status: 'processing',
    errorMessage: null,
    pageCount: null,
    chunkCount: 0,
    uploadedBy: { userId: '000005', fullName: 'Giảng viên Demo' },
    createdAt: '2026-10-22T09:00:00.000Z',
    processedAt: null,
  },
  {
    id: 1,
    fileName: 'Quy-trinh-EOD.pdf',
    title: 'Quy-trinh-EOD.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 182_400,
    scope: 'global',
    scopeOrgId: null,
    status: 'ready',
    errorMessage: null,
    pageCount: 2,
    chunkCount: 2,
    uploadedBy: { userId: '000005', fullName: 'Giảng viên Demo' },
    createdAt: '2026-10-21T08:15:00.000Z',
    processedAt: '2026-10-21T08:15:12.000Z',
  },
];

export const knowledgeAnswerFixture: ChatAnswer = {
  answer:
    'Chạy EOD phải đối chiếu số dư sổ cái trước, sau đó mới khóa ngày giao dịch [1]. Mọi chênh lệch được ghi vào checklist vận hành [2].',
  found: true,
  citations: [
    {
      n: 1,
      documentId: 1,
      chunkId: 11,
      fileName: 'Quy-trinh-EOD.pdf',
      page: 1,
      lineStart: 3,
      lineEnd: 9,
      snippet:
        'Trước khi chạy EOD, đối chiếu số dư sổ cái với báo cáo cuối ngày của từng phân hệ, rồi khóa ngày giao dịch…',
    },
    {
      n: 2,
      documentId: 4,
      chunkId: 41,
      fileName: 'Checklist-van-hanh.md',
      page: null,
      lineStart: 12,
      lineEnd: 15,
      snippet:
        'Mọi chênh lệch lớn hơn 1.000.000 đồng phải được Trưởng nhóm vận hành phê duyệt bằng văn bản.',
    },
  ],
};

/** The extracted text of document 1 as the source viewer reads it: five chunks, the cited one is 11. */
export const knowledgeDocumentTextFixtures: Readonly<
  Record<number, readonly TextChunk[]>
> = {
  1: [
    {
      chunkId: 10,
      chunkIndex: 0,
      sectionPath: 'Quy trình EOD',
      page: 1,
      lineStart: 1,
      lineEnd: 2,
      text: 'Quy trình EOD áp dụng cho mọi phân hệ của hệ thống Core Banking.',
    },
    {
      chunkId: 11,
      chunkIndex: 1,
      sectionPath: 'Quy trình EOD › Đóng sổ',
      page: 1,
      lineStart: 3,
      lineEnd: 9,
      text: 'Trước khi chạy EOD, đối chiếu số dư sổ cái với báo cáo cuối ngày của từng phân hệ, rồi khóa ngày giao dịch.',
    },
    {
      chunkId: 12,
      chunkIndex: 2,
      sectionPath: 'Quy trình EOD › Đóng sổ',
      page: 2,
      lineStart: 10,
      lineEnd: 14,
      text: 'Sau khi khóa ngày, không ghi thêm bút toán vào ngày đã khóa.',
    },
    {
      chunkId: 13,
      chunkIndex: 3,
      sectionPath: 'Quy trình EOD › Xử lý chênh lệch',
      page: 2,
      lineStart: 15,
      lineEnd: 20,
      text: 'Mọi chênh lệch được ghi vào checklist vận hành và báo cho Trưởng nhóm.',
    },
    {
      chunkId: 14,
      chunkIndex: 4,
      sectionPath: 'Quy trình EOD › Xử lý chênh lệch',
      page: 2,
      lineStart: 21,
      lineEnd: 25,
      text: 'Chênh lệch chưa giải thích được phải chuyển lên cấp trên trong ngày.',
    },
  ],
};

/** Exactly what the backend answers when nothing in the documents is relevant. */
export const KNOWLEDGE_NOT_FOUND_ANSWER =
  'Không tìm thấy thông tin này trong tài liệu.';

export const knowledgeNotFoundFixture: ChatAnswer = {
  answer: KNOWLEDGE_NOT_FOUND_ANSWER,
  found: false,
  citations: [],
};

/** The answer above as the stream sends it: found, five pieces of text, then the citations. */
export const knowledgeStreamFixture: readonly ChatStreamEvent[] = [
  { type: 'retrieved', count: 2 },
  { type: 'delta', text: 'Chạy EOD phải đối chiếu số dư sổ cái trước, ' },
  { type: 'delta', text: 'sau đó mới khóa ngày giao dịch [1]. ' },
  { type: 'delta', text: 'Mọi chênh lệch được ghi vào ' },
  { type: 'delta', text: 'checklist vận hành ' },
  { type: 'delta', text: '[2].' },
  {
    type: 'done',
    found: true,
    answer: knowledgeAnswerFixture.answer,
    citations: knowledgeAnswerFixture.citations,
  },
];

export const knowledgeNotFoundStreamFixture: readonly ChatStreamEvent[] = [
  { type: 'retrieved', count: 0 },
  { type: 'delta', text: KNOWLEDGE_NOT_FOUND_ANSWER },
  {
    type: 'done',
    found: false,
    answer: KNOWLEDGE_NOT_FOUND_ANSWER,
    citations: [],
  },
];
