import {
  Component,
  effect,
  inject,
  linkedSignal,
  untracked,
} from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  maxLength,
  required,
  validate,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import {
  Alert,
  Badge,
  Breadcrumb,
  Icon,
  Button,
  Empty,
  ErrorState,
  Field,
  FmtDatePipe,
  FmtDatetimePipe,
  PageHeader,
  Pagination,
  Segmented,
  Select,
  Textarea,
  type SegmentedOption,
} from '@lms/ui';
import type { HasUnsavedChanges } from '../../../core/routing/unsaved-changes.guard';
import { Markdown } from '../../../shared/content/markdown/markdown';
import { CommentThread } from '../components/comment-thread/comment-thread';
import { ContentThumbnail } from '../components/content-thumbnail/content-thumbnail';
import {
  REVIEW_STATUS,
  INVITATION_ACTION,
  INVITATION_STATUS,
} from '../data-access/review-labels';
import { ReviewDetailStore } from './data-access/review-detail.store';

@Component({
  selector: 'app-community-review-detail',
  imports: [
    Alert,
    Badge,
    Breadcrumb,
    Icon,
    Button,
    Empty,
    ErrorState,
    Field,
    FmtDatePipe,
    FmtDatetimePipe,
    FormField,
    FormRoot,
    Markdown,
    PageHeader,
    Pagination,
    RouterLink,
    Segmented,
    Select,
    Textarea,
    CommentThread,
    ContentThumbnail,
  ],
  providers: [ReviewDetailStore],
  templateUrl: './review-detail.html',
  styleUrl: './review-detail.scss',
})
export class CommunityReviewDetail implements HasUnsavedChanges {
  protected readonly store = inject(ReviewDetailStore);
  protected readonly statuses = REVIEW_STATUS;
  protected readonly invitationStatus = INVITATION_STATUS;
  protected readonly invitationAction = INVITATION_ACTION;
  protected readonly tabs: readonly SegmentedOption<
    'design' | 'invitations' | 'conclusion'
  >[] = [
    { value: 'design', label: 'Thiết kế & góp ý' },
    { value: 'invitations', label: 'Người phản biện' },
    { value: 'conclusion', label: 'Kết luận' },
  ];
  protected readonly filters: readonly SegmentedOption<
    '' | 'open' | 'resolved'
  >[] = [
    { value: '', label: 'Tất cả góp ý' },
    { value: 'open', label: 'Chưa xử lý' },
    { value: 'resolved', label: 'Đã xử lý' },
  ];
  private readonly model = linkedSignal(() => {
    this.store.id$();
    return { section: '', body: '' };
  });
  protected readonly composer = form(
    this.model,
    (p) => {
      required(p.section, { message: 'Chọn mục đang góp ý.' });
      maxLength(p.section, 255, { message: 'Tên mục tối đa 255 ký tự.' });
      validate(p.body, ({ value }) =>
        !value().trim()
          ? { kind: 'required', message: 'Nhập nội dung góp ý.' }
          : undefined,
      );
      maxLength(p.body, 10_000, { message: 'Góp ý tối đa 10.000 ký tự.' });
    },
    {
      submission: {
        action: async () =>
          this.store.postThread(this.model().section, this.model().body),
      },
    },
  );
  constructor() {
    effect(() => {
      const posted = this.store.posted$();
      if (posted) untracked(() => this.model.set({ section: '', body: '' }));
    });
  }
  hasUnsavedChanges(): boolean {
    return !!this.model().body.trim();
  }
}
