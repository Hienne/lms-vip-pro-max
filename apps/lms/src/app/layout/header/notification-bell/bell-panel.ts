import { Component, computed, inject, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { feedbackEndpoints } from '@lms/contracts';
import { Button, Icon, IconButton, Skeleton } from '@lms/ui';
import { serverData } from '../../../core/data-access/server-data';
import { EndpointClient } from '../../../core/http/endpoint-client';
import { InstructorFeedbackChanged } from '../../../core/learning/instructor-feedback-changed';
import { NotificationsStore } from '../../../features/account/notifications/data-access/notifications.store';
import { ReminderItem } from '../../../shared/learning/reminder-item/reminder-item';

const LIMIT = 20;

@Component({
  selector: 'app-bell-panel',
  imports: [Button, Icon, IconButton, ReminderItem, RouterLink, Skeleton],
  providers: [NotificationsStore],
  templateUrl: './bell-panel.html',
  styleUrl: './bell-panel.scss',
})
export class BellPanel {
  readonly navigated = output<void>();
  protected readonly inbox = inject(NotificationsStore);
  private readonly client = inject(EndpointClient);
  private readonly feedbackChanged = inject(InstructorFeedbackChanged);

  private readonly questions = serverData(
    (_: true) =>
      this.client.call(feedbackEndpoints.instructorFeedback, {
        query: { status: 'new', page: 0, size: LIMIT },
      }),
    {
      params: () => (this.inbox.canManage$() ? true : undefined),
      reloadOn: this.feedbackChanged,
    },
  );

  protected readonly rows = computed(() => {
    const notifications = this.inbox.items$();
    return [
      ...notifications
        .filter((item) => item.unread)
        .map((item) => ({ item, question: undefined })),
      ...(this.questions.value()?.items ?? []).map((question) => ({
        item: undefined,
        question,
      })),
      ...notifications
        .filter((item) => !item.unread)
        .map((item) => ({ item, question: undefined })),
    ].slice(0, LIMIT);
  });
  protected readonly loading = computed(
    () => this.inbox.isLoading$() || this.questions.isLoading(),
  );
  protected readonly failed = computed(
    () => this.inbox.loadError$() || this.questions.error(),
  );

  protected retry(): void {
    if (this.inbox.loadError$()) this.inbox.retry();
    if (this.questions.error()) this.questions.reload();
  }
}
