import { Component, input, linkedSignal, output } from '@angular/core';
import {
  FormField,
  form,
  max,
  maxLength,
  min,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { Alert, Button, Checkbox, Field, Input } from '@lms/ui';
import type { AppError } from '../../../../../../../core/errors/app-error';
import {
  EXAM_LIMITS,
  type ExamFormValue,
} from '../../data-access/course-exam.model';

const isWhole = (value: number) => Number.isInteger(value);

/** Collects the final exam settings for the course editor's store. */
@Component({
  selector: 'app-course-exam-form',
  imports: [Alert, Button, Checkbox, Field, FormField, Input],
  templateUrl: './course-exam-form.html',
  styleUrl: './course-exam-form.scss',
})
export class CourseExamForm {
  readonly value = input.required<ExamFormValue>();
  readonly submitLabel = input('Lưu bài thi');
  readonly busy = input(false);
  readonly error = input<AppError>();

  readonly saved = output<ExamFormValue>();
  readonly cancelled = output<void>();

  private readonly model = linkedSignal(() => this.value());
  protected readonly examForm = form(
    this.model,
    (path) => {
      required(path.title, { message: 'Nhập tên bài thi.' });
      maxLength(path.title, EXAM_LIMITS.title, {
        message: `Tên bài thi tối đa ${EXAM_LIMITS.title} ký tự.`,
      });
      const numbers = [
        [path.timeLimitMinutes, EXAM_LIMITS.timeLimitMinutes, 'Thời gian'],
        [path.questionCount, EXAM_LIMITS.questionCount, 'Số câu'],
        [path.passPercent, EXAM_LIMITS.passPercent, 'Điểm đạt'],
        [path.maxAttempts, EXAM_LIMITS.maxAttempts, 'Số lần thi'],
        [
          path.retakeWaitHours,
          EXAM_LIMITS.retakeWaitHours,
          'Thời gian chờ thi lại',
        ],
      ] as const;
      for (const [field, limit, label] of numbers) {
        required(field, { message: `Nhập ${label.toLocaleLowerCase('vi')}.` });
        min(field, limit.min, { message: `${label} tối thiểu ${limit.min}.` });
        max(field, limit.max, { message: `${label} tối đa ${limit.max}.` });
        validate(field, ({ value }) =>
          isWhole(value())
            ? undefined
            : {
                kind: 'whole',
                message: `${label} phải là số nguyên.`,
              },
        );
      }
    },
    {
      submission: {
        action: async () => {
          this.saved.emit(this.model());
        },
      },
    },
  );

  /**
   * This is not a `<form>`: the editor's own form wraps step 3, and a nested submit would reach
   * it and save the draft. The button and Enter submit this form's fields instead.
   */
  protected save(event?: Event): void {
    event?.preventDefault();
    void submit(this.examForm);
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
