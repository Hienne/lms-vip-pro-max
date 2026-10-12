import { ApiErrorSchema } from './api-error';

describe('ApiErrorSchema', () => {
  it('accepts a message alone', () => {
    expect(ApiErrorSchema.parse({ message: 'Lỗi' })).toEqual({
      message: 'Lỗi',
    });
  });

  it('accepts field-to-message details', () => {
    const body = { message: 'Sai', details: { email: 'Nhập email.' } };
    expect(ApiErrorSchema.parse(body)).toEqual(body);
  });

  it('rejects a missing message and non-string details', () => {
    expect(ApiErrorSchema.safeParse({}).success).toBe(false);
    expect(
      ApiErrorSchema.safeParse({ message: 'x', details: { a: 1 } }).success,
    ).toBe(false);
  });
});
