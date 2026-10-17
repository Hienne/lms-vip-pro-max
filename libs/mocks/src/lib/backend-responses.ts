import type { Envelope } from '@lms/contracts';
import { envelopeError } from './envelope';

/**
 * Every refusal the backend can send, with its real HTTP status, code, title and message
 * (`ResponseCode`, `IdentityResponseCode` and `OrganizationResponseCode` of corebanking-academy).
 * A mock reply or a spec asks for one by key, so no test or fixture invents a code.
 */
export const BACKEND_RESPONSES = {
  validationFailed: {
    status: 200,
    code: 'CORE-VALIDATION_FAILED',
    title: 'Thông tin chưa hợp lệ',
    message: 'Dữ liệu đầu vào không hợp lệ.',
  },
  malformedRequest: {
    status: 400,
    code: 'CORE-MALFORMED_REQUEST',
    title: 'Yêu cầu không hợp lệ',
    message: 'Nội dung yêu cầu bị thiếu hoặc JSON không đúng cú pháp.',
  },
  unauthenticated: {
    status: 401,
    code: 'CORE-UNAUTHENTICATED',
    title: 'Yêu cầu đăng nhập',
    message:
      'Phiên đăng nhập không hợp lệ hoặc đã hết hiệu lực. Vui lòng đăng nhập lại.',
  },
  accessDenied: {
    status: 403,
    code: 'CORE-ACCESS_DENIED',
    title: 'Không có quyền truy cập',
    message: 'Bạn không có quyền thực hiện thao tác này.',
  },
  endpointNotFound: {
    status: 404,
    code: 'CORE-ENDPOINT_NOT_FOUND',
    title: 'Không tìm thấy dữ liệu',
    message: 'Không tìm thấy tài nguyên yêu cầu.',
  },
  resourceNotFound: {
    status: 200,
    code: 'CORE-RESOURCE_NOT_FOUND',
    title: 'Không tìm thấy dữ liệu',
    message: 'Không tìm thấy dữ liệu yêu cầu.',
  },
  stateConflict: {
    status: 200,
    code: 'CORE-STATE_CONFLICT',
    title: 'Xung đột dữ liệu',
    message: 'Thao tác không phù hợp với trạng thái dữ liệu hiện tại.',
  },
  internalError: {
    status: 500,
    code: 'CORE-INTERNAL_ERROR',
    title: 'Lỗi hệ thống',
    message:
      'Hệ thống gặp lỗi. Vui lòng thử lại sau hoặc cung cấp responseId để được hỗ trợ.',
  },
  credentialsInvalid: {
    status: 401,
    code: 'IDENTITY-CREDENTIALS_INVALID',
    title: 'Đăng nhập không thành công',
    message: 'Tên đăng nhập hoặc mật khẩu không đúng.',
  },
  passwordChangeRequired: {
    status: 403,
    code: 'IDENTITY-PASSWORD_CHANGE_REQUIRED',
    title: 'Yêu cầu đổi mật khẩu',
    message: 'Vui lòng đổi mật khẩu tạm trước khi tiếp tục.',
  },
  currentPasswordIncorrect: {
    status: 200,
    code: 'IDENTITY-CURRENT_PASSWORD_INCORRECT',
    title: 'Không thể đổi mật khẩu',
    message: 'Mật khẩu hiện tại không đúng.',
  },
  identifierExists: {
    status: 200,
    code: 'IDENTITY-IDENTIFIER_EXISTS',
    title: 'Trùng thông tin tài khoản',
    message: 'Mã cán bộ hoặc tên đăng nhập đã được sử dụng.',
  },
  membershipInvalid: {
    status: 200,
    code: 'IDENTITY-MEMBERSHIP_INVALID',
    title: 'Thông tin tổ chức chưa hợp lệ',
    message:
      'Tổ chức hoặc nhóm không hợp lệ, ngừng hoạt động hoặc không khớp nhau.',
  },
  lastSuperAdmin: {
    status: 200,
    code: 'IDENTITY-LAST_SUPER_ADMIN',
    title: 'Cần giữ quản trị viên gốc',
    message:
      'Hệ thống phải còn ít nhất một SUPER_ADMIN đang hoạt động với phạm vi GLOBAL.',
  },
  roleGrantExists: {
    status: 200,
    code: 'IDENTITY-ROLE_GRANT_EXISTS',
    title: 'Trùng phân quyền',
    message: 'Phân quyền cho vai trò và phạm vi này đang tồn tại.',
  },
  scopeInvalid: {
    status: 200,
    code: 'IDENTITY-SCOPE_INVALID',
    title: 'Phân quyền chưa hợp lệ',
    message: 'Vai trò hoặc phạm vi phân quyền không hợp lệ.',
  },
  orgCodeExists: {
    status: 200,
    code: 'ORGANIZATION-ORG_CODE_EXISTS',
    title: 'Trùng mã tổ chức',
    message: 'Mã tổ chức đã được sử dụng.',
  },
  teamCodeExists: {
    status: 200,
    code: 'ORGANIZATION-TEAM_CODE_EXISTS',
    title: 'Trùng mã nhóm',
    message: 'Mã nhóm đã được sử dụng trong tổ chức này.',
  },
  teamInUse: {
    status: 200,
    code: 'ORGANIZATION-TEAM_IN_USE',
    title: 'Nhóm đang được sử dụng',
    message: 'Không thể xóa nhóm còn thành viên hoặc phân quyền tham chiếu.',
  },
  hierarchyInvalid: {
    status: 200,
    code: 'ORGANIZATION-HIERARCHY_INVALID',
    title: 'Cấu trúc tổ chức chưa hợp lệ',
    message: 'Phòng phải trực thuộc đơn vị; tổ chức cha không được là phòng.',
  },
} as const;

export type BackendResponseKey = keyof typeof BACKEND_RESPONSES;

/** The `ERROR` envelope and the HTTP status the backend answers a refusal with. */
export interface BackendRefusal {
  readonly status: number;
  readonly body: Envelope;
}

export function backendRefusal(key: BackendResponseKey): BackendRefusal {
  const { status, code, title, message } = BACKEND_RESPONSES[key];
  return { status, body: envelopeError(code, title, message) };
}
