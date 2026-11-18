import {
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import {
  FormField,
  disabled,
  form,
  max,
  maxLength,
  min,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from '@lms/ui';
import type { AppError } from '../../../../../../../core/errors/app-error';
import {
  EXAM_LIMITS,
  POOL_LIMIT,
  toNewQuizRequest,
  type ExamFormValue,
  type ExamQuestion,
} from '../../data-access/course-exam.model';

const localDate = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

/** Exam settings and pool picker, with no nested native form. */
@Component({
  selector: 'app-course-exam-form',
  imports: [Alert, Button, Checkbox, Field, FormField, Input, Select, Textarea],
  templateUrl: './course-exam-form.html',
  styleUrl: './course-exam-form.scss',
})
export class CourseExamForm {
  readonly value = input.required<ExamFormValue>();
  readonly questions = input<readonly ExamQuestion[]>([]);
  readonly questionsLoading = input(false);
  readonly questionsError = input<AppError>();
  readonly busy = input(false);
  readonly error = input<AppError>();
  readonly saved = output<ExamFormValue>();
  readonly retryQuestions = output<void>();
  protected readonly search = signal('');
  private readonly model = linkedSignal(() => {
    const value = this.value();
    return {
      ...toNewQuizRequest(1, value),
      ...value,
      description: value.description ?? '',
      openAt: localDate(value.openAt),
      closeAt: localDate(value.closeAt),
      questionIds: value.questionIds ? [...value.questionIds] : null,
    };
  });
  protected readonly selectedIds = computed(
    () =>
      this.model().questionIds ??
      this.questions()
        .slice(0, POOL_LIMIT)
        .map((q) => q.id),
  );
  protected readonly selected = computed(() => new Set(this.selectedIds()));
  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('vi');
    return this.questions().filter((q) =>
      (q.code + ' ' + q.contentPreview).toLocaleLowerCase('vi').includes(query),
    );
  });
  protected readonly poolLimit = POOL_LIMIT;
  protected readonly fixed = computed(
    () => this.model().selectionMode === 'FIXED',
  );
  protected readonly examForm = form(
    this.model,
    (path) => {
      required(path.title, { message: 'Nhập tên bài kiểm tra.' });
      maxLength(path.title, EXAM_LIMITS.title, {
        message: 'Tên bài kiểm tra tối đa 255 ký tự.',
      });
      maxLength(path.description, 10000, {
        message: 'Mô tả tối đa 10000 ký tự.',
      });
      disabled(path.questionCount, { when: () => this.fixed() });
      for (const [field, limit, label] of [
        [path.timeLimitMinutes, EXAM_LIMITS.timeLimitMinutes, 'Thời gian'],
        [path.questionCount, EXAM_LIMITS.questionCount, 'Số câu'],
        [path.maxAttempts, EXAM_LIMITS.maxAttempts, 'Số lần thi'],
        [
          path.retakeWaitHours,
          EXAM_LIMITS.retakeWaitHours,
          'Thời gian chờ thi lại',
        ],
        [path.graceSeconds, { min: 0, max: 300 }, 'Gia hạn nộp bài'],
      ] as const) {
        required(field, { message: `Nhập ${label.toLocaleLowerCase('vi')}.` });
        min(field, limit.min, { message: `${label} tối thiểu ${limit.min}.` });
        max(field, limit.max, { message: `${label} tối đa ${limit.max}.` });
        validate(field, ({ value }) =>
          Number.isInteger(value())
            ? undefined
            : { kind: 'whole', message: `${label} phải là số nguyên.` },
        );
      }
      required(path.passPercent, { message: 'Nhập điểm đạt.' });
      min(path.passPercent, 0.01, { message: 'Điểm đạt phải lớn hơn 0.' });
      max(path.passPercent, 100, { message: 'Điểm đạt tối đa 100%.' });
      validate(path.passPercent, ({ value }) =>
        Math.abs(value() * 100 - Math.round(value() * 100)) < 0.000001
          ? undefined
          : {
              kind: 'precision',
              message: 'Điểm đạt tối đa 2 chữ số thập phân.',
            },
      );
      validate(path.questionIds, () => {
        const count = this.selectedIds().length;
        if (this.questionsLoading())
          return { kind: 'loading', message: 'Chờ tải câu hỏi.' };
        if (this.questionsError())
          return {
            kind: 'load',
            message: 'Tải lại ngân hàng câu hỏi trước khi lưu.',
          };
        if (
          !count ||
          count > POOL_LIMIT ||
          (this.fixed() ? count > 200 : count < this.model().questionCount)
        )
          return {
            kind: 'pool',
            message:
              count > POOL_LIMIT
                ? `Mỗi bài kiểm tra được chọn tối đa ${POOL_LIMIT} câu.`
                : this.fixed()
                  ? 'Chọn từ 1 đến 200 câu cho đề cố định.'
                  : 'Chọn đủ câu hỏi cho số câu mỗi lượt.',
          };
        return undefined;
      });
      validate(path.closeAt, ({ value, valueOf }) => {
        if (!value() && valueOf(path.reviewPolicy) === 'AFTER_CLOSE')
          return {
            kind: 'required',
            message: 'Chọn thời gian đóng đề để công bố đáp án sau khi đóng.',
          };
        if (
          value() &&
          valueOf(path.openAt) &&
          new Date(value()).getTime() <=
            new Date(valueOf(path.openAt)).getTime()
        )
          return {
            kind: 'range',
            message: 'Thời gian đóng phải sau thời gian mở đề.',
          };
        return undefined;
      });
    },
    {
      submission: {
        action: async () => this.saved.emit(this.readValue()),
      },
    },
  );

  protected setSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }
  protected selectQuestion(id: number, event: Event): void {
    const ids = new Set(this.selectedIds());
    if ((event.target as HTMLInputElement).checked) {
      if (ids.size >= POOL_LIMIT) return;
      ids.add(id);
    } else ids.delete(id);
    this.model.update((value) => ({ ...value, questionIds: [...ids] }));
  }
  protected selectFiltered(): void {
    this.model.update((value) => ({
      ...value,
      questionIds: [
        ...new Set([
          ...this.selectedIds(),
          ...this.filtered().map((q) => q.id),
        ]),
      ].slice(0, POOL_LIMIT),
    }));
  }
  protected clearSelection(): void {
    this.model.update((value) => ({ ...value, questionIds: [] }));
  }
  save(event?: Event): Promise<boolean> {
    event?.preventDefault();
    return this.busy() ? Promise.resolve(false) : submit(this.examForm);
  }
  async validateAndRead(): Promise<ExamFormValue | undefined> {
    const valid = await submit(this.examForm, {
      action: async () => undefined,
    });
    return valid ? this.readValue() : undefined;
  }

  private readValue(): ExamFormValue {
    return {
      ...this.model(),
      questionIds: this.selectedIds(),
      questionCount: this.fixed()
        ? this.selectedIds().length
        : this.model().questionCount,
    };
  }
  protected enter(event: Event): void {
    if (
      event.defaultPrevented ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLButtonElement ||
      event.target instanceof HTMLSelectElement
    )
      return;
    if (
      event.target instanceof HTMLInputElement &&
      event.target.type === 'search'
    ) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
  }
}
