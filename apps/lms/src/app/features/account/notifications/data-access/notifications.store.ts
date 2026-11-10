import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { learnerEndpoints, type LearningReminder } from '@lms/contracts';
import { confirm, NOW } from '@lms/ui';
import { concatMap, filter, finalize, from, toArray } from 'rxjs';
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
  readonly unread: boolean;
}

type InboxFilter = 'all' | 'unread' | 'read';

const time = (value: string | null | undefined): number =>
  value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;

/**
 * The learner's inbox, including the reminders and notices already read. The server owns their
 * status. Only a learner has reminders: a 403 reads as an empty list.
 */
@Injectable()
export class NotificationsStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly changed = inject(RemindersChanged);
  private readonly now = inject(NOW);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly inboxFilter = signal<InboxFilter>('all');

  private readonly canLearn = computed(() =>
    this.session.menus$().includes('COURSE_LEARNING'),
  );

  /** Idle (`undefined` params) for a user without the learner function. */
  private readonly remindersData = serverData(
    (_: { readonly learner: true }) => dueReminders(this.client, true),
    {
      params: () => (this.canLearn() ? { learner: true as const } : undefined),
      reloadOn: this.changed,
    },
  );

  private readonly readUpdates = linkedSignal(() => {
    this.remindersData.value();
    return new Map<number, LearningReminder>();
  });

  private readonly readOne = serverMutation(
    (reminderId: number) =>
      this.client.call(learnerEndpoints.markReminderRead, {
        params: { reminderId },
      }),
    {
      errors: 'toast',
      onSuccess: (reminder) => {
        this.readUpdates.update((rows) =>
          new Map(rows).set(reminder.id, reminder),
        );
      },
      invalidates: this.changed,
    },
  );

  private readonly removeOne = serverMutation(
    (reminderId: number) =>
      this.client.call(learnerEndpoints.deleteReminder, {
        params: { reminderId },
      }),
    {
      errors: 'toast',
      success: () => 'Đã xóa thông báo',
      invalidates: this.changed,
    },
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
          this.changed.bump();
        }),
      ),
    { errors: 'toast' },
  );

  // Selectors
  readonly isLoading$ = this.remindersData.isLoading;
  readonly loadError$ = this.remindersData.error;
  readonly isMarking$ = computed(
    () =>
      this.readOne.isPending() ||
      this.readAll.isPending() ||
      this.removeOne.isPending(),
  );

  readonly items$ = computed((): readonly ReminderItem[] => {
    if (!this.canLearn()) return [];
    const now = this.now();
    const updates = this.readUpdates();
    const all = (this.remindersData.value() ?? [])
      .map((reminder) => updates.get(reminder.id) ?? reminder)
      .filter((reminder) => reminder.status !== 'cancelled');
    const notices = all.filter((reminder) => reminder.kind !== 'DEADLINE');
    const deadlines = all.filter((reminder) => reminder.kind === 'DEADLINE');
    return [
      ...notices.sort((a, b) => b.id - a.id),
      ...deadlines.sort(
        (a, b) => time(a.dueAtSnapshot) - time(b.dueAtSnapshot) || a.id - b.id,
      ),
    ]
      .map((reminder) => {
        const isNotice = reminder.kind !== 'DEADLINE';
        return {
          id: reminder.id,
          reminder,
          isNotice,
          isOverdue: !isNotice && isReminderOverdue(reminder, now),
          unread: reminder.status === 'pending',
        };
      })
      .sort((a, b) => Number(b.unread) - Number(a.unread));
  });
  readonly count$ = computed(() => this.items$().length);
  readonly inboxFilter$ = this.inboxFilter.asReadonly();
  private readonly unreadItems = computed(() =>
    this.items$().filter((item) => item.unread),
  );
  readonly unreadCount$ = computed(() => this.unreadItems().length);
  readonly visibleItems$ = computed(() => {
    switch (this.inboxFilter()) {
      case 'unread':
        return this.unreadItems();
      case 'read':
        return this.items$().filter((item) => !item.unread);
      default:
        return this.items$();
    }
  });
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
  selectFilter(value: string): void {
    if (value === 'all' || value === 'unread' || value === 'read')
      this.inboxFilter.set(value);
  }

  markRead(reminderId: number): void {
    if (
      !this.isMarking$() &&
      this.unreadItems().some((item) => item.id === reminderId)
    ) {
      this.readOne.run(reminderId);
    }
  }

  markAllRead(): void {
    const ids = this.unreadItems().map((item) => item.id);
    if (ids.length && !this.isMarking$()) this.readAll.run(ids);
  }

  deleteReminder(reminderId: number): void {
    if (this.isMarking$()) return;
    confirm(this.dialog, {
      title: 'Xóa thông báo?',
      message: 'Thông báo này sẽ bị xóa khỏi hộp thư của bạn.',
      confirmLabel: 'Xóa thông báo',
      tone: 'danger',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (
          !this.isMarking$() &&
          this.items$().some((item) => item.id === reminderId)
        ) {
          this.removeOne.run(reminderId);
        }
      });
  }

  retry(): void {
    this.remindersData.reload();
  }
}
