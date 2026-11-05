import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  maxLength,
  required,
} from '@angular/forms/signals';
import { ASSIGNMENT_LIMITS } from '@lms/contracts';
import { Alert, Field, Input, Textarea } from '@lms/ui';
import { AssignmentsStore } from '../../data-access/assignments.store';

/**
 * Creates a learning group: a list of people to assign courses to, separate from org teams and
 * granting no role. Members are added next, in the members drawer.
 */
@Component({
  selector: 'app-group-form',
  imports: [Alert, Field, FormField, FormRoot, Input, Textarea],
  template: `
    <form id="group-form" class="stack" [formRoot]="groupForm">
      <p class="text-muted">Tạo nhóm để giao khóa học chung.</p>
      @if (store.createGroupError$(); as error) {
        <ui-alert tone="danger">{{ error.message }}</ui-alert>
      }
      <ui-field label="Mã nhóm" required hint="Ví dụ: CBM-2026">
        <input uiInput [formField]="groupForm.code" />
      </ui-field>
      <ui-field label="Tên nhóm" required>
        <input uiInput [formField]="groupForm.name" />
      </ui-field>
      <ui-field label="Mô tả">
        <textarea
          uiTextarea
          rows="3"
          [formField]="groupForm.description"
        ></textarea>
      </ui-field>
    </form>
  `,
})
export class GroupForm {
  protected readonly store = inject(AssignmentsStore);

  private readonly model = signal({ code: '', name: '', description: '' });
  protected readonly groupForm = form(
    this.model,
    (path) => {
      required(path.code, { message: 'Nhập mã nhóm.' });
      maxLength(path.code, ASSIGNMENT_LIMITS.groupCode, {
        message: `Mã tối đa ${ASSIGNMENT_LIMITS.groupCode} ký tự.`,
      });
      required(path.name, { message: 'Nhập tên nhóm.' });
      maxLength(path.name, ASSIGNMENT_LIMITS.groupName, {
        message: `Tên tối đa ${ASSIGNMENT_LIMITS.groupName} ký tự.`,
      });
      maxLength(path.description, ASSIGNMENT_LIMITS.groupDescription, {
        message: `Mô tả tối đa ${ASSIGNMENT_LIMITS.groupDescription} ký tự.`,
      });
    },
    {
      submission: {
        action: async () => {
          const { code, name, description } = this.model();
          this.store.createGroup({
            code: code.trim(),
            name: name.trim(),
            ...(description.trim() ? { description: description.trim() } : {}),
          });
        },
      },
    },
  );
}
