import { Dialog } from '@angular/cdk/dialog';
import { computed, inject, Injectable, signal } from '@angular/core';
import { communityEndpoints, type CommentView } from '@lms/contracts';
import { confirm } from '@lms/ui';
import { EMPTY, filter, switchMap } from 'rxjs';
import { invalidation } from '../../../../../core/data-access/invalidation';
import { serverData } from '../../../../../core/data-access/server-data';
import { serverMutation } from '../../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../../core/http/endpoint-client';
import { CommunityChanges } from '../../../data-access/community-changes';
import { reloadOnConflict } from '../../../data-access/conflict';
import { reportContent } from '../../report-dialog/report-dialog';

/** The comments one content shows; the first page holds them all for a discussion this size. */
const PAGE_SIZE = 100;

/** A top-level comment with its replies, oldest first. */
export interface CommentNode {
  readonly comment: CommentView;
  readonly replies: readonly CommentView[];
}

/** Where the composer is open: a new comment, a reply to one, or an edit of one. */
export type CommentDraftTarget =
  | { readonly kind: 'new' }
  | { readonly kind: 'reply'; readonly parentCommentId: number }
  | { readonly kind: 'edit'; readonly comment: CommentView };

const byTime = (a: CommentView, b: CommentView): number =>
  a.createTime.localeCompare(b.createTime);

/**
 * The comments under one question, answer, article or lesson. Replies hang under the comment they
 * answer (one level, as the server stores them). Each write reloads the list from the server.
 */
@Injectable()
export class CommentsStore {
  private readonly client = inject(EndpointClient);
  private readonly changes = inject(CommunityChanges);
  private readonly dialog = inject(Dialog);

  private readonly refresh = invalidation();

  private readonly state = {
    contentId: signal<number | undefined>(undefined),
    reviewThreadId: signal<number | undefined>(undefined),
    page: signal(1),
    target: signal<CommentDraftTarget | undefined>(undefined),
    /** One id per opened composer, so a retried send does not post twice. */
    requestId: signal(crypto.randomUUID()),
  };

  private readonly commentsData = serverData(
    ({
      contentId,
      reviewThreadId,
      page,
    }: {
      contentId: number;
      reviewThreadId?: number;
      page: number;
    }) =>
      this.client.call(communityEndpoints.comments, {
        params: { contentId },
        query: {
          size: PAGE_SIZE,
          page: page - 1,
          ...(reviewThreadId ? { reviewThreadId } : {}),
        },
      }),
    {
      params: () => {
        const contentId = this.state.contentId();
        return contentId
          ? {
              contentId,
              reviewThreadId: this.state.reviewThreadId(),
              page: this.state.page(),
            }
          : undefined;
      },
      reloadOn: this.refresh,
    },
  );

  private readonly sendMutation = serverMutation(
    ({ target, body }: { target: CommentDraftTarget; body: string }) => {
      const contentId = this.requireId();
      const write$ =
        target.kind === 'edit'
          ? this.client.call(communityEndpoints.updateComment, {
              params: { commentId: target.comment.commentId },
              body: {
                expectedVersion: target.comment.version,
                bodyMarkdown: body,
              },
            })
          : this.client.call(communityEndpoints.createComment, {
              params: { contentId },
              body: {
                clientRequestId: this.state.requestId(),
                bodyMarkdown: body,
                ...(this.state.reviewThreadId()
                  ? { reviewThreadId: this.state.reviewThreadId() }
                  : {}),
                ...(target.kind === 'reply'
                  ? { parentCommentId: target.parentCommentId }
                  : {}),
              },
            });
      return write$.pipe(
        reloadOnConflict(this.dialog, () => this.refresh.bump()),
      );
    },
    {
      errors: 'toast',
      success: ({ target }) =>
        target.kind === 'edit' ? 'Đã sửa bình luận' : 'Đã gửi bình luận',
      invalidates: this.refresh,
      onSuccess: () => this.closeComposer(),
    },
  );

