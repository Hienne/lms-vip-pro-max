import { HttpErrorResponse } from '@angular/common/http';
import { z } from 'zod';
import { ContractError } from '../http/contract-error';
import { ApiError } from '../http/api-error';
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
    [403, 'unknown', 'Có lỗi xảy ra. Vui lòng thử lại sau.'],
    [500, 'unknown', 'Có lỗi xảy ra. Vui lòng thử lại sau.'],
  ] as const)(
    'maps status %s to %s with a default message',
    (status, kind, message) => {
      expect(toAppError(http(status))).toEqual({ kind, message });
    },
  );

  it('ignores any HTTP response body', () => {
    expect(toAppError(http(401, { message: 'Sai.' })).message).toBe(
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
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

  describe('an ERROR envelope', () => {
    it('shows the backend title and message verbatim', () => {
      expect(
        toAppError(
          new ApiError('CORE-0409', 'Trùng email', 'Email đã tồn tại.'),
        ),
      ).toEqual({
        kind: 'server',
        title: 'Trùng email',
        message: 'Email đã tồn tại.',
        messageCode: 'CORE-0409',
      });
    });

    it('maps CORE-0401 to unauthorized', () => {
      const error = toAppError(
        new ApiError('CORE-0401', 'Cần đăng nhập', 'Hết phiên.'),
      );
      expect(error.kind).toBe('unauthorized');
      expect(error.messageCode).toBe('CORE-0401');
    });

    it('falls back to the Vietnamese default when the backend sent no message', () => {
      const error = toAppError(new ApiError('CORE-0500', undefined, undefined));
      expect(error).toEqual({
        kind: 'server',
        message: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
        messageCode: 'CORE-0500',
      });
    });
  });
});
