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
    [403, 'forbidden', 'Bạn không có quyền thực hiện thao tác này.'],
    [500, 'unknown', 'Có lỗi xảy ra. Vui lòng thử lại sau.'],
  ] as const)(
    'maps status %s to %s with a default message',
    (status, kind, message) => {
      expect(toAppError(http(status))).toEqual({ kind, message });
    },
  );

  it('ignores the body of a response that is not an envelope', () => {
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
    it('shows the backend title and message verbatim, with the status and response id', () => {
      expect(
        toAppError(
          new ApiError(
            'ORGANIZATION-TEAM_IN_USE',
            'Nhóm đang được sử dụng',
            'Không thể xóa nhóm.',
            200,
            'req-1',
          ),
        ),
      ).toEqual({
        kind: 'server',
        title: 'Nhóm đang được sử dụng',
        message: 'Không thể xóa nhóm.',
        messageCode: 'ORGANIZATION-TEAM_IN_USE',
        httpStatus: 200,
        responseId: 'req-1',
      });
    });

    it.each([
      ['CORE-UNAUTHENTICATED', 401, 'unauthorized'],
      ['CORE-ACCESS_DENIED', 403, 'forbidden'],
      ['IDENTITY-PASSWORD_CHANGE_REQUIRED', 403, 'passwordChangeRequired'],
      ['IDENTITY-CREDENTIALS_INVALID', 401, 'server'],
      ['CORE-INTERNAL_ERROR', 500, 'server'],
    ] as const)('maps %s (HTTP %s) to %s', (code, status, kind) => {
      const error = toAppError(
        new ApiError(code, 'Tiêu đề', 'Nội dung.', status),
      );
      expect(error).toMatchObject({
        kind,
        messageCode: code,
        httpStatus: status,
        message: 'Nội dung.',
      });
    });

    it('falls back to the Vietnamese default when the backend sent no message', () => {
      const error = toAppError(new ApiError('CORE-0500', undefined, undefined));
      expect(error).toEqual({
        kind: 'server',
        message: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
        messageCode: 'CORE-0500',
        httpStatus: 200,
      });
    });

    it('falls back to the default of its kind for a 403 without a message', () => {
      expect(
        toAppError(
          new ApiError('CORE-ACCESS_DENIED', undefined, undefined, 403),
        ).message,
      ).toBe('Bạn không có quyền thực hiện thao tác này.');
    });
  });
});
