import {
  email,
  maxLength,
  required,
  type SchemaPathTree,
} from '@angular/forms/signals';
import type { ErrorSummaryItem } from '@lms/ui';

/** Vietnamese messages of the forms demo (copy of the mockup's `ds-field` demo). */
export const FORMS_DEMO_MESSAGES = {
  titleRequired: 'Tên khóa học là bắt buộc.',
  titleMaxLength: 'Tối đa 120 ký tự.',
  emailRequired: 'Email là bắt buộc.',
  emailInvalid: 'Email không đúng định dạng.',
} as const;

export interface FormsDemoFormValue {
  title: string;
  email: string;
  program: string;
  description: string;
}

/** Starts with an invalid email so "Kiểm tra" has something to show. */
export const FORMS_DEMO_INITIAL_VALUE: FormsDemoFormValue = {
  title: '',
  email: 'sai-dinh-dang',
  program: '',
  description: '',
};

export function formsDemoSchema(
  path: SchemaPathTree<FormsDemoFormValue>,
): void {
  required(path.title, { message: FORMS_DEMO_MESSAGES.titleRequired });
  maxLength(path.title, 120, { message: FORMS_DEMO_MESSAGES.titleMaxLength });
  required(path.email, { message: FORMS_DEMO_MESSAGES.emailRequired });
  email(path.email, { message: FORMS_DEMO_MESSAGES.emailInvalid });
}

/** Links each message to the control the error summary focuses. */
export function toSummaryItems(
  titleErrors: readonly string[],
  emailErrors: readonly string[],
): ErrorSummaryItem[] {
  return [
    ...titleErrors.map((message) => ({ controlId: 'ds-title', message })),
    ...emailErrors.map((message) => ({ controlId: 'ds-email', message })),
  ];
}
