import {
  AccessRequestSchema,
  AccessRequestsQuerySchema,
  ApproveAccessRequestCommandSchema,
  PasswordResetRequestCommandSchema,
  ResetPasswordCommandSchema,
  ResetPasswordResultSchema,
  RegisterRequestCommandSchema,
  RegistrationUnitSchema,
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

  it('limits the approval note like the rejection note', () => {
    expect(ApproveAccessRequestCommandSchema.parse({})).toEqual({});
    expect(() =>
      ApproveAccessRequestCommandSchema.parse({ note: 'x'.repeat(501) }),
    ).toThrow();
  });
});

describe('RegisterRequestCommandSchema', () => {
  const ok = {
    staffCode: '000321',
    fullName: 'Nguyễn Văn An',
    email: 'an@example.test',
    orgId: 1,
    password: 'Demo@123',
  };

  it('accepts exactly the form fields and keeps the staff code a string', () => {
    expect(RegisterRequestCommandSchema.parse(ok)).toEqual(ok);
  });

  it('refuses extra fields such as a confirmation or a role', () => {
    expect(() =>
      RegisterRequestCommandSchema.parse({ ...ok, confirmPassword: 'x' }),
    ).toThrow();
    expect(() =>
      RegisterRequestCommandSchema.parse({ ...ok, roleId: 1 }),
    ).toThrow();
  });

  it('applies the staff code, email and password rules', () => {
    expect(() =>
      RegisterRequestCommandSchema.parse({ ...ok, staffCode: 'a b' }),
    ).toThrow();
    expect(() =>
      RegisterRequestCommandSchema.parse({ ...ok, staffCode: 'x'.repeat(21) }),
    ).toThrow();
    expect(() =>
      RegisterRequestCommandSchema.parse({ ...ok, email: 'not-an-email' }),
    ).toThrow();
    expect(() =>
      RegisterRequestCommandSchema.parse({ ...ok, password: '12345' }),
    ).toThrow();
    // 37 two-byte characters are 74 bytes: over the bcrypt limit though under 72 characters.
    expect(() =>
      RegisterRequestCommandSchema.parse({ ...ok, password: 'ế'.repeat(37) }),
    ).toThrow();
  });
});

describe('RegistrationUnitSchema', () => {
  it('carries only the id and the name', () => {
    expect(RegistrationUnitSchema.parse({ orgId: 3, name: 'Ban A' })).toEqual({
      orgId: 3,
      name: 'Ban A',
    });
    expect(() =>
      RegistrationUnitSchema.parse({ orgId: 3, name: 'Ban A', code: 'X' }),
    ).toThrow();
  });
});

describe('password reset contracts', () => {
  it('takes only a staff code, and refuses extra fields or a bad code', () => {
    expect(
      PasswordResetRequestCommandSchema.parse({ staffCode: '000004' }),
    ).toEqual({
      staffCode: '000004',
    });
    expect(() =>
      PasswordResetRequestCommandSchema.parse({
        staffCode: '000004',
        email: 'a@b.c',
      }),
    ).toThrow();
    expect(() =>
      PasswordResetRequestCommandSchema.parse({ staffCode: 'a b' }),
    ).toThrow();
  });

  it('limits the reset note like the other notes', () => {
    expect(ResetPasswordCommandSchema.parse({})).toEqual({});
    expect(() =>
      ResetPasswordCommandSchema.parse({ note: 'x'.repeat(501) }),
    ).toThrow();
  });

  it('carries the temporary password only in the reset result, never in a row', () => {
    expect(() => ResetPasswordResultSchema.parse({ request: row })).toThrow();
    expect(() =>
      ResetPasswordResultSchema.parse({ request: row, temporaryPassword: '' }),
    ).toThrow();
    expect(
      ResetPasswordResultSchema.parse({
        request: row,
        temporaryPassword: 'Ab3dEf7hJk9m',
      }).temporaryPassword,
    ).toBe('Ab3dEf7hJk9m');
    expect(() =>
      AccessRequestSchema.parse({ ...row, temporaryPassword: 'x' }),
    ).toThrow();
  });
});
