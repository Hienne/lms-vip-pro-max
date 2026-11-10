import {
  agentEndpoints,
  authV1Endpoints,
  conversationEndpoints,
  ConversationDetailSchema,
  ConversationSummarySchema,
  knowledgeEndpoints,
  PageSchema,
  type AnyEndpoint,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from './fake-backend';
import { SEED_PASSWORD } from './seed';

describe('FakeBackend saved conversations', () => {
  let backend: FakeBackend;
  beforeEach(() => (backend = new FakeBackend()));

  const call = (
    endpoint: AnyEndpoint,
    token: string | null,
    {
      params = {},
      query = {},
      body,
    }: {
      params?: Record<string, string>;
      query?: Record<string, string>;
      body?: unknown;
    } = {},
  ): FakeReply =>
    backend.handle(endpoint, { token, params, query, body }) as FakeReply;

  const login = (username: string): string =>
    (
      call(authV1Endpoints.login, null, {
        body: { username, password: SEED_PASSWORD },
      }).body.data as { accessToken: string }
    ).accessToken;

  const conversationOf = (reply: FakeReply): number =>
    (reply.events?.[0] as { conversationId: number }).conversationId;

  const ask = (token: string, message: string, conversationId?: number) =>
    call(agentEndpoints.stream, token, {
      body: conversationId ? { conversationId, message } : { message },
    });

  const list = (token: string, query: Record<string, string> = {}) =>
    PageSchema(ConversationSummarySchema).parse(
      call(conversationEndpoints.list, token, { query }).body.data,
    );

  const detail = (token: string, id: number) =>
    call(conversationEndpoints.detail, token, {
      params: { conversationId: String(id) },
    });

  const code = (reply: FakeReply): string | undefined =>
    (reply.body as { messageCode?: string }).messageCode;

  it('lists a conversation from either assistant, titled by its first question', () => {
    const token = login('hocvien');
    ask(token, 'Xin chào trợ lý');
    call(knowledgeEndpoints.askStream, token, {
      body: { question: 'EOD là gì?' },
    });

    expect(list(token).items.map((c) => c.title)).toEqual([
      'EOD là gì?',
      'Xin chào trợ lý',
    ]);
  });

  it('continues a conversation instead of opening another', () => {
    const token = login('hocvien');
    const id = conversationOf(ask(token, 'Câu đầu'));
    expect(conversationOf(ask(token, 'Câu hai', id))).toBe(id);

    const turns = ConversationDetailSchema.parse(
      detail(token, id).body.data,
    ).turns;
    expect(turns.map((t) => t.question)).toEqual(['Câu đầu', 'Câu hai']);
    expect(list(token).totalElements).toBe(1);
  });

  it('keeps a knowledge turn with its sources', () => {
    const token = login('hocvien');
    const id = conversationOf(
      call(knowledgeEndpoints.askStream, token, {
        body: { question: 'EOD là gì?' },
      }),
    );

    const turn = ConversationDetailSchema.parse(detail(token, id).body.data)
      .turns[0];
    expect(turn?.surface).toBe('KNOWLEDGE');
    expect(turn?.citations.length).toBeGreaterThan(0);
    expect(turn?.answer).toContain('EOD');
  });

  it('shows another user nothing of it', () => {
    const mine = login('hocvien');
    const id = conversationOf(ask(mine, 'Chuyện riêng'));
    const theirs = login('giangvien');

    expect(list(theirs).totalElements).toBe(0);
    expect(code(detail(theirs, id))).toBe('ASSISTANT-CONVERSATION_NOT_FOUND');
    expect(code(ask(theirs, 'Tiếp', id))).toBe(
      'ASSISTANT-CONVERSATION_NOT_FOUND',
    );
  });

  it('searches by title only', () => {
    const token = login('hocvien');
    ask(token, 'Quy trình EOD');
    ask(token, 'Chuyện khác');

    expect(list(token, { q: 'eod' }).items.map((c) => c.title)).toEqual([
      'Quy trình EOD',
    ]);
    expect(list(token, { q: 'không khớp' }).totalElements).toBe(0);
  });

  it('renames, deletes one and deletes all', () => {
    const token = login('hocvien');
    const first = conversationOf(ask(token, 'Một'));
    ask(token, 'Hai');

    const renamed = call(conversationEndpoints.rename, token, {
      params: { conversationId: String(first) },
      body: { title: 'Tên mới' },
    });
    expect(ConversationSummarySchema.parse(renamed.body.data).title).toBe(
      'Tên mới',
    );
    expect(
      code(
        call(conversationEndpoints.rename, token, {
          params: { conversationId: String(first) },
          body: { title: '   ' },
        }),
      ),
    ).toBe('CORE-VALIDATION_FAILED');

    call(conversationEndpoints.remove, token, {
      params: { conversationId: String(first) },
    });
    expect(code(detail(token, first))).toBe('ASSISTANT-CONVERSATION_NOT_FOUND');
    expect(list(token).totalElements).toBe(1);

    call(conversationEndpoints.removeAll, token);
    expect(list(token).totalElements).toBe(0);
  });

  it('reopens a proposed change with the card state it ended in', () => {
    const token = login('hocvien');
    const id = conversationOf(
      ask(token, 'Đổi chức danh thành Trưởng nhóm Kiểm thử'),
    );
    const open = ConversationDetailSchema.parse(detail(token, id).body.data);
    const action = open.turns[0]?.action;
    expect(action?.status).toBe('pending');

    call(agentEndpoints.confirmAction, token, {
      params: { actionId: action?.id ?? '' },
    });

    const after = ConversationDetailSchema.parse(detail(token, id).body.data);
    expect(after.turns[0]?.action?.status).toBe('confirmed');
    expect(after.turns[0]?.action?.message).toBe('Đã cập nhật hồ sơ.');
  });

  it('reads a card nobody answered in time as expired', () => {
    const token = login('hocvien');
    const id = conversationOf(
      ask(token, 'Đổi chức danh thành Trưởng nhóm Kiểm thử'),
    );
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 60 * 60 * 1000);
      const turns = ConversationDetailSchema.parse(
        detail(token, id).body.data,
      ).turns;
      expect(turns[0]?.action?.status).toBe('expired');
    } finally {
      vi.useRealTimers();
    }
  });
});
