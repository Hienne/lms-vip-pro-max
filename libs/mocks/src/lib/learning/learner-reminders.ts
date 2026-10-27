import type { LearningReminder } from '@lms/contracts';
import type { LearnerReminderState } from './learning.fixtures';
import { refuse } from './learning-reply';

const DAY = 86_400_000;
const inDays = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString();

interface Owned {
  readonly userId: string;
  reminder: LearningReminder;
}

/**
 * The learners' deadline reminders: the backend lists only `pending` ones whose `scheduledAt` has
 * passed, and reading one sets it to `sent` (it never comes back).
 */
export class LearnerReminders {
  private readonly rows: Owned[];

  constructor(
    fixtures: Readonly<Record<string, readonly LearnerReminderState[]>>,
  ) {
    this.rows = Object.entries(fixtures).flatMap(([userId, states]) =>
      states.map((state) => ({
        userId,
        reminder: {
          id: state.id,
          recipientId: state.recipientId,
          scheduledAt: inDays(state.scheduledInDays),
          dueAtSnapshot: inDays(state.dueInDays),
          channel: 'IN_APP',
          status: 'pending',
          sentAt: null,
          attemptCount: 0,
          lastErrorCode: null,
          idempotencyKey: null,
          rowVersion: 0,
          createTime: inDays(state.scheduledInDays - 1),
          updateTime: inDays(state.scheduledInDays - 1),
        },
      })),
    );
  }

  /** The caller's pending reminders that have fallen due. */
  due(userId: string): LearningReminder[] {
    const now = Date.now();
    return this.rows
      .filter(
        (row) =>
          row.userId === userId &&
          row.reminder.status === 'pending' &&
          new Date(row.reminder.scheduledAt ?? 0).getTime() <= now,
      )
      .map((row) => ({ ...row.reminder }));
  }

  /** Sets the caller's reminder to `sent`; another user's is refused, an unknown id is not found. */
  read(userId: string, id: number): LearningReminder {
    const row = this.rows.find((candidate) => candidate.reminder.id === id);
    if (!row) return refuse('resourceNotFound');
    if (row.userId !== userId) return refuse('accessDenied');
    if (row.reminder.status === 'pending') {
      const stamp = new Date().toISOString();
      row.reminder = {
        ...row.reminder,
        status: 'sent',
        sentAt: stamp,
        updateTime: stamp,
        rowVersion: row.reminder.rowVersion + 1,
      };
    }
    return { ...row.reminder };
  }
}
