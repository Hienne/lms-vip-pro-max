import type { AgentStreamEvent, PendingAction } from '@lms/contracts';
import { BACKEND_RESPONSES } from '../backend-responses';
import {
  KNOWLEDGE_NOT_FOUND_ANSWER,
  knowledgeAnswerFixture,
} from '../knowledge/knowledge.fixtures';

// Scripted replies of the backend's quick assistant (corebanking-academy, /api/v1/assistant/agent).
// The mock backend picks one from the last user message so the widget's specs and the demo are
// deterministic; the model, the tools and the choice between them are the backend's.

/** `open_screen` refusal: the model says it, no `navigate` follows. */
export const AGENT_SCREEN_REFUSED =
  'Bạn không có quyền mở màn hình này hoặc màn hình không tồn tại.';

/** Said instead of a card for an account that cannot change its own profile here. */
export const AGENT_PROFILE_NOT_OFFERED =
  'Tài khoản của bạn không đổi được hồ sơ tại đây.';

export const AGENT_PROFILE_UNCHANGED =
  'Hồ sơ đã có đúng giá trị này, không cần thay đổi.';

/** The sentence `update_profile` ends its turn with, under the card. */
export const AGENT_PROFILE_CARD_TEXT =
  'Vui lòng kiểm tra và xác nhận thay đổi bên dưới.';

export const AGENT_PROFILE_CARD_TITLE = 'Cập nhật hồ sơ cá nhân';

/** The refusal text for a value the profile rules reject (the backend tool's messages). */
export const AGENT_PROFILE_INVALID = {
  fullName: 'Họ tên phải từ 1 đến 255 ký tự.',
  email: 'Email không hợp lệ hoặc dài quá 100 ký tự.',
  positionName: 'Chức danh dài tối đa 255 ký tự.',
} as const;

export const AGENT_COURSE_FOR_INSTRUCTORS =
  'Tính năng tạo khóa học bằng AI dành cho giảng viên.';
export const AGENT_COURSE_ADMIN_FORM =
  'Quản trị viên cần chọn đơn vị sở hữu khóa học: hãy mở Khóa học mới rồi bấm "Tạo bằng AI".';
export const AGENT_COURSE_ATTACH_FIRST =
  'Hãy đính kèm một tệp .pdf, .docx hoặc .md bằng nút ghim ở ô soạn tin rồi gửi lại yêu cầu.';
export const AGENT_COURSE_CARD_TITLE = 'Tạo khóa học bằng AI';
export const AGENT_COURSE_STARTED =
  'Đã bắt đầu tạo khóa học. Mở màn hình rà soát để theo dõi.';

/** A turn that ends in words only, as the model would say them. */
export function agentTextEvents(text: string): readonly AgentStreamEvent[] {
  return [
    { type: 'delta', text },
    { type: 'done', answer: text, citations: [] },
  ];
}

/** The answer of `knowledgeAnswerFixture`, as a turn: the search line, three pieces of text, the sources. */
export const agentDocumentEvents: readonly AgentStreamEvent[] = [
  { type: 'tool', name: 'search_documents' },
  { type: 'delta', text: 'Chạy EOD phải đối chiếu số dư sổ cái trước, ' },
  { type: 'delta', text: 'sau đó mới khóa ngày giao dịch [1]. ' },
  {
    type: 'delta',
    text: 'Mọi chênh lệch được ghi vào checklist vận hành [2].',
  },
  {
    type: 'done',
    answer: knowledgeAnswerFixture.answer,
    citations: knowledgeAnswerFixture.citations,
  },
];

/** A document answer with a follow-up that asks for a profile change: read-only, as the server marks it. */
export const agentDocumentSuggestionEvents: readonly AgentStreamEvent[] =
  agentDocumentEvents.map((event) =>
    event.type === 'done'
      ? {
          ...event,
          suggestions: ['Đổi chức danh của tôi thành Chuyên viên chính'],
          suggestionsReadOnly: true,
        }
      : event,
  );

/** The answer of a conversation opened from a lesson: one source, the lesson itself. */
export function agentLessonEvents(
  lesson: { courseId: number; revisionId: number; lessonId: number },
  label: string,
  summarise: boolean,
): readonly AgentStreamEvent[] {
  const text = summarise
    ? 'Bài này có hai ý chính: khái niệm và cách áp dụng [1].'
    : 'Bài này giới thiệu khái niệm và cách áp dụng vào nghiệp vụ [1].';
  const [courseTitle = label, lessonTitle = label] = label.split(' › ');
  return [
    { type: 'tool', name: summarise ? 'read_lesson' : 'search_courses' },
    { type: 'delta', text },
    {
      type: 'done',
      answer: text,
      citations: [
        {
          n: 1,
          documentId: 0,
          fileName: label,
          page: null,
          lineStart: 0,
          lineEnd: 0,
          snippet: 'Nội dung bài học được trích từ khóa học.',
          lesson: {
            courseId: lesson.courseId,
            courseTitle,
            revisionId: lesson.revisionId,
            chapterTitle: 'Chương 1',
            lessonId: lesson.lessonId,
            lessonTitle,
            blockId: 1,
            url: `/lesson/${lesson.courseId}/${lesson.lessonId}`,
          },
        },
      ],
    },
  ];
}

export const agentNotFoundEvents: readonly AgentStreamEvent[] = [
  { type: 'tool', name: 'search_documents' },
  {
    type: 'done',
    answer: KNOWLEDGE_NOT_FOUND_ANSWER,
    citations: [],
  },
];

/** Ollama stops answering after the search started. */
export const agentAiErrorEvents: readonly AgentStreamEvent[] = [
  { type: 'tool', name: 'search_documents' },
  {
    type: 'error',
    messageCode: BACKEND_RESPONSES.assistantAiUnavailable.code,
    message: BACKEND_RESPONSES.assistantAiUnavailable.message,
  },
];

export function agentNavigateEvents(
  path: string,
  title: string,
): readonly AgentStreamEvent[] {
  return [
    { type: 'tool', name: 'open_screen' },
    { type: 'navigate', path, title },
    { type: 'done', answer: `Đã mở trang ${title}.`, citations: [] },
  ];
}

export function agentActionEvents(
  action: PendingAction,
): readonly AgentStreamEvent[] {
  return [
    { type: 'tool', name: action.tool },
    { type: 'action_required', action },
    {
      type: 'done',
      answer:
        action.tool === 'update_profile'
          ? AGENT_PROFILE_CARD_TEXT
          : 'Vui lòng kiểm tra và xác nhận để bắt đầu tạo khóa học.',
      citations: [],
    },
  ];
}

/** A tool line, then words: a refusal the model relays. */
export function agentRefusedEvents(
  tool: string,
  text: string,
): readonly AgentStreamEvent[] {
  return [{ type: 'tool', name: tool }, ...agentTextEvents(text)];
}
