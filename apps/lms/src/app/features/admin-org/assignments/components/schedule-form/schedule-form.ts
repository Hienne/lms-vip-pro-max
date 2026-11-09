import { Component, inject, linkedSignal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  max,
  min,
  required,
  validate,
} from '@angular/forms/signals';
import { ASSIGNMENT_LIMITS } from '@lms/contracts';
import { Alert, DateInput, Field, Input, Switch } from '@lms/ui';
import { AssignmentsStore } from '../../data-access/assignments.store';
import {
  dateInput,
  DUE_TIME,
  toInstant,
} from '../assign-form/assign-form.schema';

const REMIND_DAYS = 3;

/**
 * Changes an assignment's dates and reminder (the mockup's "Sửa lượt giao"). The server applies
 * them to every active recipient at once and re-plans their reminders.
 */
@Component({
  selector: 'app-schedule-form',
  imports: [Alert, DateInput, Field, FormField, FormRoot, Input, Switch],
  template: `
    <form id="schedule-form" class="stack" [formRoot]="scheduleForm">
      @if (store.rescheduleError$(); as error) {
        <ui-alert tone="danger">{{ error.message }}</ui-alert>
      }
      @if (store.rescheduling$(); as row) {
        <p class="schedule-form__hint">
          {{ row.title }} · hạn mới áp dụng ngay cho học viên còn hiệu lực.
        </p>
      }
      <div class="schedule-form__pair">
        <ui-field label="Ngày bắt đầu" required>
          <ui-date-input [formField]="scheduleForm.startDate" />
        </ui-field>
        <ui-field label="Hạn hoàn thành" required>
          <ui-date-input [formField]="scheduleForm.dueDate" />
        </ui-field>
      </div>
      <label class="schedule-form__toggle">
        <input
          type="checkbox"
          uiSwitch
          [formField]="scheduleForm.reminderEnabled"
        />
        Nhắc học trước hạn
      </label>
      @if (scheduleForm.reminderEnabled().value()) {
        <ui-field label="Số ngày trước hạn">
          <input
            uiInput
            type="number"
            [formField]="scheduleForm.reminderDaysBefore"
          />
        </ui-field>
      }
    </form>
  `,
  styleUrl: './schedule-form.scss',
})
export class ScheduleForm {
  protected readonly store = inject(AssignmentsStore);

  private readonly model = linkedSignal(() => {
    const assignment = this.store.rescheduling$()?.assignment;
    return {
      startDate: assignment ? dateInput(Date.parse(assignment.startAt)) : '',
      dueDate: assignment?.dueAt ? dateInput(Date.parse(assignment.dueAt)) : '',
      reminderEnabled: assignment?.reminderEnabled ?? true,
      reminderDaysBefore: assignment?.reminderDaysBefore ?? REMIND_DAYS,
    };
  });

  protected readonly scheduleForm = form(
    this.model,
    (path) => {
      required(path.startDate, { message: 'Chọn ngày bắt đầu.' });
      required(path.dueDate, { message: 'Chọn hạn hoàn thành.' });
      validate(path.dueDate, ({ value, valueOf }) =>
        value() && valueOf(path.startDate) && value() < valueOf(path.startDate)
          ? { kind: 'dueAfterStart', message: 'Hạn phải sau ngày bắt đầu.' }
          : undefined,
      );
      min(path.reminderDaysBefore, 0, { message: 'Số ngày không âm.' });
      max(path.reminderDaysBefore, ASSIGNMENT_LIMITS.reminderDaysBefore, {
        message: `Tối đa ${ASSIGNMENT_LIMITS.reminderDaysBefore} ngày.`,
      });
    },
    {
      submission: {
        action: async () => {
          const value = this.model();
          this.store.reschedule({
            startAt: toInstant(value.startDate, 'T00:00:00'),
            dueAt: toInstant(value.dueDate, DUE_TIME),
            reminderEnabled: value.reminderEnabled,
            reminderDaysBefore: Math.round(value.reminderDaysBefore),
          });
        },
      },
    },
  );
}
