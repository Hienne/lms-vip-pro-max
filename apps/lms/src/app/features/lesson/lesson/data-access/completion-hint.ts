import type { CompletionMode } from '@lms/contracts';

/**
 * Words the server's completion rule for a block the learner has not completed yet (SPEC-learning-ui,
 * Decisions §4). The app only names the rule and repeats the server's numbers; it never decides
 * completion. `null` means there is nothing to say: the block completes on open.
 */
export function completionHint(
  mode: CompletionMode,
  percent: number,
  threshold: number | null,
): string | null {
  switch (mode) {
    case 'manual':
      return 'Tiến độ sẽ được ghi khi bạn chuyển tiếp';
    case 'video_coverage':
      return threshold === null
        ? `Đã xem ${percent}%`
        : `Đã xem ${percent}% · cần ${threshold}%`;
    case 'pdf_end':
      return 'Xem đến trang cuối để hoàn thành';
    case 'open':
      return null;
  }
}
