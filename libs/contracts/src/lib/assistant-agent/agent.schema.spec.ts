import { toUrl } from '../http/endpoint';
import { agentEndpoints } from './agent.endpoints';
import {
  ActionResultSchema,
  AgentCommandSchema,
  AgentStreamEventSchema,
  PendingActionSchema,
} from './agent.schema';

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
  const user = { role: 'user', content: 'CIF là gì?' } as const;
  const assistant = { role: 'assistant', content: 'CIF là… [1]' } as const;

  it('accepts a history that ends with the user', () => {
    expect(
      AgentCommandSchema.parse({ messages: [user, assistant, user] }).messages,
    ).toHaveLength(3);
  });

  it('rejects a history that ends with the assistant', () => {
    expect(() =>
      AgentCommandSchema.parse({ messages: [user, assistant] }),
    ).toThrow();
  });

  it('rejects an empty history, a system role and more than 20 messages', () => {
    expect(() => AgentCommandSchema.parse({ messages: [] })).toThrow();
    expect(() =>
      AgentCommandSchema.parse({
        messages: [{ role: 'system', content: 'x' }],
      }),
    ).toThrow();
    expect(() =>
      AgentCommandSchema.parse({
        messages: Array.from({ length: 21 }, () => user),
      }),
    ).toThrow();
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
