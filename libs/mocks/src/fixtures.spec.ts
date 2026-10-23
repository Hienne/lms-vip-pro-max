import {
  adminOrgEndpoints,
  authV1Endpoints,
  type AnyEndpoint,
  identityEndpoints,
  knowledgeEndpoints,
  organizationEndpoints,
  shellEndpoints,
} from '@lms/contracts';
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
  ...Object.values(authV1Endpoints),
  ...Object.values(identityEndpoints),
  ...Object.values(knowledgeEndpoints),
  ...Object.values(organizationEndpoints),
  ...Object.values(shellEndpoints),
];

describe('FakeBackend and the endpoint registries', () => {
  it('answers every endpoint the app declares, the backend ones and the served: mock ones', () => {
    const backend = new FakeBackend();
    for (const endpoint of everyEndpoint) {
      expect(backend.answers(endpoint), endpoint.path).toBe(true);
    }
  });

  it('declares the endpoints the backend lacks as served: mock', () => {
    const mock = everyEndpoint
      .filter((endpoint) => endpoint.served === 'mock')
      .map((endpoint) => endpoint.path)
      .sort();
    expect(mock).toEqual(
      [...Object.values(adminOrgEndpoints), shellEndpoints.navCounts]
        .map((endpoint) => endpoint.path)
        .sort(),
    );
  });

  // Role CRUD takes a body and is covered by the FakeBackend spec.
  it.each(
    everyEndpoint.filter(
      (endpoint) =>
        endpoint.served === 'mock' &&
        endpoint !== adminOrgEndpoints.saveRole &&
        endpoint !== adminOrgEndpoints.deleteRole,
    ),
  )('answers the read %# with a body its contract parses', (endpoint) => {
    const reply = new FakeBackend().handle(endpoint, {
      token: null,
      params: { userId: '000004' },
      query: {},
      body: undefined,
    });
    expect(() => endpoint.response.parse(reply?.body.data)).not.toThrow();
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
