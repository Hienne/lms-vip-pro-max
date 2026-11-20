import { toUrl } from '../http/endpoint';
import { externalConnectionEndpoints } from './external-connection.endpoints';
import {
  CreatedExternalConnectionSchema,
  CreateExternalConnectionCommandSchema,
  ExternalAssistantStatusSchema,
  ExternalConnectionSchema,
} from './external-connection.schema';

const connection = {
  id: 7,
  name: 'Laptop cơ quan',
  tokenPrefix: 'chan_ext_ab12',
  createTime: '2026-11-18T09:00:00+07:00',
  expiresAt: '2026-12-18T09:00:00+07:00',
  lastUsedAt: null,
};

describe('external connection contracts', () => {
  it('parses the status, a connection and a created connection as the server sends them', () => {
    expect(
      ExternalAssistantStatusSchema.parse({ enabled: true, allowed: false }),
    ).toEqual({ enabled: true, allowed: false });
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
