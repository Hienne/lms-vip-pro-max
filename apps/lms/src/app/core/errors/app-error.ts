import { HttpErrorResponse } from '@angular/common/http';
import { MESSAGE_CODE_KIND, type FieldError } from '@lms/contracts';
import { ApiError } from '../http/api-error';
import { ContractError } from '../http/contract-error';

export type AppErrorKind =
  | 'offline'
  | 'unauthorized'
  | 'forbidden'
  /** A valid request the server will not apply as it is (a session moved, a version changed). */
  | 'refused'
  | 'server'
  | 'contract'
  | 'unknown';

export interface AppError {
  readonly kind: AppErrorKind;
  /** Vietnamese, ready to render. */
  readonly message: string;
  /** The backend's heading for the failure, when it sent one. */
  readonly title?: string;
  /** The backend's `messageCode`, on failures that came from an `ERROR` envelope. */
  readonly messageCode?: string;
  /** The HTTP status of the answer that carried the envelope. */
  readonly httpStatus?: number;
  /** The call's `responseId`, for the "Mã tra cứu" line of a system failure. */
  readonly responseId?: string;
  /** Per-field details of the refusal, when the envelope carried any. */
  readonly fieldErrors?: readonly FieldError[];
}

/** Vietnamese defaults for failures the backend did not explain itself. */
const DEFAULT_MESSAGE: Record<AppErrorKind, string> = {
  offline: 'Không có kết nối mạng. Kiểm tra kết nối và thử lại.',
  unauthorized: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  forbidden: 'Bạn không có quyền thực hiện thao tác này.',
  refused: 'Chưa thể thực hiện thao tác này. Vui lòng thử lại.',
  server: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
  contract: 'Dữ liệu trả về không hợp lệ. Vui lòng thử lại sau.',
  unknown: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
};

/** Shown once when the server ends the session mid-use. */
export const SESSION_EXPIRED_MESSAGE = DEFAULT_MESSAGE.unauthorized;

const CODE_KIND: Readonly<Record<string, AppErrorKind>> = MESSAGE_CODE_KIND;

const KIND_BY_STATUS: Record<number, AppErrorKind> = {
  0: 'offline',
  401: 'unauthorized',
  403: 'forbidden',
};

/**
 * The one table for the kind of a failure: a code the app branches on wins, then the HTTP status
 * (so any 401 is `unauthorized`, whatever its code), then `fallback`.
 */
function kindOf(
  status: number,
  code: string | undefined,
  fallback: AppErrorKind,
): AppErrorKind {
  return (
    (code === undefined ? undefined : CODE_KIND[code]) ??
    KIND_BY_STATUS[status] ??
    fallback
  );
}

/** The one place that turns transport and contract failures into an `AppError`. */
export function toAppError(error: unknown): AppError {
  if (error instanceof ApiError) {
    const kind = kindOf(error.httpStatus, error.messageCode, 'server');
    return {
      kind,
      message: error.serverMessage || DEFAULT_MESSAGE[kind],
      ...(error.title ? { title: error.title } : {}),
      messageCode: error.messageCode,
      httpStatus: error.httpStatus,
      ...(error.responseId ? { responseId: error.responseId } : {}),
      ...(error.fieldErrors.length ? { fieldErrors: error.fieldErrors } : {}),
    };
  }
  if (error instanceof ContractError) {
    return { kind: 'contract', message: DEFAULT_MESSAGE.contract };
  }
  if (error instanceof HttpErrorResponse) {
    const kind = kindOf(error.status, undefined, 'unknown');
    return { kind, message: DEFAULT_MESSAGE[kind] };
  }
  return { kind: 'unknown', message: DEFAULT_MESSAGE.unknown };
}
