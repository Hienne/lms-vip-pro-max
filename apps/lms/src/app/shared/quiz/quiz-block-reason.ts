import type { BlockReason } from '@lms/contracts';

const datetime = (iso: string): string =>
  new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

interface BlockContext {
  /** When the server says the learner can start (opening time, end of the retake wait). */
  readonly availableAt?: string | null;
  readonly closeAt?: string | null;
}

/**
 * The sentence for why the server refuses a new attempt. The server decides whether the learner
 * can start; this only words its `blockReason`, from the mockup's `quizIntro` where it has a line.
 */
export function blockReasonText(
  reason: BlockReason,
  { availableAt, closeAt }: BlockContext = {},
): string {
  switch (reason) {
    case 'NOT_OPEN':
      return availableAt
        ? `Bài kiểm tra mở lúc ${datetime(availableAt)}.`
        : 'Bài kiểm tra chưa mở.';
    case 'CLOSED':
      return closeAt
        ? `Bài kiểm tra đã đóng lúc ${datetime(closeAt)}.`
        : 'Bài kiểm tra đã đóng.';
    case 'NOT_READY':
      return 'Bài kiểm tra chưa sẵn sàng. Vui lòng quay lại sau.';
    case 'LESSONS_REQUIRED':
      return 'Hoàn thành các bài học nội dung của khóa để mở bài kiểm tra này.';
    case 'PASSED':
      return 'Bạn đã đạt bài kiểm tra này.';
    case 'NO_ATTEMPTS':
      return 'Bạn đã dùng hết lượt thi. Liên hệ giảng viên để được xem xét cấp thêm lượt.';
    case 'WAIT':
      return availableAt
        ? `Bạn có thể thi lại sau ${datetime(availableAt)}.`
        : 'Bạn cần chờ thêm trước khi thi lại.';
  }
}
