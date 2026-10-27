import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { personalEndpoints, type PersonalNotification } from '@lms/contracts';
import { map } from 'rxjs';
import type { IconName } from '@lms/ui';
import { LearningChanges } from '../../../../core/data-access/learning-changes';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
@Injectable()
export class NotificationsStore {
  private readonly client = inject(EndpointClient);
  private readonly router = inject(Router);
  private readonly changes = inject(LearningChanges);
  private readonly state = { unreadOnly: signal(false), page: signal(0) };
  private readonly data = serverData(
    (query: {
      page: number;
      size: number;
      sort: string;
      unreadOnly?: boolean;
    }) => this.client.call(personalEndpoints.notifications, { query }),
    {
      params: () => ({
        page: this.state.page(),
        size: 20,
        sort: 'at,desc',
        unreadOnly: this.state.unreadOnly() || undefined,
      }),
      reloadOn: this.changes.notifications,
    },
  );
  private readonly mark = serverMutation(
    (item: PersonalNotification) =>
      this.client
        .call(personalEndpoints.markRead, {
          params: { notificationId: item.id },
        })
        .pipe(map(() => item)),
    {
      errors: 'toast',
      success: () => 'Đã đánh dấu đã đọc',
      invalidates: this.changes.notifications,
      onSuccess: (item) => this.openTarget(item),
    },
  );
  private readonly all = serverMutation(
    () => this.client.call(personalEndpoints.markAllRead, { body: {} }),
    {
      errors: 'toast',
      success: () => 'Đã đọc tất cả thông báo',
      invalidates: this.changes.notifications,
    },
  );
  readonly page$ = this.data.value;
  readonly items$ = computed(() => this.data.value()?.items ?? []);
  readonly rows$ = computed(() =>
    this.items$().map((item) => ({
      ...item,
      icon: (
        {
          due: 'clock',
          assigned: 'book-open',
          result: 'clipboard-check',
          certificate: 'award',
          badge: 'trophy',
          other: 'bell',
        } as const
      )[item.kind] as IconName,
    })),
  );
  readonly tabs$ = [
    { id: 'all', label: 'Tất cả' },
    { id: 'unread', label: 'Chưa đọc' },
  ];
  readonly pageIndex$ = this.state.page.asReadonly();
  setPage(page: number): void {
    this.state.page.set(page);
  }
  readonly unreadOnly$ = this.state.unreadOnly.asReadonly();
  readonly isLoading$ = this.data.isLoading;
  readonly error$ = this.data.error;
  readonly isSaving$ = computed(
    () => this.mark.isPending() || this.all.isPending(),
  );
  setUnreadOnly(value: boolean): void {
    this.state.unreadOnly.set(value);
    this.setPage(0);
  }
  markRead(item: PersonalNotification): void {
    if (!item.readAt) this.mark.run(item);
    else this.openTarget(item);
  }
  private openTarget(item: PersonalNotification): void {
    if (item.target) {
      const url =
        item.target.type === 'course'
          ? ['/course', item.target.id]
          : item.target.type === 'certificate'
            ? ['/certificate', item.target.id]
            : item.target.type === 'quizResult'
              ? ['/quiz', item.target.quizId, 'result', item.target.id]
              : ['/progress'];
      void this.router.navigate(url);
    }
  }
  markAllRead(): void {
    this.all.run(undefined);
  }
  retry(): void {
    this.data.reload();
  }
}
