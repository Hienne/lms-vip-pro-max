import {
  authV1Endpoints,
  CreatedExternalConnectionSchema,
  ExternalAssistantStatusSchema,
  ExternalConnectionSchema,
  externalConnectionEndpoints,
  OAuthConsentRequestSchema,
  OAuthConsentResultSchema,
  oauthConsentEndpoints,
} from '@lms/contracts';
import { z } from 'zod';
import { FakeBackend, type FakeRequest } from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';

const request = (
  token: string | null,
  body: unknown = undefined,
  params: Record<string, string> = {},
): FakeRequest => ({ token, params, query: {}, body });

describe('ExternalConnectionMock in the fake backend', () => {
  let backend: FakeBackend;
  const signIn = (username: string): string =>
    (
      backend.handle(
        authV1Endpoints.login,
        request(null, { username, password: SEED_PASSWORD }),
      )?.body.data as { accessToken: string }
    ).accessToken;

  beforeEach(() => {
    backend = new FakeBackend();
  });

  it('lets an instructor create, list and revoke a connection, the token once', () => {
    const token = signIn('giangvien');
    const created = backend.handle(
      externalConnectionEndpoints.create,
      request(token, { name: 'Laptop', validDays: 30 }),
    );
    const data = CreatedExternalConnectionSchema.parse(created?.body.data);
    expect(data.token.startsWith(data.connection.tokenPrefix ?? '-')).toBe(
      true,
    );

    const listed = backend.handle(
      externalConnectionEndpoints.list,
      request(token),
    );
    const rows = z.array(ExternalConnectionSchema).parse(listed?.body.data);
    expect(rows.map((row) => row.name)).toEqual(['Laptop']);
    expect(JSON.stringify(listed?.body)).not.toContain(data.token);

    const revoked = backend.handle(
      externalConnectionEndpoints.revoke,
      request(token, undefined, { connectionId: String(data.connection.id) }),
    );
    expect(revoked?.body.status).toBe('SUCCESS');
    expect(
      backend.handle(externalConnectionEndpoints.list, request(token))?.body
        .data,
    ).toEqual([]);
  });

  it('tells a learner they may not, and refuses their calls', () => {
    const token = signIn('hocvien');
    const status = backend.handle(
      externalConnectionEndpoints.status,
      request(token),
    );
    expect(ExternalAssistantStatusSchema.parse(status?.body.data)).toEqual({
      enabled: true,
      allowed: false,
    });
    expect(
      backend.handle(externalConnectionEndpoints.list, request(token))?.status,
    ).toBe(403);
  });

  it('answers 404 to all but the status while the flag is off', () => {
    const token = signIn('giangvien');
    backend.externalConnections.enabled = false;
    expect(
      backend.handle(externalConnectionEndpoints.status, request(token))?.body
        .data,
    ).toEqual({ enabled: false, allowed: false });
    expect(
      backend.handle(externalConnectionEndpoints.list, request(token))?.status,
    ).toBe(404);
  });

  it('answers a seeded Cho phép kết nối request once: approve lists an oauth connection', () => {
    const token = signIn('giangvien');
    backend.externalConnections.seedRequest('r1');
    const params = { requestId: 'r1' };

    const shown = OAuthConsentRequestSchema.parse(
      backend.handle(
        oauthConsentEndpoints.read,
        request(token, undefined, params),
      )?.body.data,
    );
    expect(shown).toMatchObject({
      clientName: 'Claude',
      redirectHost: 'claude.ai',
    });

    const result = OAuthConsentResultSchema.parse(
      backend.handle(
        oauthConsentEndpoints.approve,
        request(token, undefined, params),
      )?.body.data,
    );
    expect(result.redirectUrl).toContain('code=');
    const rows = z
      .array(ExternalConnectionSchema)
      .parse(
        backend.handle(externalConnectionEndpoints.list, request(token))?.body
          .data,
      );
    expect(rows).toMatchObject([
      { kind: 'oauth', name: 'Claude', tokenPrefix: null },
    ]);
    expect(
      backend.handle(
        oauthConsentEndpoints.read,
        request(token, undefined, params),
      )?.body.messageCode,
    ).toBe('CORE-RESOURCE_NOT_FOUND');
  });

  it('sends access_denied back on Từ chối', () => {
    const token = signIn('giangvien');
    backend.externalConnections.seedRequest('r2');
    const result = OAuthConsentResultSchema.parse(
      backend.handle(
        oauthConsentEndpoints.deny,
        request(token, undefined, { requestId: 'r2' }),
      )?.body.data,
    );
    expect(result.redirectUrl).toContain('error=access_denied');
  });
});
