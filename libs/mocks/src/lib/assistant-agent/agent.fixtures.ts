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
    { type: 'tool', name: 'update_profile' },
    { type: 'action_required', action },
    { type: 'done', answer: AGENT_PROFILE_CARD_TEXT, citations: [] },
  ];
}

/** A tool line, then words: a refusal the model relays. */
export function agentRefusedEvents(
  tool: string,
  text: string,
): readonly AgentStreamEvent[] {
  return [{ type: 'tool', name: tool }, ...agentTextEvents(text)];
}