  private readonly deleteMutation = serverMutation(
    (comment: CommentView) =>
      confirm(this.dialog, {
        title: 'Xóa bình luận?',
        message: 'Bình luận sẽ hiện là đã xóa với mọi người.',
        confirmLabel: 'Xóa',
        tone: 'danger',
      }).pipe(
        switchMap((yes) =>
          yes
            ? this.client
                .call(communityEndpoints.deleteComment, {
                  params: { commentId: comment.commentId },
                  query: { expectedVersion: comment.version },
                })
                .pipe(reloadOnConflict(this.dialog, () => this.refresh.bump()))
            : EMPTY,
        ),
      ),
    {
      errors: 'toast',
      success: () => 'Đã xóa bình luận',
      invalidates: this.refresh,
    },
  );

  private readonly reportMutation = serverMutation(
    (commentId: number) =>
      reportContent(this.dialog).pipe(
        filter((draft) => draft !== undefined),
        switchMap((draft) =>
          this.client.call(communityEndpoints.createReport, {
            body: { commentId, ...draft },
          }),
        ),
      ),
    {
      errors: 'toast',
      success: () => ({
        title: 'Đã gửi báo cáo',
        detail: 'Điều phối viên sẽ xem xét.',
      }),
      invalidates: this.changes.reports,
    },
  );

  // Selectors
  readonly threads$ = computed((): readonly CommentNode[] => {
    const comments = [...(this.commentsData.value()?.items ?? [])].sort(byTime);
    const ids = new Set(comments.map((c) => c.commentId));
    const roots = comments.filter(
      (c) => c.parentCommentId == null || !ids.has(c.parentCommentId),
    );
    return roots.map((comment) => ({
      comment,
      replies: comments.filter((c) => c.parentCommentId === comment.commentId),
    }));
  });
  /** Comments past the one page this thread reads, said under the thread instead of dropped. */
  readonly notShown$ = computed(() => {
    const page = this.commentsData.value();
    return page ? Math.max(0, page.totalElements - page.items.length) : 0;
  });
  readonly isLoading$ = this.commentsData.isLoading;
  readonly total$ = computed(
    () => this.commentsData.value()?.totalElements ?? 0,
  );
  readonly page$ = this.state.page.asReadonly();
  readonly pageSize = PAGE_SIZE;
  readonly error$ = this.commentsData.error;
  readonly target$ = this.state.target.asReadonly();
  readonly isSending$ = this.sendMutation.isPending;
  readonly isBusy$ = computed(
    () => this.sendMutation.isPending() || this.deleteMutation.isPending(),
  );

  private setPage(page: number): void {
    this.state.page.set(page);
  }

  // Setters
  private setContentId(contentId: number): void {
    this.state.contentId.set(contentId);
  }

  private setTarget(target: CommentDraftTarget | undefined): void {
    this.state.target.set(target);
    this.state.requestId.set(crypto.randomUUID());
  }

  // Commands
  private setReviewThreadId(value: number | undefined): void {
    this.state.reviewThreadId.set(value);
  }

  load(contentId: number, reviewThreadId?: number): void {
    this.setContentId(contentId);
    this.setReviewThreadId(reviewThreadId);
    this.setPage(1);
  }

  goToPage(page: number): void {
    this.setPage(page);
  }

  openComposer(target: CommentDraftTarget): void {
    this.setTarget(target);
  }

  closeComposer(): void {
    this.setTarget(undefined);
  }

  send(body: string): void {
    const target = this.state.target();
    if (!target || !body.trim()) return;
    this.sendMutation.run({ target, body: body.trim() });
  }

  remove(comment: CommentView): void {
    this.deleteMutation.run(comment);
  }

  report(commentId: number): void {
    this.reportMutation.run(commentId);
  }

  retryLoad(): void {
    this.commentsData.reload();
  }

  private requireId(): number {
    const id = this.state.contentId();
    if (id === undefined) throw new Error('The comment thread has no content');
    return id;
  }
}
