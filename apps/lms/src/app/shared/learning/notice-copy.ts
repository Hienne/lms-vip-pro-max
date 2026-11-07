import type { LearningReminder } from '@lms/contracts';

/** What a gamification notice says: a short title and one line of text. */
export interface NoticeCopy {
  readonly title: string;
  readonly text: string;
}

/**
 * The Vietnamese copy of a badge or level notice, for the notifications page and its toast. Plain and
 * quiet: it says what happened, with no praise to live up to. A deadline reminder has none (null).
 */
export function noticeCopy(
  reminder: Pick<LearningReminder, 'kind' | 'subject'>,
): NoticeCopy | null {
  const subject = reminder.subject?.trim() || null;
  if (reminder.kind === 'BADGE_EARNED') {
    return {
      title: 'Bạn đạt huy hiệu mới',
      text: subject ? `Huy hiệu ${subject}.` : 'Xem huy hiệu trong hồ sơ.',
    };
  }
  if (reminder.kind === 'LEVEL_UP') {
    return {
      title: 'Bạn lên cấp mới',
      text: subject ? `Bạn đã đạt cấp ${subject}.` : 'Xem cấp độ trong hồ sơ.',
    };
  }
  return null;
}
