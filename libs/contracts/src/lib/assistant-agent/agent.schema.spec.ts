import { toUrl } from '../http/endpoint';
import { agentEndpoints } from './agent.endpoints';
import {
  ActionResultSchema,
  AgentCommandSchema,
  AgentStreamEventSchema,
  PendingActionSchema,
} from './agent.schema';
import { ChatStreamEventSchema } from '../knowledge/knowledge.schema';

const citation = {
  n: 1,
  documentId: 7,
  fileName: 'quy-trinh-eod.md',
  page: null,
  lineStart: 3,
  lineEnd: 9,
  snippet: 'EOD là…',
};

const action = {
  id: '6f1c0a52',
  tool: 'update_profile',
  title: 'Cập nhật hồ sơ cá nhân',
  changes: [
    {
      field: 'positionName',
      label: 'Chức danh',
      from: null,
      to: 'Chuyên viên',
    },
  ],
  expiresAt: '2026-10-24T09:10:00Z',
};

describe('agent stream events', () => {
  it.each([
    { type: 'tool', name: 'search_documents' },
    { type: 'delta', text: 'CIF là' },
    { type: 'navigate', path: '/admin/users', title: 'Quản lý người dùng' },
    { type: 'action_required', action },
    { type: 'done', answer: 'Xong.', citations: [citation] },
    {
      type: 'error',
      messageCode: 'ASSISTANT-AI_UNAVAILABLE',
      message: 'AI chưa sẵn sàng.',
    },
  ])('parses %j', (event) => {
    expect(AgentStreamEventSchema.parse(event)).toEqual(event);
  });

  it('parses a tool the app does not know yet', () => {
    expect(
      AgentStreamEventSchema.parse({ type: 'tool', name: 'create_course' }),
    ).toEqual({
      type: 'tool',
      name: 'create_course',
    });
  });

  it.each([
    { type: 'navigate', path: 'admin/users', title: 'x' },
    { type: 'navigate', path: 'https://evil.example', title: 'x' },
    { type: 'retrieved', count: 1 },
    { type: 'done', answer: 'x' },
  ])('rejects %j', (event) => {
    expect(() => AgentStreamEventSchema.parse(event)).toThrow();
  });

  it('rejects a pending action of a tool the app cannot show', () => {
    expect(() =>
      PendingActionSchema.parse({ ...action, tool: 'create_course' }),
    ).toThrow();
    expect(() =>
      AgentStreamEventSchema.parse({
        type: 'action_required',
        action: { ...action, tool: 'create_course' },
      }),
    ).toThrow();
  });

  it('rejects an action without changes or with an unknown field', () => {
    expect(() =>
      PendingActionSchema.parse({ ...action, changes: [] }),
    ).toThrow();
    expect(() =>
      PendingActionSchema.parse({
        ...action,
        changes: [
          { field: 'password', label: 'Mật khẩu', from: null, to: 'x' },
        ],
      }),
    ).toThrow();
  });
});

describe('AgentCommandSchema', () => {
  it('accepts a first question and a follow-up with the conversation id', () => {
    expect(AgentCommandSchema.parse({ message: 'CIF là gì?' })).toEqual({
      message: 'CIF là gì?',
    });
    expect(
      AgentCommandSchema.parse({
        conversationId: 42,
        message: 'Còn CIF khác?',
      }),
    ).toEqual({ conversationId: 42, message: 'Còn CIF khác?' });
  });

  it('takes no history: the old messages field is not part of the command', () => {
    expect(
      AgentCommandSchema.parse({
        message: 'x',
        messages: [{ role: 'user', content: 'y' }],
      }),
    ).toEqual({ message: 'x' });
  });

  it('rejects a blank or over-long message and a bad conversation id', () => {
    expect(() => AgentCommandSchema.parse({ message: '   ' })).toThrow();
    expect(() =>
      AgentCommandSchema.parse({ message: 'x'.repeat(501) }),
    ).toThrow();
    expect(() =>
      AgentCommandSchema.parse({ conversationId: 0, message: 'x' }),
    ).toThrow();
  });
});

describe('the conversation event', () => {
  it('opens both kinds of stream and carries the id', () => {
    const event = { type: 'conversation', conversationId: 42 };
    expect(AgentStreamEventSchema.parse(event)).toEqual(event);
    expect(ChatStreamEventSchema.parse(event)).toEqual(event);
  });
});

describe('ActionResultSchema', () => {
  it('rejects a result of another tool', () => {
    expect(() =>
      ActionResultSchema.parse({
        actionId: 'a',
        tool: 'create_course',
        message: 'x',
        data: {},
      }),
    ).toThrow();
  });
});

describe('agent endpoints', () => {
  it('registers the stream and the two action calls under /api/v1/assistant/agent', () => {
    expect(Object.keys(agentEndpoints)).toEqual([
      'stream',
      'confirmAction',
      'cancelAction',
    ]);
    expect(toUrl(agentEndpoints.stream)).toBe('/api/v1/assistant/agent/stream');
    expect(agentEndpoints.stream.responseType).toBe('ndjson');
    expect(toUrl(agentEndpoints.confirmAction, { actionId: 'abc' })).toBe(
      '/api/v1/assistant/agent/actions/abc/confirm',
    );
    expect(toUrl(agentEndpoints.cancelAction, { actionId: 'abc' })).toBe(
      '/api/v1/assistant/agent/actions/abc/cancel',
    );
  });
});
