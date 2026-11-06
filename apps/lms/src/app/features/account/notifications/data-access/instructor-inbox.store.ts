import { computed, inject, Injectable, signal } from '@angular/core';
import { feedbackEndpoints, type ReplyFeedbackCommand } from '@lms/contracts';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { InstructorFeedbackChanged } from '../../../../core/learning/instructor-feedback-changed';

export type InboxFilter = 'new' | 'all';

export const INBOX_PAGE_SIZE = 10;

/**
 * The questions and content reports learners sent on the courses the caller manages, newest first.
 * Answering moves one out of `new`, so it leaves the "Chưa trả lời" list after the reload, and the
 * bell (through `InstructorFeedbackChanged`) reads its count again.
 */
@Injectable()
export class InstructorInboxStore {
  private readonly client = inject(EndpointClient);
  private readonly changed = inject(InstructorFeedbackChanged);

  private readonly reads = invalidation();
  private readonly filter = signal<InboxFilter>('new');
  private readonly pageIndex = signal(0);

  private readonly data = serverData(
    (params: { readonly filter: InboxFilter; readonly page: number }) =>
      this.client.call(feedbackEndpoints.instructorFeedback, {
        query: {
          ...(params.filter === 'new' ? { status: 'new' as const } : {}),
          page: params.page,
          size: INBOX_PAGE_SIZE,
        },
      }),
    {
      params: () => ({ filter: this.filter(), page: this.pageIndex() }),
      reloadOn: this.reads,
    },
  );

  private readonly send = serverMutation(
    (input: { readonly id: number; readonly command: ReplyFeedbackCommand }) =>
      this.client.call(feedbackEndpoints.replyFeedback, {
        params: { feedbackId: input.id },
        body: input.command,
      }),
    {
      errors: 'toast',
      success: (_, result) =>
        result.status === 'resolved' ? 'Đã đóng câu hỏi.' : 'Đã gửi trả lời.',
      invalidates: [this.reads, this.changed],
    },
  );

  // Selectors
  readonly filter$ = this.filter.asReadonly();
  /** 1-based, as the pagination control counts. */
  readonly page$ = computed(() => this.pageIndex() + 1);
  readonly isLoading$ = this.data.isLoading;
  readonly loadError$ = this.data.error;
  readonly isSending$ = this.send.isPending;
  readonly items$ = computed(() => this.data.value()?.items ?? []);
  readonly total$ = computed(() => this.data.value()?.totalElements ?? 0);

  // Commands
  setFilter(filter: InboxFilter): void {
    this.filter.set(filter);
    this.pageIndex.set(0);
  }

  goToPage(page: number): void {
    this.pageIndex.set(Math.max(0, page - 1));
  }

  reply(id: number, command: ReplyFeedbackCommand): void {
    this.send.run({ id, command });
  }

  retry(): void {
    this.data.reload();
  }
}
