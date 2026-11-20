import {
  CreateExternalConnectionCommandSchema,
  externalConnectionEndpoints,
  type AnyEndpoint,
  type ExternalConnection,
} from '@lms/contracts';
import { backendRefusal, BACKEND_RESPONSES } from '../backend-responses';
import type { FakeReply, FakeRequest } from '../backend/fake-backend';
import { envelopeError, envelopeOk } from '../envelope';

// The backend's Kết nối trợ lý ngoài (corebanking-academy `assistant/external`) as the in-app mock:
// connections live in memory, the token is returned once and never again, and `enabled` is the
// server's feature flag (off: every endpoint but `status` answers 404, as the server does).

const ok = (data: unknown): FakeReply => ({
  status: 200,
  body: envelopeOk(data),
});

const DAY_MS = 24 * 60 * 60 * 1000;

interface MockConnection {
  readonly owner: string;
  readonly view: ExternalConnection;
}

export class ExternalConnectionMock {
  /** The server's `app.assistant.external.enabled`. */
  enabled = true;

  private nextId = 1;
  private connections: MockConnection[] = [];

  answers(endpoint: AnyEndpoint): boolean {
    return Object.values(externalConnectionEndpoints).some(
      (item) => item === endpoint,
    );
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
      return ok({ enabled: this.enabled, allowed: this.enabled && allowed });
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
    const id = Number(request.params['connectionId']);
    const before = this.connections.length;
    this.connections = this.connections.filter(
      (item) => !(item.owner === owner && item.view.id === id),
    );
    return this.connections.length === before
      ? backendRefusal('resourceNotFound')
      : ok(null);
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
      tokenPrefix: token.slice(0, 13),
      createTime: new Date(now).toISOString(),
      expiresAt: new Date(now + parsed.data.validDays * DAY_MS).toISOString(),
      lastUsedAt: null,
    };
    this.connections.push({ owner, view });
    return ok({ connection: view, token });
  }
}
