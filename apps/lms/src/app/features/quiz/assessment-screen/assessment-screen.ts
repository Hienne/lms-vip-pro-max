import { Component, inject, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  form,
  FormField,
  submit,
  validateStandardSchema,
} from '@angular/forms/signals';
import { z } from 'zod';
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  DataTable,
  DataTableCell,
  DrawerOutlet,
  Empty,
  ErrorState,
  Field,
  FormActions,
  Icon,
  IconButton,
  Input,
  Kpi,
  OptionCard,
  PageHeader,
  Search,
  Select,
  Spinner,
  Textarea,
  type DataTableColumn,
} from '@lms/ui';
import {
  SaveQuestionSchema,
  SaveQuizConfigSchema,
  type SaveQuestion,
} from '@lms/contracts';
import { AssessmentScreenStore } from './data-access/assessment-screen.store';
const questionSchema = SaveQuestionSchema.extend({
  lessonId: z.string(),
  text: z.string().trim().min(1, 'Nhập nội dung câu hỏi.'),
  competency: z.string().min(1, 'Chọn nhóm kiến thức.'),
  domainId: z.string().min(1, 'Chọn lĩnh vực.'),
  options: z
    .array(
      z.object({
        id: z.string(),
        text: z.string().trim().min(1, 'Nhập nội dung phương án.'),
      }),
    )
    .min(2, 'Cần ít nhất 2 phương án.')
    .max(8),
  correctOptionIds: z.array(z.string()).min(1, 'Chọn đáp án đúng.'),
}).superRefine((q, ctx) => {
  if (
    (q.type === 'single' && q.correctOptionIds.length > 1) ||
    (q.type === 'multiple' && q.correctOptionIds.length < 2)
  )
    ctx.addIssue({
      code: 'custom',
      path: ['correctOptionIds'],
      message:
        q.type === 'single'
          ? 'Chọn đúng 1 đáp án.'
          : 'Chọn ít nhất 2 đáp án đúng.',
    });
});
const configSchema = SaveQuizConfigSchema.extend({
  title: z.string().trim().min(1, 'Nhập tên bài kiểm tra.'),
  courseId: z.string().min(1, 'Chọn khóa học.'),
  openAt: z.string().min(1, 'Chọn thời gian mở đề.'),
  closeAt: z.string().min(1, 'Chọn thời gian đóng đề.'),
  questionIds: z
    .array(z.string())
    .min(1, 'Chọn ít nhất một câu hỏi vào bộ đề.'),
}).superRefine((q, ctx) => {
  if (Date.parse(q.closeAt) <= Date.parse(q.openAt))
    ctx.addIssue({
      code: 'custom',
      path: ['closeAt'],
      message: 'Thời gian đóng phải sau thời gian mở đề.',
    });
  if (q.questionCount > q.questionIds.length)
    ctx.addIssue({
      code: 'custom',
      path: ['questionCount'],
      message: 'Số câu mỗi lượt không được vượt số câu đã chọn.',
    });
});
function localDate(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
@Component({
  selector: 'app-assessment-screen',
  imports: [
    RouterLink,
    FormField,
    Alert,
    Badge,
    Breadcrumb,
    Button,
    Card,
    CardBody,
    CardHeader,
    Checkbox,
    DataTable,
    DataTableCell,
    DrawerOutlet,
    Empty,
    ErrorState,
    Field,
    FormActions,
    Icon,
    IconButton,
    Input,
    Kpi,
    OptionCard,
    PageHeader,
    Search,
    Select,
    Spinner,
    Textarea,
  ],
  providers: [AssessmentScreenStore],
  templateUrl: './assessment-screen.html',
  styleUrl: './assessment-screen.scss',
})
export class AssessmentScreen {
  hasUnsavedChanges(): boolean {
    return (
      (this.store.routeScreen$() === 'config' &&
        this.configForm().dirty() &&
        !this.store.isSaving$()) ||
      (this.store.editorOpen$() && this.questionForm().dirty())
    );
  }

  protected readonly store = inject(AssessmentScreenStore);
  protected readonly letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  protected readonly questionColumns: readonly DataTableColumn[] = [
    { key: 'selected', label: '', sortable: false },
    { key: 'code', label: 'Mã' },
    { key: 'text', label: 'Nội dung' },
    { key: 'type', label: 'Loại' },
    { key: 'difficulty', label: 'Độ khó' },
    { key: 'competency', label: 'Nhóm kiến thức' },
    { key: 'usedIn', label: 'Dùng trong' },
    { key: 'status', label: 'Trạng thái' },
    { key: 'actions', label: '', sortable: false, kind: 'actions' },
  ];
  protected readonly quizColumns: readonly DataTableColumn[] = [
    { key: 'title', label: 'Bài kiểm tra', sortable: false },
    { key: 'questionCount', label: 'Số câu', sortable: false },
    { key: 'attempts', label: 'Lượt thi', sortable: false },
    { key: 'passRate', label: 'Tỷ lệ đạt', sortable: false },
    { key: 'status', label: 'Trạng thái', sortable: false },
    { key: 'actions', label: '', sortable: false, kind: 'actions' },
  ];
  private readonly questionModel = linkedSignal(
    (): Omit<SaveQuestion, 'lessonId'> & { lessonId: string } => {
      this.store.editorOpen$();
      const q = this.store.questionDraft$(),
        meta = this.store.options$();
      return q
        ? {
            ...q,
            lessonId: q.lessonId ?? '',
            options: q.options.map((x) => ({ ...x })),
            correctOptionIds: [...q.correctOptionIds],
          }
        : {
            code: '',
            text: '',
            type: 'single',
            options: [0, 1, 2, 3].map((i) => ({ id: `o${i + 1}`, text: '' })),
            correctOptionIds: [],
            explanation: '',
            difficulty: 'medium',
            domainId: meta?.domains[0]?.id ?? '',
            lessonId: '',
            competency: meta?.competencies[0] ?? '',
            status: 'active',
          };
    },
  );
  protected readonly questionForm = form(this.questionModel, (path) =>
    validateStandardSchema(path, questionSchema),
  );
  protected readonly questionValue = this.questionModel.asReadonly();
  private readonly configModel = linkedSignal(() => {
    const q = this.store.config$();
    return {
      ...(q ?? {
        title: '',
        courseId: '',
        status: 'published' as const,
        source: 'random' as const,
        questionIds: [] as string[],
        questionCount: 1,
        minutes: 15,
        passPct: 70,
        maxAttempts: 3,
        retakeWaitHours: 0,
        shuffleQuestions: true,
        shuffleOptions: true,
        openAt: new Date().toISOString(),
        closeAt: new Date(Date.now() + 60 * 86400000).toISOString(),
        reviewPolicy: 'after_submit' as const,
      }),
      questionIds: [...(q?.questionIds ?? [])],
      openAt: localDate(q?.openAt ?? new Date().toISOString()),
      closeAt: localDate(
        q?.closeAt ?? new Date(Date.now() + 60 * 86400000).toISOString(),
      ),
    };
  });
  protected readonly configForm = form(this.configModel, (path) =>
    validateStandardSchema(path, configSchema),
  );
  protected readonly configValue = this.configModel.asReadonly();
  protected questionSubmit(event: Event): void {
    event.preventDefault();
    void submit(this.questionForm, async () => {
      const q = this.questionModel();
      this.store.saveQuestion(
        { ...q, lessonId: q.lessonId || null },
        this.store.questionDraft$()?.id,
      );
    });
  }
  protected quizSubmit(event: Event): void {
    event.preventDefault();
    void submit(this.configForm, async () => {
      const q = this.configModel();
      this.store.saveQuiz(
        {
          ...q,
          openAt: new Date(q.openAt).toISOString(),
          closeAt: new Date(q.closeAt).toISOString(),
          expectedVersion: this.store.config$()?.version,
        },
        this.store.routeId$() === 'new' ? undefined : this.store.routeId$(),
      );
    });
  }
  protected setCorrect(id: string, checked: boolean): void {
    this.questionModel.update((q) => ({
      ...q,
      correctOptionIds:
        q.type === 'single'
          ? [id]
          : checked
            ? [...new Set([...q.correctOptionIds, id])]
            : q.correctOptionIds.filter((x) => x !== id),
    }));
  }
  protected addOption(): void {
    this.questionModel.update((q) => ({
      ...q,
      options: [...q.options, { id: crypto.randomUUID(), text: '' }],
    }));
  }
  protected removeOption(id: string): void {
    this.questionModel.update((q) => ({
      ...q,
      options: q.options.filter((x) => x.id !== id),
      correctOptionIds: q.correctOptionIds.filter((x) => x !== id),
    }));
  }
  protected selectPool(id: string, checked: boolean): void {
    this.configModel.update((q) => ({
      ...q,
      questionIds: checked
        ? [...new Set([...q.questionIds, id])]
        : q.questionIds.filter((x) => x !== id),
    }));
  }
}
