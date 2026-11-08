import { Component, inject, input, linkedSignal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  max,
  maxLength,
  min,
  required,
  validate,
} from '@angular/forms/signals';
import {
  Alert,
  Button,
  DrawerOutlet,
  Empty,
  ErrorState,
  Field,
  FormActions,
  Input,
  Pagination,
  Search,
  Select,
  Spinner,
  Textarea,
} from '@lms/ui';
import {
  EXHAUSTED_LEARNER_PAGE_SIZE,
  QuizAttemptGrantStore,
} from './data-access/quiz-attempt-grant.store';

@Component({
  selector: 'app-quiz-attempt-grant',
  imports: [
    Alert,
    Button,
    DrawerOutlet,
    Empty,
    ErrorState,
    Field,
    FormActions,
    FormField,
    FormRoot,
    Input,
    Pagination,
    Search,
    Select,
    Spinner,
    Textarea,
  ],
  providers: [QuizAttemptGrantStore],
  templateUrl: './quiz-attempt-grant.html',
})
export class QuizAttemptGrant {
  readonly quizId = input.required<number>();
  protected readonly store = inject(QuizAttemptGrantStore);
  protected readonly pageSize = EXHAUSTED_LEARNER_PAGE_SIZE;

  private readonly model = linkedSignal({
    source: this.store.learners$,
    computation: () => ({ userId: '', extraAttempts: 1, reason: '' }),
  });

  protected readonly grantForm = form(
    this.model,
    (path) => {
      required(path.userId, { message: 'Chọn thí sinh.' });
      required(path.extraAttempts, { message: 'Nhập số lượt cấp thêm.' });
      min(path.extraAttempts, 1, { message: 'Cấp ít nhất 1 lượt.' });
      max(path.extraAttempts, 10, { message: 'Mỗi lần cấp tối đa 10 lượt.' });
      validate(path.extraAttempts, ({ value }) =>
        Number.isInteger(value())
          ? undefined
          : { kind: 'whole', message: 'Số lượt phải là số nguyên.' },
      );
      required(path.reason, { message: 'Nhập lý do cấp thêm lượt.' });
      maxLength(path.reason, 2000, { message: 'Lý do tối đa 2.000 ký tự.' });
      validate(path.reason, ({ value }) =>
        value().trim()
          ? undefined
          : { kind: 'blank', message: 'Nhập lý do cấp thêm lượt.' },
      );
    },
    {
      submission: {
        action: async () => {
          const value = this.model();
          this.store.grant({ ...value, reason: value.reason.trim() });
        },
      },
    },
  );
}
