import { Component, computed, input } from '@angular/core';
import type { LearningReminder } from '@lms/contracts';
import { FmtDatePipe, FmtRelativePipe } from '@lms/ui';
import { noticeCopy } from '../notice-copy';

/** The due date has passed: the one rule for "đã quá hạn", shared by every list of reminders. */
export function isReminderOverdue(
  reminder: Pick<LearningReminder, 'dueAtSnapshot'>,
  now: number,
): boolean {
  return reminder.dueAtSnapshot
    ? new Date(reminder.dueAtSnapshot).getTime() < now
    : false;
}

/**
 * One deadline reminder as two lines: what it says (medium) and its due date and send time
 * (muted). The date is danger text when overdue, which is state, not decoration. Actions belong to
 * the page that lists it.
 */
@Component({
  selector: 'app-reminder-item',
  imports: [FmtDatePipe, FmtRelativePipe],
  templateUrl: './reminder-item.html',
  styleUrl: './reminder-item.scss',
})
export class ReminderItem {
  readonly reminder = input.required<LearningReminder>();
  readonly overdue = input.required<boolean>();
  /** The copy of a badge or level notice; null for a deadline reminder. */
  protected readonly notice = computed(() => noticeCopy(this.reminder()));
}
