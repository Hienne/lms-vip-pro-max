import type { BadgeTone } from '@lms/ui';

/** Screen copy for the values the community API sends as codes. The server owns the codes. */

export interface ResolutionLabel {
  readonly label: string;
  readonly tone: BadgeTone;
}

export const RESOLUTION_LABELS: Readonly<Record<string, ResolutionLabel>> = {
  unanswered: { label: 'Chưa có trả lời', tone: 'warning' },
  answered: { label: 'Đã có trả lời', tone: 'neutral' },
  solved: { label: 'Đã giải quyết', tone: 'success' },
};

export const CONTENT_KIND_LABELS: Readonly<Record<string, string>> = {
  architecture_review: 'Review kiến trúc',
  question: 'Câu hỏi',
  answer: 'Câu trả lời',
  article: 'Bài viết',
  lesson_learned: 'Bài học sự cố',
};

export interface ReportReason {
  readonly code: string;
  readonly label: string;
  readonly hint?: string;
}

/** The report reasons the dialog offers; the server accepts any text up to 100 characters. */
export const REPORT_REASONS: readonly ReportReason[] = [
  { code: 'spam', label: 'Spam hoặc quảng cáo' },
  { code: 'incorrect', label: 'Thông tin sai' },
  { code: 'outdated', label: 'Đã lỗi thời' },
  {
    code: 'sensitive_data',
    label: 'Chứa dữ liệu nhạy cảm',
    hint: 'Mật khẩu, chuỗi kết nối, mã khách hàng hoặc log chưa che.',
  },
  { code: 'abuse', label: 'Ngôn từ không phù hợp' },
];

/** The label of a reason code; a code the app does not list is shown as it came. */
export const reportReasonLabel = (code: string): string =>
  REPORT_REASONS.find((reason) => reason.code === code)?.label ?? code;
