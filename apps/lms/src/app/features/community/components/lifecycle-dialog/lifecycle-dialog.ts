import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  maxLength,
  required,
  validate,
} from '@angular/forms/signals';
import { COMMUNITY_LIMITS, communityEndpoints } from '@lms/contracts';
import {
  Button,
  Field,
  FmtNumPipe,
  FmtRelativePipe,
  Icon,
  IconButton,
  Input,
  Textarea,
} from '@lms/ui';
import { defer, switchMap, timer, type Observable } from 'rxjs';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';

/** The change the dialog asks a reason for; every one of them carries a reason on the server. */
export type LifecycleDialogAction =
  | 'close'
  | 'reopen'
  | 'archive'
  | 'soft_delete'
  | 'duplicate'
  | 'unduplicate';

export interface LifecycleDialogData {
  readonly action: LifecycleDialogAction;
  readonly contentId: number;
  /** "câu hỏi", "bài viết": what the copy calls the content. */
  readonly noun: string;
}

export interface LifecycleDraft {
  readonly reason: string;
  /** Set only for `duplicate`. */
  readonly targetQuestionId?: number;
}

interface LifecycleFormValue {
  query: string;
  targetQuestionId: string;
  reason: string;
}

interface Copy {
  readonly title: string;
  readonly body: string;
  readonly confirm: string;
  readonly placeholder: string;
  readonly danger?: boolean;
}

const COPY = (noun: string): Record<LifecycleDialogAction, Copy> => ({
  close: {
    title: `Đóng ${noun}?`,
    body: 'Câu hỏi đóng sẽ không nhận thêm câu trả lời, bình luận hoặc bình chọn. Bạn vẫn chấp nhận hoặc bỏ chấp nhận câu trả lời đã có, và có thể mở lại sau.',
    confirm: `Đóng ${noun}`,
    placeholder: 'Ví dụ: vấn đề đã xử lý xong, không cần thêm trả lời.',
  },
  reopen: {
    title: `Mở lại ${noun}?`,
    body: 'Mọi người lại có thể trả lời, bình luận và bình chọn.',
    confirm: `Mở lại ${noun}`,
    placeholder: 'Ví dụ: vấn đề xuất hiện lại sau khi nâng cấp.',
  },
  archive: {
    title: `Lưu trữ ${noun}?`,
    body: 'Nội dung vẫn đọc được nhưng không nhận thêm tương tác và không còn hiện trong danh sách.',
    confirm: 'Lưu trữ',
    placeholder: 'Ví dụ: nội dung đã lỗi thời sau khi đổi hệ thống.',
  },
  soft_delete: {
    title: `Xóa ${noun}?`,
    body: 'Nội dung sẽ không còn hiển thị với ai. Thao tác này không hoàn tác được trên giao diện.',
    confirm: `Xóa ${noun}`,
    placeholder: 'Ví dụ: đăng nhầm.',
    danger: true,
  },
  duplicate: {
    title: 'Đánh dấu trùng lặp',
    body: 'Câu hỏi sẽ được đóng và trỏ tới câu hỏi gốc. Các câu trả lời hiện có vẫn được giữ.',
    confirm: 'Đánh dấu trùng lặp',
    placeholder: 'Ví dụ: cùng nguyên nhân, câu hỏi gốc đã có hướng xử lý.',
  },
  unduplicate: {
    title: 'Bỏ đánh dấu trùng lặp?',
    body: 'Câu hỏi không còn trỏ tới câu hỏi gốc và được mở lại.',
    confirm: 'Bỏ đánh dấu',
    placeholder: 'Ví dụ: hai câu hỏi khác nguyên nhân.',
  },
});

const SEARCH_DELAY_MS = 400;
const L = COMMUNITY_LIMITS;

/**
 * Asks the reason for a lifecycle change (close, reopen, archive, delete, duplicate), opened by
 * {@link askLifecycleReason}. For a duplicate it also finds the original question. Closes with
 * the reason, or with nothing when the user cancels.
 */
@Component({
  selector: 'app-lifecycle-dialog',
  imports: [
    Button,
    Field,
    FmtNumPipe,
    FmtRelativePipe,
    FormField,
    FormRoot,
    Icon,
    IconButton,
    Input,
    Textarea,
  ],
  templateUrl: './lifecycle-dialog.html',
  styleUrl: './lifecycle-dialog.scss',
})
export class LifecycleDialog {
  private readonly ref = inject<DialogRef<LifecycleDraft>>(DialogRef);
  private readonly client = inject(EndpointClient);
  protected readonly data = inject<LifecycleDialogData>(DIALOG_DATA);
  protected readonly copy = COPY(this.data.noun)[this.data.action];
  protected readonly duplicate = this.data.action === 'duplicate';
  protected readonly reasonMax = L.reason.max;

  private readonly model = signal<LifecycleFormValue>({
    query: '',
    targetQuestionId: '',
    reason: '',
  });
  protected readonly reasonForm = form(
    this.model,
    (path) => {
      validate(path.reason, ({ value }) =>
        value().trim().length < L.reason.min
          ? {
              kind: 'minLength',
              message: `Lý do cần ít nhất ${L.reason.min} ký tự.`,
            }
          : undefined,
      );
      maxLength(path.reason, L.reason.max, {
        message: `Lý do tối đa ${L.reason.max.toLocaleString('vi-VN')} ký tự.`,
      });
      if (this.duplicate) {
        required(path.targetQuestionId, { message: 'Chọn câu hỏi gốc.' });
      }
    },
    {
      submission: {
        action: async () => {
          const { reason, targetQuestionId } = this.model();
          this.ref.close({
            reason: reason.trim(),
            ...(this.duplicate
              ? { targetQuestionId: Number(targetQuestionId) }
              : {}),
          });
        },
      },
    },
  );

  private readonly query = computed(() => {
    const q = this.model().query.trim();
    return this.duplicate && q.length >= L.suggestionQuery.min
      ? q.slice(0, L.suggestionQuery.max)
      : undefined;
  });

  private readonly results = serverData(
    (q: string) =>
      timer(SEARCH_DELAY_MS).pipe(
        switchMap(() =>
          this.client.call(communityEndpoints.questionSuggestions, {
            query: { q, limit: 5 },
          }),
        ),
      ),
    { params: () => this.query() },
  );

  protected readonly candidates = computed(() =>
    (this.results.value() ?? []).filter(
      (card) => card.contentId !== this.data.contentId,
    ),
  );
  protected readonly searched = computed(
    () => !!this.query() && this.results.value() !== undefined,
  );

  protected cancel(): void {
    this.ref.close();
  }
}

/**
 * Opens the reason dialog. The observable is cold, opens on subscribe and emits once with the
 * reason, or completes without a value when the dialog is dismissed.
 */
export function askLifecycleReason(
  dialog: Dialog,
  data: LifecycleDialogData,
): Observable<LifecycleDraft | undefined> {
  return defer(
    () =>
      dialog.open<LifecycleDraft, LifecycleDialogData, LifecycleDialog>(
        LifecycleDialog,
        {
          data,
          role: 'dialog',
          ariaModal: true,
          ariaLabelledBy: 'lifecycle-dialog-title',
          backdropClass: 'dialog-backdrop',
          panelClass: 'dialog-pane',
        },
      ).closed,
  );
}
