import { toUrl } from '../http/endpoint';
import {
  externalConnectionEndpoints,
  oauthConsentEndpoints,
} from './external-connection.endpoints';
import {
  CreatedExternalConnectionSchema,
  CreateExternalConnectionCommandSchema,
  ExternalAssistantStatusSchema,
  ExternalConnectionSchema,
  OAuthConsentRequestSchema,
  OAuthConsentResultSchema,
} from './external-connection.schema';

const connection = {
  id: 7,
  name: 'Laptop cơ quan',
  kind: 'token',
  tokenPrefix: 'chan_ext_ab12',
  createTime: '2026-11-18T09:00:00+07:00',
  expiresAt: '2026-12-18T09:00:00+07:00',
  lastUsedAt: null,
};

describe('external connection contracts', () => {
  it('parses the status, a connection and a created connection as the server sends them', () => {
    expect(
      ExternalAssistantStatusSchema.parse({
        enabled: true,
        allowed: false,
        mcpUrl: 'https://lms.example/api/v1/mcp',
      }),
    ).toEqual({
      enabled: true,
      allowed: false,
      mcpUrl: 'https://lms.example/api/v1/mcp',
    });
    expect(() =>
      ExternalAssistantStatusSchema.parse({
        enabled: true,
        allowed: true,
        mcpUrl: 'javascript:alert(1)',
      }),
    ).toThrow();
    expect(ExternalConnectionSchema.parse(connection)).toEqual(connection);
    expect(
      ExternalConnectionSchema.parse({
        ...connection,
        lastUsedAt: '2026-11-18T10:00:00Z',
      }).lastUsedAt,
    ).toBe('2026-11-18T10:00:00Z');
    expect(
      CreatedExternalConnectionSchema.parse({
        connection,
        token: 'chan_ext_secret',
      }).token,
    ).toBe('chan_ext_secret');
  });

  it('parses an oauth connection, which has no token prefix', () => {
    const oauth = {
      ...connection,
      kind: 'oauth',
      name: 'Claude',
      tokenPrefix: null,
    };
    expect(ExternalConnectionSchema.parse(oauth)).toEqual(oauth);
    expect(
      ExternalConnectionSchema.safeParse({ ...connection, kind: 'other' })
        .success,
    ).toBe(false);
  });

  it('parses the Cho phép kết nối request and its result', () => {
    const request = {
      clientName: 'Claude',
      redirectHost: 'claude.ai',
      idleDays: 30,
      atLimit: false,
      maxConnections: 10,
    };
    expect(OAuthConsentRequestSchema.parse(request)).toEqual(request);
    expect(
      OAuthConsentResultSchema.parse({
        redirectUrl: 'http://127.0.0.1:53682/callback?code=abc&state=s',
      }).redirectUrl,
    ).toContain('code=abc');
    expect(
      OAuthConsentResultSchema.safeParse({ redirectUrl: 'not a url' }).success,
    ).toBe(false);
    expect(toUrl(oauthConsentEndpoints.approve, { requestId: 'abc_123' })).toBe(
      '/api/v1/assistant/oauth-requests/abc_123/approve',
    );
  });

  it('refuses a token without the connection prefix', () => {
    expect(
      CreatedExternalConnectionSchema.safeParse({ connection, token: 'eyJ' })
        .success,
    ).toBe(false);
  });

  it('accepts only 30 or 90 days and a name of 1 to 100 characters', () => {
    const valid = { name: '  Laptop  ', validDays: 90 };
    expect(CreateExternalConnectionCommandSchema.parse(valid).name).toBe(
      'Laptop',
    );
    for (const command of [
      { name: 'Laptop', validDays: 60 },
      { name: '   ', validDays: 30 },
      { name: 'x'.repeat(101), validDays: 30 },
    ]) {
      expect(
        CreateExternalConnectionCommandSchema.safeParse(command).success,
      ).toBe(false);
    }
  });

  it('builds the paths of the endpoints', () => {
    expect(toUrl(externalConnectionEndpoints.status)).toBe(
      '/api/v1/assistant/external-connections/status',
    );
    expect(toUrl(externalConnectionEndpoints.revoke, { connectionId: 7 })).toBe(
      '/api/v1/assistant/external-connections/7',
    );
  });
});
