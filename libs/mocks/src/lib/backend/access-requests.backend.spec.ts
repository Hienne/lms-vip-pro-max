import {
  AccessRequestSchema,
  authV1Endpoints,
  identityEndpoints,
  PageSchema,
  type AccessRequest,
  type AnyEndpoint,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from './fake-backend';
import { SEED_PASSWORD } from './seed';

describe('FakeBackend access requests', () => {
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

  const list = (token: string, query: Record<string, string> = {}) =>
    call(identityEndpoints.accessRequests, token, { query });
  const items = (reply: FakeReply): AccessRequest[] =>
    PageSchema(AccessRequestSchema).parse(reply.body.data).items;

  it('lists the five fixture rows to a global admin and parses every row', () => {
    const reply = list(login('quantri'));
    expect(reply.status).toBe(200);
    expect(items(reply)).toHaveLength(5);
  });

  it('filters by kind, status and text', () => {
    const token = login('quantri');
    expect(
      items(list(token, { kind: 'REGISTER' })).every(
        (r) => r.kind === 'REGISTER',
      ),
    ).toBe(true);
    const pending = items(list(token, { status: 'PENDING' }));
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((r) => r.status === 'PENDING')).toBe(true);
    const found = items(list(token, { q: pending[0].staffCode }));
    expect(found.map((r) => r.staffCode)).toContain(pending[0].staffCode);
  });

  it('includes a reset request that matched no account', () => {
    const rows = items(list(login('quantri')));
    expect(
      rows.some((r) => r.kind === 'PASSWORD_RESET' && !r.accountFound),
    ).toBe(true);
  });

  it('hides a row outside the unit of a unit admin, and global-only rows', () => {
    const all = items(list(login('quantri')));
    const scoped = items(list(login('quantri.ban')));
    expect(scoped.length).toBeLessThan(all.length);
    expect(scoped.every((r) => r.orgId === 1)).toBe(true);
  });

  it('refuses a caller without USER_MANAGEMENT', () => {
    const reply = list(login('hocvien'));
    expect(reply.status).toBe(403);
  });

  it('rejects a pending request with a note and keeps it resolved', () => {
    const token = login('quantri');
    const id = items(list(token, { status: 'PENDING' }))[0].requestId;
    const reply = call(identityEndpoints.rejectAccessRequest, token, {
      params: { requestId: String(id) },
      body: { note: 'Không đúng đối tượng' },
    });
    expect(reply.status).toBe(200);
    const row = AccessRequestSchema.parse(reply.body.data);
    expect(row).toMatchObject({
      status: 'REJECTED',
      resolvedBy: '000002',
      resolutionNote: 'Không đúng đối tượng',
    });
    expect(
      items(list(token, { status: 'PENDING' })).map((r) => r.requestId),
    ).not.toContain(id);
  });

  it('answers a state conflict when the request is already resolved', () => {
    const token = login('quantri');
    const id = items(list(token, { status: 'PENDING' }))[0].requestId;
    const reject = () =>
      call(identityEndpoints.rejectAccessRequest, token, {
        params: { requestId: String(id) },
        body: {},
      });
    reject();
    expect(reject().body.messageCode).toBe('CORE-STATE_CONFLICT');
  });

  it('cannot reject a request outside the caller scope, nor without the function', () => {
    const outside = items(list(login('quantri'))).find((r) => r.orgId !== 1);
    expect(outside).toBeDefined();
    const unitAdmin = call(
      identityEndpoints.rejectAccessRequest,
      login('quantri.ban'),
      {
        params: { requestId: String(outside?.requestId) },
        body: {},
      },
    );
    expect(unitAdmin.body.messageCode).toBe('CORE-RESOURCE_NOT_FOUND');
    const learner = call(
      identityEndpoints.rejectAccessRequest,
      login('hocvien'),
      {
        params: { requestId: '1' },
        body: {},
      },
    );
    expect(learner.status).toBe(403);
  });
});
