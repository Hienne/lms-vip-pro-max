import { Dialog } from '@angular/cdk/dialog';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { confirm, type ConfirmOptions } from '@lms/ui';

/** Copy of the mockup's `ds-confirm` and `ds-danger` demo dialogs. */
const PUBLISH: ConfirmOptions = {
  title: 'Xuất bản khóa học?',
  message: 'Học viên được giao sẽ nhìn thấy ngay.',
  confirmLabel: 'Xuất bản',
};
const DELETE: ConfirmOptions = {
  title: 'Xóa câu hỏi?',
  message: 'Thao tác không thể hoàn tác.',
  confirmLabel: 'Xóa',
  tone: 'danger',
};

@Injectable()
export class ConfirmDemoStore {
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = {
    result: signal<string>(''),
  };

  readonly result$ = this.state.result.asReadonly();

  setResult(result: string): void {
    this.state.result.set(result);
  }

  confirmPublish(): void {
    this.ask(PUBLISH, 'Đã chọn Xuất bản', 'Đã hủy xuất bản');
  }

  confirmDelete(): void {
    this.ask(DELETE, 'Đã chọn Xóa', 'Đã hủy xóa');
  }

  private ask(options: ConfirmOptions, yes: string, no: string): void {
    confirm(this.dialog, options)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => this.setResult(confirmed ? yes : no));
  }
}
