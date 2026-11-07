import {
  adminOrgEndpoints,
  assessmentEndpoints,
  agentEndpoints,
  AgentStreamEventSchema,
  authV1Endpoints,
  certificateEndpoints,
  communityEndpoints,
  feedbackEndpoints,
  gamificationEndpoints,
  personalEndpoints,
  reportEndpoints,
  type AnyEndpoint,
  identityEndpoints,
  knowledgeEndpoints,
  learnerQuizEndpoints,
  organizationEndpoints,
  shellEndpoints,
} from '@lms/contracts';
import {
  agentAiErrorEvents,
  agentDocumentEvents,
  agentNavigateEvents,
  agentNotFoundEvents,
  agentTextEvents,
} from './lib/assistant-agent/agent.fixtures';
import { FakeBackend } from './lib/backend/fake-backend';
import {
  knowledgeAnswerFixture,
  knowledgeDocumentFixtures,
  knowledgeNotFoundFixture,
  knowledgeNotFoundStreamFixture,
  knowledgeStreamFixture,
} from './lib/knowledge/knowledge.fixtures';

const everyEndpoint: readonly AnyEndpoint[] = [
  ...Object.values(adminOrgEndpoints),
  ...Object.values(assessmentEndpoints),
  ...Object.values(agentEndpoints),
  ...Object.values(authV1Endpoints),
  ...Object.values(communityEndpoints),
  ...Object.values(identityEndpoints),
  ...Object.values(knowledgeEndpoints),
  ...Object.values(learnerQuizEndpoints),
  ...Object.values(organizationEndpoints),
  ...Object.values(feedbackEndpoints),
  ...Object.values(gamificationEndpoints),
  ...Object.values(certificateEndpoints),
  ...Object.values(personalEndpoints),
  ...Object.values(reportEndpoints),
  ...Object.values(shellEndpoints),
];

describe('FakeBackend and the endpoint registries', () => {
  it('answers every endpoint the app declares, the backend ones and the served: mock ones', () => {
    const backend = new FakeBackend();
    // The self-registration calls are made against the real backend only (no mock, by decision).
    const backendOnly: readonly AnyEndpoint[] = [
      identityEndpoints.registrationUnits,
      identityEndpoints.registerRequest,
      identityEndpoints.approveAccessRequest,
      identityEndpoints.passwordResetRequest,
      identityEndpoints.resetPasswordForRequest,
    ];
    for (const endpoint of everyEndpoint) {
      expect(backend.answers(endpoint), endpoint.path).toBe(
        !backendOnly.includes(endpoint),
      );
    }
  });

  it('declares the endpoints the backend lacks as served: mock', () => {
    const mock = everyEndpoint
      .filter((endpoint) => endpoint.served === 'mock')
      .map((endpoint) => endpoint.path)
      .sort();
    expect(mock).toEqual(
      [
        ...Object.values(adminOrgEndpoints),
        ...Object.values(assessmentEndpoints),
        ...Object.values(reportEndpoints),
        shellEndpoints.navCounts,
      ]
        .map((endpoint) => endpoint.path)
        .sort(),
    );
  });

  it('serves no community endpoint from the mock-only list', () => {
    for (const endpoint of Object.values(communityEndpoints)) {
      expect(endpoint.served, endpoint.path).toBeUndefined();
    }
  });

  // Role CRUD takes a body and is covered by the FakeBackend spec.
  it.each(
    everyEndpoint.filter(
      (endpoint) =>
        endpoint.served === 'mock' &&
        endpoint.method === 'get' &&
        endpoint !== adminOrgEndpoints.saveRole &&
        endpoint !== adminOrgEndpoints.deleteRole,
    ),
  )('answers the read %# with a body its contract parses', (endpoint) => {
    const reply = new FakeBackend().handle(endpoint, {
      token: null,
      params: {
        userId: '000004',
        quizId: 'q1',
        attemptId: 'at-demo',
        dim: 'learners',
      },
      query: { dim: 'learners' },
      body: undefined,
    });
    const data =
      endpoint.responseType === 'blob' && reply && 'file' in reply
        ? reply.file
        : reply?.body.data;
    expect(() => endpoint.response.parse(data)).not.toThrow();
  });

  it('keeps the knowledge fixtures within their contracts', () => {
    for (const document of knowledgeDocumentFixtures) {
      expect(() =>
        knowledgeEndpoints.document.response.parse(document),
      ).not.toThrow();
    }
    for (const answer of [knowledgeAnswerFixture, knowledgeNotFoundFixture]) {
      expect(() => knowledgeEndpoints.ask.response.parse(answer)).not.toThrow();
    }
    for (const event of [
      ...knowledgeStreamFixture,
      ...knowledgeNotFoundStreamFixture,
    ]) {
      expect(() =>
        knowledgeEndpoints.askStream.response.parse(event),
      ).not.toThrow();
    }
  });

  it('streams the same text the complete answer holds', () => {
    const streamed = knowledgeStreamFixture
      .flatMap((event) => (event.type === 'delta' ? [event.text] : []))
      .join('');
    expect(streamed).toBe(knowledgeAnswerFixture.answer);
  });
});

describe('agent fixtures', () => {
  const scripts = [
    agentDocumentEvents,
    agentNotFoundEvents,
    agentAiErrorEvents,
    agentNavigateEvents('/admin/users', 'Quản lý người dùng'),
    agentTextEvents('Xin chào'),
  ];

  it.each(scripts.map((events, i) => [i, events] as const))(
    'script %i parses and ends the turn',
    (_, events) => {
      for (const event of events) AgentStreamEventSchema.parse(event);
      expect(['done', 'error']).toContain(events.at(-1)?.type);
    },
  );

  it('streams the same text the complete answer holds', () => {
    const streamed = agentDocumentEvents
      .flatMap((event) => (event.type === 'delta' ? [event.text] : []))
      .join('');
    expect(streamed).toBe(knowledgeAnswerFixture.answer);
  });
});
