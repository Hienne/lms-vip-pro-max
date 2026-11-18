import {
  agentEndpoints,
  authV1Endpoints,
  conversationEndpoints,
  ConversationDetailSchema,
  draftingSessionEndpoints,
  type AnyEndpoint,
  type DraftingSession,
} from '@lms/contracts';
import {
  AGENT_COURSE_ATTACH_FIRST,
  AGENT_COURSE_FOR_INSTRUCTORS,
  AGENT_COURSE_SOURCE_NOT_FOUND,
} from '../assistant-agent/agent.fixtures';
import { draftingStepMessage } from '../assistant-drafting/drafting-session.fixtures';
import { FakeBackend, type FakeReply } from './fake-backend';
import { SEED_PASSWORD } from './seed';

describe('FakeBackend start_course_drafting and step messages', () => {
  let backend: FakeBackend;
  beforeEach(() => (backend = new FakeBackend()));

  const call = (
    endpoint: AnyEndpoint,
    token: string | null,
    {
      params = {},
      body,
    }: { params?: Record<string, string>; body?: unknown } = {},
  ): FakeReply =>
    backend.handle(endpoint, { token, params, query: {}, body }) as FakeReply;

  const login = (username: string): string =>
    (
      call(authV1Endpoints.login, null, {
        body: { username, password: SEED_PASSWORD },
      }).body.data as { accessToken: string }
    ).accessToken;

  const upload = (token: string): number => {
    const data = new FormData();
    data.set('file', new File(['x'], 'quy-trinh.pdf'));
    return (
      call(draftingSessionEndpoints.uploadSource, token, { body: data }).body
        .data as { documentId: number }
    ).documentId;
  };

  const ask = (token: string, attachmentDocumentId?: number) =>
    call(agentEndpoints.stream, token, {
      body: {
        message: 'Tạo khóa học từ tài liệu này',
        skill: 'tao_khoa_hoc',
        ...(attachmentDocumentId ? { attachmentDocumentId } : {}),
      },
    });

  const eventOf = (reply: FakeReply, type: string) =>
    reply.events?.find((event) => (event as { type: string }).type === type) as
      | Record<string, unknown>
      | undefined;

  const detail = (token: string, id: number) =>
    ConversationDetailSchema.parse(
      call(conversationEndpoints.detail, token, {
        params: { conversationId: String(id) },
      }).body.data,
    );

  const get = (token: string, id: number) =>
    call(draftingSessionEndpoints.get, token, {
      params: { sessionId: String(id) },
    }).body.data as DraftingSession;

  it('starts a session from the attached source for this conversation and opens it', () => {
    const token = login('giangvien');
    const reply = ask(token, upload(token));

    expect(eventOf(reply, 'tool')).toMatchObject({
      name: 'start_course_drafting',
    });
    const path = eventOf(reply, 'navigate')?.['path'] as string;
    expect(path).toMatch(/^\/admin\/courses\/new\?session=\d+$/);
    const conversationId = eventOf(reply, 'conversation')?.[
      'conversationId'
    ] as number;
    const session = get(token, Number(path.split('=')[1]));
    expect(session.conversationId).toBe(conversationId);
    expect(session.source?.fileName).toBe('quy-trinh.pdf');
  });

  it('asks for a document, refuses a used one and tells a learner it is for instructors', () => {
    const token = login('giangvien');
    expect(eventOf(ask(token), 'done')?.['answer']).toBe(
      AGENT_COURSE_ATTACH_FIRST,
    );
    const source = upload(token);
    ask(token, source);
    expect(eventOf(ask(token, source), 'done')?.['answer']).toBe(
      AGENT_COURSE_SOURCE_NOT_FOUND,
    );
    const learner = login('hocvien');
    const refused = ask(learner, upload(token));
    expect(eventOf(refused, 'navigate')).toBeUndefined();
    expect(eventOf(refused, 'done')?.['answer']).toBe(
      AGENT_COURSE_FOR_INSTRUCTORS,
    );
  });

  it('posts one message per ready step, whose card reads the step state now', () => {
    backend.draftingSessions.pollsBeforeProposal = 0;
    const token = login('giangvien');
    const reply = ask(token, upload(token));
    const conversationId = eventOf(reply, 'conversation')?.[
      'conversationId'
    ] as number;
    const sessionId = Number(
      (eventOf(reply, 'navigate')?.['path'] as string).split('=')[1],
    );

    const session = get(token, sessionId);
    get(token, sessionId);
    expect(session.steps[0].state).toBe('proposed');

    const turns = detail(token, conversationId).turns;
    expect(turns).toHaveLength(2);
    expect(turns[1]).toMatchObject({
      question: '',
      answer: draftingStepMessage(1, session.steps[0].notes),
      draftingCard: { sessionId, step: 1, state: 'proposed', courseId: null },
    });
  });
});
