import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  maxLength,
  validate,
} from '@angular/forms/signals';
import { Button, Field, Input, Textarea } from '@lms/ui';
import type { Observable } from 'rxjs';

export type ReviewAction =
  | 'invite'
  | 'resolve'
  | 'reopen'
  | 'conclude'
  | 'close';
export interface ReviewActionDraft {
  text: string;
  expiresAt: string;
}
const COPY = {
  invite: {
    title: 'Mời phản biện',
    label: 'Mã cán bộ',
    hint: 'Nhập mã cán bộ, ngăn cách bằng dấu phẩy hoặc xuống dòng. Người được mời phải có quyền đọc thiết kế.',
  },
  resolve: {
    title: 'Đánh dấu đã xử lý',
    label: 'Cách xử lý góp ý',
    hint: 'Ghi lại cách xử lý để người phản biện đối chiếu.',
  },
  reopen: {
    title: 'Mở lại góp ý',
    label: 'Lý do mở lại',
    hint: 'Ghi rõ điều cần trao đổi thêm.',
  },
  conclude: {
    title: 'Chốt kết luận review',
    label: 'Kết luận',
    hint: 'Từ 20 đến 20.000 ký tự. Kết luận gắn với phiên bản hiện tại; hồ sơ sẽ chuyển sang chỉ đọc.',
  },
  close: {
    title: 'Đóng đề nghị review',
    label: 'Lý do đóng',
    hint: 'Từ 5 đến 3.000 ký tự. Hồ sơ đóng sẽ không nhận thêm góp ý.',
  },
} as const;

@Component({
  selector: 'app-review-action-dialog',
  imports: [Button, Field, Input, Textarea, FormField, FormRoot],
  templateUrl: './review-action-dialog.html',
  styleUrl: './review-action-dialog.scss',
})
export class ReviewActionDialog {
  private readonly ref = inject<DialogRef<ReviewActionDraft>>(DialogRef);
  protected readonly action = inject<ReviewAction>(DIALOG_DATA);
  protected readonly copy = COPY[this.action];
  private readonly model = signal<ReviewActionDraft>({
    text: '',
    expiresAt: '',
  });
  protected readonly fields = form(
    this.model,
    (p) => {
      const min =
        this.action === 'conclude' ? 20 : this.action === 'close' ? 5 : 1;
      validate(p.text, ({ value }) =>
        value().trim().length < min
          ? { kind: 'required', message: `Nhập ít nhất ${min} ký tự.` }
          : undefined,
      );
      maxLength(
        p.text,
        this.action === 'conclude'
          ? 20_000
          : this.action === 'invite'
            ? 10_500
            : 3_000,
        { message: 'Nội dung vượt giới hạn cho phép.' },
      );
      if (this.action === 'invite') {
        validate(p.text, ({ value }) => {
          const ids = value()
            .split(/[\s,;]+/)
            .filter(Boolean);
          return ids.length > 500 || ids.some((id) => id.length > 20)
            ? {
                kind: 'ids',
                message: 'Tối đa 500 mã cán bộ, mỗi mã tối đa 20 ký tự.',
              }
            : undefined;
        });
        validate(p.expiresAt, ({ value }) =>
          !value() || new Date(value()).getTime() > Date.now()
            ? undefined
            : { kind: 'date', message: 'Hạn phản hồi phải ở tương lai.' },
        );
      }
    },
    { submission: { action: async () => this.ref.close(this.model()) } },
  );
  protected cancel(): void {
    this.ref.close();
  }
}
export function askReviewAction(
  dialog: Dialog,
  action: ReviewAction,
): Observable<ReviewActionDraft | undefined> {
  return dialog.open<ReviewActionDraft>(ReviewActionDialog, {
    data: action,
    ariaLabel: COPY[action].title,
    ariaModal: true,
    backdropClass: 'dialog-backdrop',
    panelClass: 'dialog-pane',
  }).closed;
}
