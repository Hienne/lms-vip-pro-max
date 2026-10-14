import type { ApiError, ErrorStatus } from '@lms/contracts';
import {
  demoAccountFixtures,
  loginDemoLocked,
  loginDemoNotFound,
  loginInvalid,
  loginLocked,
  loginResult,
  loginUnauthorized,
  profileFixtures,
  profileUnauthorized,
} from './auth/auth.fixtures';
import { healthOk } from './health/health.fixtures';
import { navCountsFixtures } from './shell/shell.fixtures';

/** Named response examples of one endpoint; `default` is the 2xx body. */
export interface EndpointExamples {
  readonly default: unknown;
  /** Role-dependent bodies, keyed `learner`, `admin`, ... */
  readonly roles?: Readonly<Record<string, unknown>>;
  /** Bodies for this endpoint's declared error statuses; override `errorExamples`. */
  readonly errors?: Readonly<Partial<Record<ErrorStatus, ApiError>>>;
}

/** Keyed by operation id, which is the endpoint key in its registry. */
export const endpointExamples: Readonly<Record<string, EndpointExamples>> = {
  health: { default: healthOk },
  login: {
    default: loginResult,
    errors: { 401: loginUnauthorized, 422: loginInvalid, 423: loginLocked },
  },
  loginDemo: {
    default: loginResult,
    errors: { 404: loginDemoNotFound, 423: loginDemoLocked },
  },
  logout: { default: true },
  profile: {
    default: profileFixtures['learner'],
    roles: profileFixtures,
    errors: { 401: profileUnauthorized },
  },
  demoAccounts: { default: demoAccountFixtures },
  navCounts: {
    default: navCountsFixtures['learner'],
    roles: navCountsFixtures,
  },
};

/** Generic error bodies (mockup `E.*` messages) used when an endpoint declares the status. */
export const errorExamples: Readonly<Record<ErrorStatus, ApiError>> = {
  400: { message: 'Yêu cầu không hợp lệ.' },
  401: { message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' },
  403: { message: 'Bạn không có quyền thực hiện thao tác này.' },
  404: { message: 'Dữ liệu không tồn tại hoặc đã bị xóa.' },
  409: { message: 'Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.' },
  422: {
    message: 'Vui lòng kiểm tra lại thông tin.',
    details: { field: 'Giá trị không hợp lệ.' },
  },
  423: { message: 'Tài khoản đã bị khóa.' },
  500: { message: 'Có lỗi xảy ra. Vui lòng thử lại sau.' },
};
