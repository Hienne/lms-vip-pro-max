import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { personalEndpoints, type PersonalNotification } from '@lms/contracts';
import { invalidation } from '../../../../core/data-access/invalidation';
import { LearningChanges } from '../../../../core/data-access/learning-changes';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
@Injectable()
export class NotificationsStore {
  private readonly client = inject(EndpointClient);
  private readonly router = inject(Router);
  private readonly changes = inject(LearningChanges);
  private readonly state = { unreadOnly: signal(false) };
  private readonly data = serverData(
    (query: {
      page: number;
      size: number;
      sort: string;
      unreadOnly?: boolean;
    }) => this.client.call(personalEndpoints.notifications, { query }),
    {
      params: () => ({
        page: 0,
        size: 50,
        sort: 'at,desc',
        unreadOnly: this.state.unreadOnly() || undefined,
      }),
      reloadOn: this.changes.notifications,
    },
  );
  private readonly mark = serverMutation(
    (id: string) =>
      this.client.call(personalEndpoints.markRead, {
        params: { notificationId: id },
      }),
    {
      errors: 'toast',
      success: () => 'Đã đánh dấu đã đọc',
      invalidates: this.changes.notifications,
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
  readonly unreadOnly$ = this.state.unreadOnly.asReadonly();
  readonly isLoading$ = this.data.isLoading;
  readonly error$ = this.data.error;
  readonly isSaving$ = computed(
    () => this.mark.isPending() || this.all.isPending(),
  );
  setUnreadOnly(value: boolean): void {
    this.state.unreadOnly.set(value);
  }
  markRead(item: PersonalNotification): void {
    if (!item.readAt) this.mark.run(item.id);
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
