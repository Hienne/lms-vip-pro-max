import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  maxLength,
  pattern,
  required,
} from '@angular/forms/signals';
import { MAX_XP_ADJUSTMENT } from '@lms/contracts';
import { Alert, Button, Field, Input, Textarea } from '@lms/ui';
import { UserDetailStore } from '../../data-access/user-detail.store';

const REASON_MAX = 500;

/**
 * A system admin's correction of this learner's XP: a signed amount and a mandatory reason. The
 * server writes one compensating row and an audit entry and checks the rules (amount, total never
 * negative); this form only collects the two values.
 */
@Component({
  selector: 'app-xp-adjust-form',
  imports: [Alert, Button, Field, FormField, FormRoot, Input, Textarea],
  template: `
    <form class="stack" [formRoot]="adjustForm">
      <p>
        Dùng khi có gian lận hoặc lỗi dữ liệu. Hệ thống ghi thêm một dòng điều
        chỉnh và một mục nhật ký; XP đã ghi trước đó không bị sửa. Học viên thấy
        phần "Điều chỉnh" trong XP của mình.
      </p>
      @if (store.adjustXpError$(); as error) {
        <ui-alert tone="danger">{{ error.message }}</ui-alert>
      }
      @if (store.lastAdjustment$(); as done) {
        <ui-alert tone="success" [announce]="true">
          Đã điều chỉnh {{ done.amount > 0 ? '+' : '' }}{{ done.amount }} XP.
          Tổng XP hiện tại của học viên: {{ done.total }}.
        </ui-alert>
      }
      <ui-field
        label="Số XP điều chỉnh"
        hint="Số nguyên có dấu, ví dụ 50 để cộng hoặc -30 để trừ."
        required
      >
        <input uiInput inputmode="numeric" [formField]="adjustForm.amount" />
      </ui-field>
      <ui-field label="Lý do" required>
        <textarea
          uiTextarea
          rows="3"
          [formField]="adjustForm.reason"
        ></textarea>
      </ui-field>
      <div>
        <button uiButton type="submit" [disabled]="store.isAdjustingXp$()">
          Ghi điều chỉnh
        </button>
      </div>
    </form>
  `,
})
export class XpAdjustForm {
  protected readonly store = inject(UserDetailStore);

  private readonly model = signal({ amount: '', reason: '' });
  protected readonly adjustForm = form(
    this.model,
    (path) => {
      required(path.amount, { message: 'Nhập số XP.' });
      pattern(path.amount, /^-?[1-9]\d{0,5}$/, {
        message: 'Nhập số nguyên khác 0, ví dụ 50 hoặc -30.',
      });
      required(path.reason, { message: 'Nhập lý do điều chỉnh.' });
      maxLength(path.reason, REASON_MAX, {
        message: `Lý do tối đa ${REASON_MAX} ký tự.`,
      });
    },
    {
      submission: {
        action: async () => {
          const amount = Number(this.model().amount);
          if (Math.abs(amount) > MAX_XP_ADJUSTMENT) return;
          this.store.adjustXp(amount, this.model().reason.trim());
        },
      },
    },
  );
}
