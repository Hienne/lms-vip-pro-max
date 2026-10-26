import { computed, inject, Injectable } from '@angular/core';
import { learnerEndpoints, type LearningReminder } from '@lms/contracts';
import { NOW } from '@lms/ui';
import {
  catchError,
  concatMap,
  finalize,
  from,
  of,
  throwError,
  toArray,
} from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { toAppError } from '../../../../core/errors/app-error';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { RemindersChanged } from '../../../../core/learning/reminders-changed';
import { SessionStore } from '../../../../core/session/session.store';
import { isReminderOverdue } from '../../../../shared/learning/reminder-item/reminder-item';

export interface ReminderItem {
  readonly id: number;
  readonly reminder: LearningReminder;
  /** The due date has passed: the item says "đã quá hạn" and its date turns to the danger colour. */
  readonly isOverdue: boolean;
}

const time = (value: string | null | undefined): number =>
  value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;

/**
 * The learner's due deadline reminders (SPEC-learning-reminders). The server decides which are
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
    (_: { readonly learner: true }) =>
      this.client
        .call(learnerEndpoints.reminders)
        .pipe(
          catchError((error: unknown) =>
            toAppError(error).kind === 'forbidden'
              ? of([] as LearningReminder[])
              : throwError(() => error),
          ),
        ),
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
    return [...(this.remindersData.value() ?? [])]
      .sort(
        (a, b) => time(a.dueAtSnapshot) - time(b.dueAtSnapshot) || a.id - b.id,
      )
      .map((reminder) => ({
        id: reminder.id,
        reminder,
        isOverdue: isReminderOverdue(reminder, now),
      }));
  });
  readonly count$ = computed(() => this.items$().length);

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
