import {
  CreateExternalConnectionCommandSchema,
  EXTERNAL_MCP_PATH,
  externalConnectionEndpoints,
  oauthConsentEndpoints,
  type AnyEndpoint,
  type ExternalConnection,
} from '@lms/contracts';
import { backendRefusal, BACKEND_RESPONSES } from '../backend-responses';
import type { FakeReply, FakeRequest } from '../backend/fake-backend';
import { envelopeError, envelopeOk } from '../envelope';

/** The `mcpUrl` the mock status answers: the dev server's origin, as the backend's app-base-url is. */
export const MOCK_MCP_URL = `http://localhost:4200${EXTERNAL_MCP_PATH}`;

// The backend's Kết nối trợ lý ngoài (corebanking-academy `assistant/external`) as the in-app mock:
// connections live in memory, the token is returned once and never again, and `enabled` is the
// server's feature flag (off: every endpoint but `status` answers 404, as the server does). The
// Cho phép kết nối requests a client's OAuth sign-in would leave are seeded with `seedRequest`.

const ok = (data: unknown): FakeReply => ({
  status: 200,
  body: envelopeOk(data),
});

const DAY_MS = 24 * 60 * 60 * 1000;

interface MockConnection {
  readonly owner: string;
  readonly view: ExternalConnection;
}

interface MockRequest {
  readonly clientName: string;
  readonly redirectUri: string;
  readonly state: string;
}

/** Live connections a user may hold, as the server's `MAX_LIVE_CONNECTIONS`. */
const MAX_CONNECTIONS = 10;

export class ExternalConnectionMock {
  /** The server's `app.assistant.external.enabled`. */
  enabled = true;

  private nextId = 1;
  private connections: MockConnection[] = [];
  private readonly requests = new Map<string, MockRequest>();

  answers(endpoint: AnyEndpoint): boolean {
    return [
      ...Object.values(externalConnectionEndpoints),
      ...Object.values(oauthConsentEndpoints),
    ].some((item) => item === endpoint);
  }

  /** A request a client's authorize left, as if the browser had just arrived on the page. */
  seedRequest(
    requestId: string,
    clientName = 'Claude',
    redirectUri = 'https://claude.ai/api/mcp/auth_callback',
  ): void {
    this.requests.set(requestId, {
      clientName,
      redirectUri,
      state: 'mock-state',
    });
  }

  /**
   * Answers one call of `owner`; `allowed` is whether their roles may draft with the assistant now
   * (a Soạn cùng trợ lý role and the assistant function), which the caller decides.
   */
  handle(
    endpoint: AnyEndpoint,
    request: FakeRequest,
    owner: string,
    allowed: boolean,
  ): FakeReply | undefined {
    if (!this.answers(endpoint)) return undefined;
    if (endpoint === externalConnectionEndpoints.status) {
      return ok({
        enabled: this.enabled,
        allowed: this.enabled && allowed,
        mcpUrl: MOCK_MCP_URL,
      });
    }
    if (!this.enabled) return backendRefusal('endpointNotFound');
    if (!allowed) return backendRefusal('accessDenied');
    if (endpoint === externalConnectionEndpoints.list) {
      return ok(
        this.connections
          .filter((item) => item.owner === owner)
          .map((item) => item.view)
          .reverse(),
      );
    }
    if (endpoint === externalConnectionEndpoints.create) {
      return this.create(request, owner);
    }
    if (
      endpoint === oauthConsentEndpoints.read ||
      endpoint === oauthConsentEndpoints.approve ||
      endpoint === oauthConsentEndpoints.deny
    ) {
      return this.consent(endpoint, String(request.params['requestId']), owner);
    }
    const id = Number(request.params['connectionId']);
    const before = this.connections.length;
    this.connections = this.connections.filter(
      (item) => !(item.owner === owner && item.view.id === id),
    );
    return this.connections.length === before
      ? backendRefusal('resourceNotFound')
      : ok(null);
  }

  private consent(
    endpoint: AnyEndpoint,
    requestId: string,
    owner: string,
  ): FakeReply {
    const pending = this.requests.get(requestId);
    if (!pending) return backendRefusal('resourceNotFound');
    const live = this.connections.filter((item) => item.owner === owner).length;
    if (endpoint === oauthConsentEndpoints.read) {
      return ok({
        clientName: pending.clientName,
        redirectHost: new URL(pending.redirectUri).hostname,
        idleDays: 30,
        atLimit: live >= MAX_CONNECTIONS,
        maxConnections: MAX_CONNECTIONS,
      });
    }
    const back = new URL(pending.redirectUri);
    if (endpoint === oauthConsentEndpoints.deny) {
      this.requests.delete(requestId);
      back.searchParams.set('error', 'access_denied');
      back.searchParams.set('state', pending.state);
      return ok({ redirectUrl: back.toString() });
    }
    if (live >= MAX_CONNECTIONS) {
      const { code, title } = BACKEND_RESPONSES.stateConflict;
      const message = `Bạn đã có ${MAX_CONNECTIONS} kết nối trợ lý ngoài còn hiệu lực. Hãy thu hồi bớt rồi kết nối lại.`;
      return {
        status: 200,
        body: envelopeError(code, title, message, [
          { field: 'connections', code: 'LIMIT', message },
        ]),
      };
    }
    this.requests.delete(requestId);
    const now = Date.now();
    this.connections.push({
      owner,
      view: {
        id: this.nextId++,
        name: pending.clientName,
        kind: 'oauth',
        tokenPrefix: null,
        createTime: new Date(now).toISOString(),
        expiresAt: new Date(now + 30 * DAY_MS).toISOString(),
        lastUsedAt: null,
      },
    });
    back.searchParams.set('code', `mock-code-${requestId}`);
    back.searchParams.set('state', pending.state);
    return ok({ redirectUrl: back.toString() });
  }

  private create(request: FakeRequest, owner: string): FakeReply {
    const parsed = CreateExternalConnectionCommandSchema.safeParse(
      request.body,
    );
    if (!parsed.success) {
      const { code, title, message } = BACKEND_RESPONSES.validationFailed;
      return {
        status: 200,
        body: envelopeError(code, title, message, [
          { field: 'validDays', code: 'INVALID', message },
        ]),
      };
    }
    const id = this.nextId++;
    const token = `chan_ext_mock${id}${'x'.repeat(30)}`;
    const now = Date.now();
    const view: ExternalConnection = {
      id,
      name: parsed.data.name,
      kind: 'token',
      tokenPrefix: token.slice(0, 13),
      createTime: new Date(now).toISOString(),
      expiresAt: new Date(now + parsed.data.validDays * DAY_MS).toISOString(),
      lastUsedAt: null,
    };
    this.connections.push({ owner, view });
    return ok({ connection: view, token });
  }
}
