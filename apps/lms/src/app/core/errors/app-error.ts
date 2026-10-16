import { HttpErrorResponse } from '@angular/common/http';
import { MESSAGE_CODE_KIND } from '@lms/contracts';
import { ApiError } from '../http/api-error';
import { ContractError } from '../http/contract-error';

export type AppErrorKind =
  | 'offline'
  | 'unauthorized'
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
}

/** Vietnamese defaults for failures the backend did not explain itself. */
const DEFAULT_MESSAGE: Record<AppErrorKind, string> = {
  offline: 'Không có kết nối mạng. Kiểm tra kết nối và thử lại.',
  unauthorized: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  server: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
  contract: 'Dữ liệu trả về không hợp lệ. Vui lòng thử lại sau.',
  unknown: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
};

/** Shown once when the server ends the session mid-use. */
export const SESSION_EXPIRED_MESSAGE = DEFAULT_MESSAGE.unauthorized;

const KIND_BY_STATUS: Record<number, AppErrorKind> = {
  0: 'offline',
  401: 'unauthorized',
};

/** The one place that turns transport and contract failures into an `AppError`. */
export function toAppError(error: unknown): AppError {
  if (error instanceof ApiError) {
    const kind: AppErrorKind =
      (MESSAGE_CODE_KIND as Record<string, AppErrorKind>)[error.messageCode] ??
      'server';
    return {
      kind,
      message: error.serverMessage || DEFAULT_MESSAGE[kind],
      ...(error.title ? { title: error.title } : {}),
      messageCode: error.messageCode,
    };
  }
  if (error instanceof ContractError) {
    return { kind: 'contract', message: DEFAULT_MESSAGE.contract };
  }
  if (error instanceof HttpErrorResponse) {
    const kind = KIND_BY_STATUS[error.status] ?? 'unknown';
    return { kind, message: DEFAULT_MESSAGE[kind] };
  }
  return { kind: 'unknown', message: DEFAULT_MESSAGE.unknown };
}
