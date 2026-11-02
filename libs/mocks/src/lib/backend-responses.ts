import type { Envelope } from '@lms/contracts';
import { envelopeError } from './envelope';

/**
 * Every refusal the backend can send, with its real HTTP status, code, title and message
 * (`ResponseCode`, `IdentityResponseCode`, `OrganizationResponseCode`, `KnowledgeResponseCode` and
 * `AssistantResponseCode`, `LearningResponseCode` and `CommunityResponseCode` of corebanking-academy).
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
  orgImportInvalid: {
    status: 200,
    code: 'ORGANIZATION-IMPORT_INVALID',
    title: 'Dữ liệu nhập chưa hợp lệ',
    message: 'Tệp nhập chưa hợp lệ. Vui lòng kiểm tra các lỗi chi tiết.',
  },
  hierarchyInvalid: {
    status: 200,
    code: 'ORGANIZATION-HIERARCHY_INVALID',
    title: 'Cấu trúc tổ chức chưa hợp lệ',
    message: 'Phòng phải trực thuộc đơn vị; tổ chức cha không được là phòng.',
  },
  fileTypeUnsupported: {
    status: 200,
    code: 'KNOWLEDGE-FILE_TYPE_UNSUPPORTED',
    title: 'Loại tệp không hỗ trợ',
    message: 'Chỉ hỗ trợ tệp .pdf, .md hoặc .docx.',
  },
  fileInvalid: {
    status: 200,
    code: 'KNOWLEDGE-FILE_INVALID',
    title: 'Tệp không hợp lệ',
    message: 'Tệp rỗng, bị hỏng hoặc nội dung không khớp với loại tệp.',
  },
  fileTooLarge: {
    status: 200,
    code: 'KNOWLEDGE-FILE_TOO_LARGE',
    title: 'Tệp quá lớn',
    message: 'Tệp vượt quá dung lượng tối đa cho phép.',
  },
  aiUnavailable: {
    status: 200,
    code: 'KNOWLEDGE-AI_UNAVAILABLE',
    title: 'Dịch vụ AI chưa sẵn sàng',
    message: 'Dịch vụ AI tạm thời không phản hồi. Vui lòng thử lại sau.',
  },
  assistantAiUnavailable: {
    status: 200,
    code: 'ASSISTANT-AI_UNAVAILABLE',
    title: 'Dịch vụ AI chưa sẵn sàng',
    message: 'Dịch vụ AI tạm thời không phản hồi. Vui lòng thử lại sau.',
  },
  assistantActionNotFound: {
    status: 200,
    code: 'ASSISTANT-ACTION_NOT_FOUND',
    title: 'Yêu cầu không còn hiệu lực',
    message:
      'Yêu cầu này đã hết hạn hoặc đã được xử lý. Vui lòng yêu cầu lại trợ lý.',
  },
  assistantActionStale: {
    status: 200,
    code: 'ASSISTANT-ACTION_STALE',
    title: 'Dữ liệu đã thay đổi',
    message: 'Dữ liệu đã thay đổi từ lúc trợ lý đề xuất. Vui lòng yêu cầu lại.',
  },
  // LearningResponseCode: the study session protocol. All are HTTP 200 `ERROR` envelopes.
  sessionInUse: {
    status: 200,
    code: 'LEARNING-SESSION_IN_USE',
    title: 'Chưa thể thực hiện',
    message:
      'Việc học đang mở ở nơi khác. Hãy xác nhận chuyển sang thiết bị này.',
  },
  sessionExpired: {
    status: 200,
    code: 'LEARNING-SESSION_EXPIRED',
    title: 'Chưa thể thực hiện',
    message:
      'Phiên học đã hết hạn hoặc được chuyển sang nơi khác. Vui lòng mở lại bài.',
  },
  staleEvent: {
    status: 200,
    code: 'LEARNING-STALE_EVENT',
    title: 'Chưa thể thực hiện',
    message:
      'Sự kiện tiến độ đã cũ hoặc không đúng thứ tự. Vui lòng đồng bộ lại.',
  },
  learningConflict: {
    status: 200,
    code: 'LEARNING-CONFLICT',
    title: 'Xung đột dữ liệu',
    message: 'Dữ liệu đã thay đổi hoặc xung đột. Vui lòng tải lại và kiểm tra.',
  },
  mediaChanged: {
    status: 200,
    code: 'LEARNING-MEDIA_CHANGED',
    title: 'Chưa thể thực hiện',
    message: 'Tài nguyên không khớp phiên học. Vui lòng tải lại bài.',
  },
  quizInvalid: {
    status: 200,
    code: 'LEARNING-QUIZ_INVALID',
    title: 'Bài kiểm tra chưa hợp lệ',
    message:
      'Bài kiểm tra không tồn tại, đã bị xóa hoặc không thuộc khóa học này.',
  },
  quizLessonUnlinked: {
    status: 200,
    code: 'LEARNING-QUIZ_LESSON_UNLINKED',
    title: 'Chưa thể xuất bản',
    message:
      'Có bài học loại kiểm tra chưa chọn bài kiểm tra đã xuất bản của khóa học.',
  },
  assetProcessing: {
    status: 200,
    code: 'LEARNING-ASSET_PROCESSING',
    title: 'Chưa thể thực hiện',
    message: 'Tài nguyên đang được xử lý. Vui lòng chờ và thử lại.',
  },
  exportTooLarge: {
    status: 200,
    code: 'LEARNING-EXPORT_TOO_LARGE',
    title: 'Chưa thể thực hiện',
    message: 'Kết quả vượt giới hạn xuất 10.000 dòng. Vui lòng thu hẹp bộ lọc.',
  },
  learningNotFound: {
    status: 200,
    code: 'LEARNING-NOT_FOUND',
    title: 'Không tìm thấy',
    message: 'Không tìm thấy dữ liệu học tập phù hợp.',
  },
  notAvailable: {
    status: 200,
    code: 'LEARNING-NOT_AVAILABLE',
    title: 'Chưa thể học',
    message: 'Khóa học chưa mở hoặc hiện không được phép học.',
  },
  uploadFileMismatch: {
    status: 200,
    code: 'LEARNING-UPLOAD_FILE_MISMATCH',
    title: 'Chưa thể thực hiện',
    message: 'File hoặc phần tải lên không khớp thông tin đã khai báo.',
  },
  uploadExpired: {
    status: 200,
    code: 'LEARNING-UPLOAD_EXPIRED',
    title: 'Chưa thể thực hiện',
    message: 'Phiên tải lên đã hết hạn hoặc bị hủy.',
  },
  uploadPartConflict: {
    status: 200,
    code: 'LEARNING-UPLOAD_PART_CONFLICT',
    title: 'Chưa thể thực hiện',
    message: 'Phần tải lên đã tồn tại với nội dung khác.',
  },
  assetInvalid: {
    status: 200,
    code: 'LEARNING-ASSET_INVALID',
    title: 'Tài nguyên chưa hợp lệ',
    message: 'Tệp không hợp lệ, sai loại, vượt dung lượng hoặc thiếu metadata.',
  },
  assetCodecUnsupported: {
    status: 200,
    code: 'LEARNING-ASSET_CODEC_UNSUPPORTED',
    title: 'Chưa thể thực hiện',
    message: 'Định dạng hoặc codec video chưa được hỗ trợ.',
  },
  invalidReference: {
    status: 200,
    code: 'LEARNING-INVALID_REFERENCE',
    title: 'Tham chiếu chưa hợp lệ',
    message: 'ID tham chiếu không tồn tại hoặc không đúng quan hệ.',
  },
  noteLimit: {
    status: 200,
    code: 'LEARNING-NOTE_LIMIT',
    title: 'Đã đạt giới hạn',
    message:
      'Bài học đã đạt giới hạn 500 ghi chú hoặc 500 đánh dấu. Hãy xóa bớt trước khi thêm.',
  },
  feedbackLimit: {
    status: 200,
    code: 'LEARNING-FEEDBACK_LIMIT',
    title: 'Đã đạt giới hạn',
    message:
      'Bạn đã gửi tối đa 20 nhận xét, câu hỏi và báo cáo cho bài học này trong hôm nay. Hãy thử lại vào ngày mai.',
  },
  communityNotFound: {
    status: 200,
    code: 'CORE-RESOURCE_NOT_FOUND',
    title: 'Không tìm thấy dữ liệu',
    message: 'Không tìm thấy nội dung trong phạm vi được phép.',
  },
  communityConflict: {
    status: 200,
    code: 'COMMUNITY-CONFLICT',
    title: 'Chưa thể thực hiện',
    message: 'Dữ liệu đã thay đổi. Vui lòng tải lại trước khi lưu.',
  },
  communityInvalidReference: {
    status: 200,
    code: 'COMMUNITY-INVALID_REFERENCE',
    title: 'Chưa thể thực hiện',
    message: 'Tham chiếu không hợp lệ hoặc không cùng phạm vi.',
  },
  communityStateInvalid: {
    status: 200,
    code: 'COMMUNITY-STATE_INVALID',
    title: 'Chưa thể thực hiện',
    message: 'Trạng thái hiện tại không cho phép thao tác này.',
  },
  communitySelfVote: {
    status: 200,
    code: 'COMMUNITY-SELF_VOTE',
    title: 'Chưa thể thực hiện',
    message: 'Không được tự bình chọn nội dung của mình.',
  },
  communityAcceptInvalid: {
    status: 200,
    code: 'COMMUNITY-ACCEPT_INVALID',
    title: 'Chưa thể thực hiện',
    message: 'Câu trả lời hoặc phiên bản chưa phù hợp để xác nhận.',
  },
  communityNotPublishable: {
    status: 200,
    code: 'COMMUNITY-NOT_PUBLISHABLE',
    title: 'Chưa thể thực hiện',
    message: 'Nội dung chưa đủ điều kiện xuất bản.',
  },
  communityDuplicate: {
    status: 200,
    code: 'COMMUNITY-DUPLICATE',
    title: 'Chưa thể thực hiện',
    message: 'Định danh này đã được sử dụng.',
  },
  communityIdempotencyConflict: {
    status: 200,
    code: 'COMMUNITY-IDEMPOTENCY_CONFLICT',
    title: 'Chưa thể thực hiện',
    message: 'Mã yêu cầu đã được dùng với nội dung khác.',
  },
  assetInUse: {
    status: 200,
    code: 'LEARNING-ASSET_IN_USE',
    title: 'Chưa thể thực hiện',
    message: 'Tài nguyên còn được sử dụng trong nội dung học tập.',
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
