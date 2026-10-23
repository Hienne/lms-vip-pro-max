import { Component, input, linkedSignal, output } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import { COURSE_LIMITS } from '@lms/contracts';
import { Field, Input } from '@lms/ui';
import { z } from 'zod';

const CopyCourseFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, { error: 'Nhập mã khóa học mới.' })
    .max(COURSE_LIMITS.code, {
      error: `Mã tối đa ${COURSE_LIMITS.code} ký tự.`,
    }),
});

/**
 * Asks for the copy's code, which must be new; the server copies the content into a draft but
 * not the learners, assignments or shares.
 */
@Component({
  selector: 'app-copy-course-form',
  imports: [Field, FormField, FormRoot, Input],
  template: `
    <form id="copy-course-form" class="stack" [formRoot]="copyForm">
      <p class="copy-course-form__note">
        Bản sao ở trạng thái Nháp, giữ nguyên nội dung của "{{ title() }}". Học
        viên, lượt giao và chia sẻ không được sao chép.
      </p>
      <ui-field
        label="Mã khóa học mới"
        required
        hint="Duy nhất trong hệ thống."
      >
        <input uiInput [formField]="copyForm.code" />
      </ui-field>
    </form>
  `,
  styles: `
    @use 'ui';

    .copy-course-form__note {
      @include ui.text(sm, muted);
    }
  `,
})
export class CopyCourseForm {
  readonly title = input.required<string>();
  /** The source's code, suggested with a suffix. */
  readonly code = input.required<string>();
  readonly submitted = output<string>();

  private readonly model = linkedSignal(() => ({
    code: `${this.code()}-COPY`.slice(0, COURSE_LIMITS.code),
  }));
  protected readonly copyForm = form(
    this.model,
    (path) => {
      validateStandardSchema(path, CopyCourseFormSchema);
    },
    {
      submission: {
        action: async () => this.submitted.emit(this.model().code.trim()),
      },
    },
  );
}
