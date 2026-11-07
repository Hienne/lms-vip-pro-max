import { computed, inject, Injectable } from '@angular/core';
import { learnerEndpoints, type LearningReminder } from '@lms/contracts';
import { NOW } from '@lms/ui';
import { concatMap, finalize, from, toArray } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { dueReminders } from '../../../../core/learning/due-reminders';
import { RemindersChanged } from '../../../../core/learning/reminders-changed';
import { SessionStore } from '../../../../core/session/session.store';
import { isReminderOverdue } from '../../../../shared/learning/reminder-item/reminder-item';

export interface ReminderItem {
  readonly id: number;
  readonly reminder: LearningReminder;
  /** The due date has passed: the item says "đã quá hạn" and its date turns to the danger colour. */
  readonly isOverdue: boolean;
  /** A badge or level notice rather than a deadline reminder: it links to the profile and is never overdue. */
  readonly isNotice: boolean;
}

const time = (value: string | null | undefined): number =>
  value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;

/**
 * The learner's due deadline reminders (SPEC-learning-reminders) and the notices of a badge or a level they earned. The server decides which are
 * due; reading one sets it to `sent`, so it leaves the list after the reload. Only a learner has
 * reminders: anyone else is not asked, and a 403 reads as an empty list.
 */
@Injectable()
export class NotificationsStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly changed = inject(RemindersChanged);
  private readonly now = inject(NOW);

  /** Reloads the list after a read, here and (through `RemindersChanged`) in the shell. */
  private readonly reads = invalidation();

  private readonly canLearn = computed(() =>
    this.session.menus$().includes('COURSE_LEARNING'),
  );

  /** Idle (`undefined` params) for a user without the learner function. */
  private readonly remindersData = serverData(
    (_: { readonly learner: true }) => dueReminders(this.client),
    {
      params: () => (this.canLearn() ? { learner: true as const } : undefined),
      reloadOn: this.reads,
    },
  );

  private readonly readOne = serverMutation(
    (reminderId: number) =>
      this.client.call(learnerEndpoints.markReminderRead, {
        params: { reminderId },
      }),
    { errors: 'toast', invalidates: [this.reads, this.changed] },
  );

  /**
   * One after another, as the backend has no bulk call; the first refusal stops the rest. The
   * list and the bell reload either way, since the ones before it were read.
   */
  private readonly readAll = serverMutation(
    (reminderIds: readonly number[]) =>
      from(reminderIds).pipe(
        concatMap((reminderId) =>
          this.client.call(learnerEndpoints.markReminderRead, {
            params: { reminderId },
          }),
        ),
        toArray(),
        finalize(() => {
          this.reads.bump();
          this.changed.bump();
        }),
      ),
    { errors: 'toast' },
  );

  // Selectors
  readonly isLoading$ = this.remindersData.isLoading;
  readonly loadError$ = this.remindersData.error;
  readonly isMarking$ = computed(
    () => this.readOne.isPending() || this.readAll.isPending(),
  );

  readonly items$ = computed((): readonly ReminderItem[] => {
    if (!this.canLearn()) return [];
    const now = this.now();
    const all = this.remindersData.value() ?? [];
    const notices = all.filter((reminder) => reminder.kind !== 'DEADLINE');
    const deadlines = all.filter((reminder) => reminder.kind === 'DEADLINE');
    return [
      ...notices.sort((a, b) => b.id - a.id),
      ...deadlines.sort(
        (a, b) => time(a.dueAtSnapshot) - time(b.dueAtSnapshot) || a.id - b.id,
      ),
    ].map((reminder) => {
      const isNotice = reminder.kind !== 'DEADLINE';
      return {
        id: reminder.id,
        reminder,
        isNotice,
        isOverdue: !isNotice && isReminderOverdue(reminder, now),
      };
    });
  });
  readonly count$ = computed(() => this.items$().length);
  readonly canLearn$ = this.canLearn;
  /** Whoever manages courses also gets the questions learners ask on them. */
  readonly canManage$ = computed(() =>
    this.session.menus$().includes('COURSE_MANAGEMENT'),
  );
  readonly description$ = computed(() =>
    this.canLearn$() && this.canManage$()
      ? 'Nhắc hạn các khóa học được giao, huy hiệu, cấp độ mới và câu hỏi của học viên.'
      : this.canManage$()
        ? 'Câu hỏi và báo cáo của học viên trên các khóa học bạn quản lý.'
        : 'Nhắc hạn các khóa học được giao, huy hiệu và cấp độ mới.',
  );

  // Commands
  markRead(reminderId: number): void {
    this.readOne.run(reminderId);
  }

  markAllRead(): void {
    this.readAll.run(this.items$().map((item) => item.id));
  }

  retry(): void {
    this.remindersData.reload();
  }
}
