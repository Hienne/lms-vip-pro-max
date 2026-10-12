import { HttpErrorResponse } from '@angular/common/http';
import { z } from 'zod';
import { ContractError } from '../http/contract-error';
import { toAppError } from './app-error';

function http(status: number, error?: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error });
}

describe('toAppError', () => {
  it.each([
    [0, 'offline', 'Không có kết nối mạng. Kiểm tra kết nối và thử lại.'],
    [
      401,
      'unauthorized',
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    ],
    [403, 'forbidden', 'Bạn không có quyền thực hiện thao tác này.'],
    [404, 'not-found', 'Dữ liệu không tồn tại hoặc đã bị xóa.'],
    [422, 'invalid', 'Vui lòng kiểm tra lại thông tin.'],
    [423, 'locked', 'Tài khoản đã bị khóa.'],
    [500, 'unknown', 'Có lỗi xảy ra. Vui lòng thử lại sau.'],
  ] as const)(
    'maps status %s to %s with a default message',
    (status, kind, message) => {
      expect(toAppError(http(status))).toEqual({ kind, message });
    },
  );

  it('uses the server message when the body is an ApiError', () => {
    const error = toAppError(
      http(401, { message: 'Email hoặc mật khẩu không đúng.' }),
    );
    expect(error).toEqual({
      kind: 'unauthorized',
      message: 'Email hoặc mật khẩu không đúng.',
    });
  });

  it('keeps field details on 422', () => {
    const error = toAppError(
      http(422, { message: 'Sai.', details: { email: 'Nhập email.' } }),
    );
    expect(error).toEqual({
      kind: 'invalid',
      message: 'Sai.',
      details: { email: 'Nhập email.' },
    });
  });

  it('ignores a body that is not an ApiError', () => {
    expect(toAppError(http(404, '<html>')).message).toBe(
      'Dữ liệu không tồn tại hoặc đã bị xóa.',
    );
  });

  it('maps ContractError to contract', () => {
    const result = z.object({ a: z.string() }).safeParse({});
    const error = toAppError(new ContractError(result.error!.issues));
    expect(error.kind).toBe('contract');
    expect(error.message).toBe(
      'Dữ liệu trả về không hợp lệ. Vui lòng thử lại sau.',
    );
  });

  it('maps anything else to unknown', () => {
    expect(toAppError(new Error('boom')).kind).toBe('unknown');
    expect(toAppError(undefined).kind).toBe('unknown');
  });
});
