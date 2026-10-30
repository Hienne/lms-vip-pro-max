import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { form, FormField, FormRoot, maxLength } from '@angular/forms/signals';
import { COMMUNITY_LIMITS, type CommentView } from '@lms/contracts';
import { Button, FmtDatetimePipe, Textarea } from '@lms/ui';
import { SessionStore } from '../../../../core/session/session.store';
import { Markdown } from '../../../../shared/content/markdown/markdown';
import {
  CommentsStore,
  type CommentDraftTarget,
} from './data-access/comments.store';

/**
 * The comments under one content, with replies one level deep. Who may edit or delete a comment
 * comes from the server; reporting is offered on other people's comments.
 */
@Component({
  selector: 'app-comment-thread',
  imports: [
    Button,
    FmtDatetimePipe,
    FormField,
    FormRoot,
    Markdown,
    NgTemplateOutlet,
    Textarea,
  ],
  providers: [CommentsStore],
  templateUrl: './comment-thread.html',
  styleUrl: './comment-thread.scss',
})
export class CommentThread {
  protected readonly store = inject(CommentsStore);
  private readonly session = inject(SessionStore);

  readonly contentId = input.required<number>();
  /** The server lets the user comment here (`capabilities.canComment`). */
  readonly canComment = input(false);
  /** Shown instead of "Thêm bình luận" when the content no longer takes comments. */
  readonly closedMessage = input<string>();

  protected readonly me = computed(() => this.session.user$()?.userId);

  private readonly model = signal({ body: '' });
  protected readonly composer = form(
    this.model,
    (path) =>
      maxLength(path.body, COMMUNITY_LIMITS.comment.max, {
        message: `Bình luận tối đa ${COMMUNITY_LIMITS.comment.max.toLocaleString('vi-VN')} ký tự.`,
      }),
    {
      submission: { action: async () => this.store.send(this.model().body) },
    },
  );

  constructor() {
    effect(() => {
      const contentId = this.contentId();
      untracked(() => this.store.load(contentId));
    });
  }

  protected open(target: CommentDraftTarget): void {
    this.model.set({
      body: target.kind === 'edit' ? (target.comment.bodyMarkdown ?? '') : '',
    });
    this.store.openComposer(target);
  }

  protected isTarget(comment: CommentView, kind: 'reply' | 'edit'): boolean {
    const target = this.store.target$();
    if (target?.kind !== kind) return false;
    return target.kind === 'reply'
      ? target.parentCommentId === comment.commentId
      : target.comment.commentId === comment.commentId;
  }

  protected can(
    comment: CommentView,
    action: 'canEdit' | 'canDelete',
  ): boolean {
    return !comment.isDeleted && !!comment.capabilities?.[action];
  }

  protected canReport(comment: CommentView): boolean {
    return !comment.isDeleted && comment.authorUserId !== this.me();
  }
}
