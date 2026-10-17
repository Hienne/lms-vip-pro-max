import { EnvelopeSchema, MESSAGE_CODE_KIND } from './envelope';

const success = {
  responseId: '53ed5e25-0d34-46e0-84ee-ce65ce9c9b7d',
  timestamp: '2026-10-16T08:04:34.801128100Z',
  status: 'SUCCESS',
  messageCode: 'CORE-SUCCESS',
  message: 'OK',
  messageTitle: 'Success',
  data: { id: 'a' },
};

describe('EnvelopeSchema', () => {
  it('accepts a success envelope and keeps its data untouched', () => {
    expect(EnvelopeSchema.parse(success).data).toEqual({ id: 'a' });
  });

  it('accepts an error envelope with no data', () => {
    const body = {
      ...success,
      status: 'ERROR',
      messageCode: 'CORE-UNAUTHENTICATED',
      data: null,
    };
    expect(EnvelopeSchema.parse(body).status).toBe('ERROR');
  });

  it('rejects an unknown status and a missing message code', () => {
    expect(EnvelopeSchema.safeParse({ ...success, status: 'OK' }).success).toBe(
      false,
    );
    expect(
      EnvelopeSchema.safeParse({ ...success, messageCode: undefined }).success,
    ).toBe(false);
  });

  it('rejects a bare payload that is not an envelope', () => {
    expect(EnvelopeSchema.safeParse({ id: 'a' }).success).toBe(false);
    expect(EnvelopeSchema.safeParse(null).success).toBe(false);
  });
});

describe('MESSAGE_CODE_KIND', () => {
  it('branches on the authentication, permission and temporary-password codes', () => {
    expect(MESSAGE_CODE_KIND).toEqual({
      'CORE-UNAUTHENTICATED': 'unauthorized',
      'CORE-ACCESS_DENIED': 'forbidden',
      'IDENTITY-PASSWORD_CHANGE_REQUIRED': 'passwordChangeRequired',
    });
  });
});
