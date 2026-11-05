import {
  AccessRequestSchema,
  AccessRequestsQuerySchema,
  RejectAccessRequestCommandSchema,
} from './access-request.schema';

const row = {
  requestId: 7,
  kind: 'PASSWORD_RESET',
  status: 'PENDING',
  staffCode: '000123',
  fullName: null,
  email: null,
  orgId: null,
  orgName: null,
  targetUserId: null,
  accountFound: false,
  createdTime: '2026-11-05T08:00:00+07:00',
  resolvedBy: null,
  resolvedTime: null,
  resolutionNote: null,
};

describe('access request schemas', () => {
  it('parses a request with no matching account and no unit', () => {
    expect(AccessRequestSchema.parse(row)).toEqual(row);
  });

  it('keeps the staff code a string with its leading zeros', () => {
    expect(AccessRequestSchema.parse(row).staffCode).toBe('000123');
  });

  it('never accepts a password or a hash on a row', () => {
    expect(() =>
      AccessRequestSchema.parse({ ...row, passwordHash: 'x' }),
    ).toThrow();
  });

  it('knows exactly two kinds and three statuses', () => {
    expect(() =>
      AccessRequestSchema.parse({ ...row, kind: 'OTHER' }),
    ).toThrow();
    expect(() =>
      AccessRequestSchema.parse({ ...row, status: 'CANCELLED' }),
    ).toThrow();
  });

  it('takes the list filters and the page query', () => {
    expect(
      AccessRequestsQuerySchema.parse({
        kind: 'REGISTER',
        status: 'PENDING',
        q: 'an',
        page: 0,
        size: 20,
      }),
    ).toEqual({
      kind: 'REGISTER',
      status: 'PENDING',
      q: 'an',
      page: 0,
      size: 20,
    });
    expect(() => AccessRequestsQuerySchema.parse({ size: 101 })).toThrow();
  });

  it('limits the rejection note to 500 characters and makes it optional', () => {
    expect(RejectAccessRequestCommandSchema.parse({})).toEqual({});
    expect(
      RejectAccessRequestCommandSchema.parse({ note: 'x'.repeat(500) }),
    ).toEqual({ note: 'x'.repeat(500) });
    expect(() =>
      RejectAccessRequestCommandSchema.parse({ note: 'x'.repeat(501) }),
    ).toThrow();
  });
});
