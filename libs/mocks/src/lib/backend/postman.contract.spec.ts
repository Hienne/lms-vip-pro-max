import {
  agentEndpoints,
  AgentStreamEventSchema,
  authV1Endpoints,
  EnvelopeSchema,
  identityEndpoints,
  organizationEndpoints,
  type AnyEndpoint,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from './fake-backend';
import { POSTMAN_REQUESTS } from './postman-requests';
import { SEED_PASSWORD } from './seed';

// The backend's Postman collection has request bodies but no saved responses, so this spec runs
// its requests, in order, against the fake backend as the root account and parses every answer
// with the endpoint's schema. A contract change that the fake or the app missed fails here.

const ENDPOINTS: readonly AnyEndpoint[] = [
  ...Object.values(agentEndpoints),
  ...Object.values(authV1Endpoints),
  ...Object.values(identityEndpoints),
  ...Object.values(organizationEndpoints),
];

function templateRegex(path: string): RegExp {
  return new RegExp(`^${path.replace(/\{(\w+)\}/g, '(?<$1>[^/]+)')}$`);
}

function endpointOf(method: string, path: string) {
  for (const endpoint of ENDPOINTS) {
    if (endpoint.method !== method.toLowerCase()) continue;
    const match = templateRegex(endpoint.path).exec(path);
    if (match) return { endpoint, params: { ...match.groups } };
  }
  throw new Error(`No endpoint for ${method} ${path}`);
}

describe('the Postman collection against the fake backend', () => {
  const backend = new FakeBackend();
  const variables: Record<string, string> = {
    usernameJson: JSON.stringify('super.admin'),
    passwordJson: JSON.stringify(SEED_PASSWORD),
    newPasswordJson: JSON.stringify('Moi@12345'),
    initialPasswordJson: JSON.stringify('Tam@123456'),
    newUserId: '000900',
    newUsername: 'postman.user',
    $timestamp: '1760000000',
  };
  let token: string | null = null;
  const answers: FakeReply[] = [];

  function fill(text: string): string {
    return text.replace(/\{\{([$\w]+)\}\}/g, (_, name: string) => {
      const value = variables[name];
      if (value === undefined) throw new Error(`Variable ${name} not set`);
      return value;
    });
  }

  it.each(POSTMAN_REQUESTS.map((request) => [request.name, request] as const))(
    '%s answers a parsable envelope',
    (_, request) => {
      if (request.name === 'Huỷ yêu cầu') {
        // Confirm and cancel share one {{actionId}} in the collection, and an action runs once: the
        // user proposes again before cancelling (the confirmed value is now the current one).
        const again = backend.handle(agentEndpoints.stream, {
          token,
          params: {},
          query: {},
          body: {
            messages: [
              {
                role: 'user',
                content: 'Đổi chức danh của tôi thành Chuyên viên cao cấp',
              },
            ],
          },
        });
        const card = again?.events?.find(
          (e) => (e as { type: string }).type === 'action_required',
        ) as { action: { id: string } } | undefined;
        variables['actionId'] = card?.action.id ?? '';
      }
      const [path, search = ''] = fill(request.url).split('?');
      const { endpoint, params } = endpointOf(request.method, path);
      const query = Object.fromEntries(new URLSearchParams(search));
      const body = request.body ? JSON.parse(fill(request.body)) : undefined;
      if (endpoint.body && body !== undefined) {
        expect(() => endpoint.body?.parse(body)).not.toThrow();
      }

      const reply = backend.handle(endpoint, { token, params, query, body });
      expect(reply).toBeDefined();
      const answer = reply as FakeReply;
      answers.push(answer);
      expect(answer.status, JSON.stringify(answer.body)).toBeLessThan(300);
      const envelope = EnvelopeSchema.parse(answer.body);
      expect(envelope.status).toBe('SUCCESS');
      if (endpoint === agentEndpoints.stream) {
        // A stream answers events, not data: each line parses and the last one ends the turn.
        const events = (answer.events ?? []).map((e) =>
          AgentStreamEventSchema.parse(e),
        );
        expect(['done', 'error']).toContain(events.at(-1)?.type);
        const card = events.find((e) => e.type === 'action_required');
        if (card?.type === 'action_required') {
          variables['actionId'] = card.action.id;
        }
        return;
      }
      expect(() => endpoint.response.parse(envelope.data)).not.toThrow();

      // Fill the variables the collection's test scripts save.
      const data = envelope.data as Record<string, unknown> | unknown[] | null;
      if (endpoint === authV1Endpoints.login) {
        token = (data as { accessToken: string }).accessToken;
      }
      if (endpoint === identityEndpoints.listRoles) {
        for (const role of data as { roleId: number; code: string }[]) {
          if (role.code === 'LEARNER')
            variables['learnerRoleId'] = String(role.roleId);
          if (role.code === 'INSTRUCTOR')
            variables['instructorRoleId'] = String(role.roleId);
        }
      }
      if (endpoint === organizationEndpoints.createOrg) {
        variables['orgId'] = String((data as { id: number }).id);
      }
      if (endpoint === organizationEndpoints.createTeam) {
        variables['teamId'] = String((data as { id: number }).id);
      }
      if (endpoint === identityEndpoints.createUser) {
        variables['targetUserId'] = (
          data as { user: { userId: string } }
        ).user.userId;
      }
      if (endpoint === identityEndpoints.grantRole) {
        variables['grantId'] = String((data as { grantId: number }).grantId);
      }
      if (endpoint === authV1Endpoints.changePassword) {
        // The old token is revoked; sign in again with the new password, as a user would.
        expect(
          backend.handle(authV1Endpoints.me, {
            token,
            params: {},
            query: {},
            body: undefined,
          })?.status,
        ).toBe(401);
        const login = backend.handle(authV1Endpoints.login, {
          token: null,
          params: {},
          query: {},
          body: { username: 'super.admin', password: 'Moi@12345' },
        });
        token = (login?.body.data as { accessToken: string }).accessToken;
      }
    },
  );

  it('ran the whole collection', () => {
    expect(answers).toHaveLength(POSTMAN_REQUESTS.length);
  });
});
