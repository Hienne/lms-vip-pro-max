import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  maxLength,
  required,
} from '@angular/forms/signals';
import { ASSIGNMENT_LIMITS } from '@lms/contracts';
import { Alert, Field, Textarea } from '@lms/ui';
import { AssignmentsStore } from '../../data-access/assignments.store';

/**
 * Revokes a whole assignment (the mockup's "Thu hồi lượt giao?"). The server needs a reason and
 * keeps every learner's enrolment and progress.
 */
@Component({
  selector: 'app-withdraw-form',
  imports: [Alert, Field, FormField, FormRoot, Textarea],
  template: `
    <form id="withdraw-form" class="stack" [formRoot]="withdrawForm">
      @if (store.withdrawError$(); as error) {
        <ui-alert tone="danger">{{ error.message }}</ui-alert>
      }
      <p>
        Học viên không còn bị yêu cầu học khóa này. Tiến độ đã học vẫn được giữ.
      </p>
      <ui-field label="Lý do thu hồi" required>
        <textarea
          uiTextarea
          rows="3"
          [formField]="withdrawForm.reason"
        ></textarea>
      </ui-field>
    </form>
  `,
})
export class WithdrawForm {
  protected readonly store = inject(AssignmentsStore);

  private readonly model = signal({ reason: '' });
  protected readonly withdrawForm = form(
    this.model,
    (path) => {
      required(path.reason, { message: 'Nhập lý do thu hồi.' });
      maxLength(path.reason, ASSIGNMENT_LIMITS.revokeReason, {
        message: `Lý do tối đa ${ASSIGNMENT_LIMITS.revokeReason} ký tự.`,
      });
    },
    {
      submission: {
        action: async () => this.store.withdraw(this.model().reason.trim()),
      },
    },
  );
}
