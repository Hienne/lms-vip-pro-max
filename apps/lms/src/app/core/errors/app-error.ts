import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorSchema } from '@lms/contracts';
import { ContractError } from '../http/contract-error';

export type AppErrorKind =
  | 'offline'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'invalid'
  | 'locked'
  | 'contract'
  | 'unknown';

export interface AppError {
  readonly kind: AppErrorKind;
  /** Vietnamese, ready to render. */
  readonly message: string;
  /** Field to message; only on `invalid`. */
  readonly details?: Readonly<Record<string, string>>;
}

/** Default messages, taken from the mockup's `E.*` helpers. */
const DEFAULT_MESSAGE: Record<AppErrorKind, string> = {
  offline: 'Không có kết nối mạng. Kiểm tra kết nối và thử lại.',
  unauthorized: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  forbidden: 'Bạn không có quyền thực hiện thao tác này.',
  'not-found': 'Dữ liệu không tồn tại hoặc đã bị xóa.',
  invalid: 'Vui lòng kiểm tra lại thông tin.',
  locked: 'Tài khoản đã bị khóa.',
  contract: 'Dữ liệu trả về không hợp lệ. Vui lòng thử lại sau.',
  unknown: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
};

/** Shown once when the server ends the session mid-use. */
export const SESSION_EXPIRED_MESSAGE = DEFAULT_MESSAGE.unauthorized;

const KIND_BY_STATUS: Record<number, AppErrorKind> = {
  0: 'offline',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  422: 'invalid',
  423: 'locked',
};

/** The one place that turns transport and contract failures into an `AppError`. */
export function toAppError(error: unknown): AppError {
  if (error instanceof ContractError) {
    return { kind: 'contract', message: DEFAULT_MESSAGE.contract };
  }
  if (error instanceof HttpErrorResponse) {
    const kind = KIND_BY_STATUS[error.status] ?? 'unknown';
    const body = ApiErrorSchema.safeParse(error.error);
    return {
      kind,
      message: body.success ? body.data.message : DEFAULT_MESSAGE[kind],
      ...(kind === 'invalid' && body.success && body.data.details
        ? { details: body.data.details }
        : {}),
    };
  }
  return { kind: 'unknown', message: DEFAULT_MESSAGE.unknown };
}
