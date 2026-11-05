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
  type ProgramQuestionDetail,
  type QuizDetailV1,
} from '@lms/contracts';
import { AssessmentScreenStore } from './data-access/assessment-screen.store';

const questionSchema = SaveQuestionSchema.omit({
  domainId: true,
  lessonId: true,
})
  .extend({
    programId: z.string().regex(/^[1-9]\d*$/, 'Chọn chương trình.'),
    code: z.string().max(50, 'Mã tối đa 50 ký tự.'),
    text: z.string().trim().min(1, 'Nhập nội dung câu hỏi.').max(10000),
    competency: z.string().regex(/^[1-9]\d*$/, 'Chọn nhóm năng lực.'),
    points: z
      .number()
      .min(0.01, 'Điểm phải lớn hơn 0.')
      .max(9999.99)
      .multipleOf(0.01, 'Điểm có tối đa 2 số lẻ.'),
    explanation: z.string().max(10000),
    options: z
      .array(
        z.object({
          id: z.string(),
          text: z.string().trim().min(1, 'Nhập nội dung phương án.').max(10000),
        }),
      )
      .min(2)
      .max(10),
  })
  .superRefine((q, ctx) => {
    if (
      q.type === 'single'
        ? q.correctOptionIds.length !== 1
        : q.correctOptionIds.length < 2
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
const configSchema = SaveQuizConfigSchema.omit({
  status: true,
  expectedVersion: true,
})
  .extend({
    title: z.string().trim().min(1, 'Nhập tên bài kiểm tra.').max(255),
    openAt: z.string(),
    closeAt: z.string(),
    description: z.string().max(10000),
    quizType: z.enum(['PRACTICE', 'FINAL_EXAM']),
    scoringMode: z.enum(['ALL_OR_NOTHING', 'PARTIAL']),
    scoreMethod: z.enum(['BEST', 'LAST']),
    graceSeconds: z.number().int().min(0).max(300),
    allowRetakeAfterPass: z.boolean(),
    requireLessonsCompleted: z.boolean(),
    passPct: z.number().min(0.01).max(100).multipleOf(0.01),
    retakeWaitHours: z.number().int().min(0).max(720),
  })
  .superRefine((q, ctx) => {
    if (
      (q.openAt && !Number.isFinite(Date.parse(q.openAt))) ||
      (q.closeAt && !Number.isFinite(Date.parse(q.closeAt)))
    )
      ctx.addIssue({
        code: 'custom',
        path: ['openAt'],
        message: 'Ngày giờ không hợp lệ.',
      });
    if (q.closeAt && q.openAt && Date.parse(q.closeAt) <= Date.parse(q.openAt))
      ctx.addIssue({
        code: 'custom',
        path: ['closeAt'],
        message: 'Thời gian đóng phải sau thời gian mở đề.',
      });
  });
function localDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function questionValue(
  q: ProgramQuestionDetail | undefined,
  programId: number | undefined,
) {
  return {
    code: q?.code ?? '',
    text: q?.content ?? '',
    type:
      q?.questionType === 'MULTIPLE'
        ? ('multiple' as const)
        : ('single' as const),
    programId: String(q?.programId ?? programId ?? ''),
    competency: q ? String(q.competencyId) : '',
    points: q?.points ?? 1,
    explanation: q?.explanation ?? '',
    difficulty:
      q?.difficulty === 'HARD'
        ? ('hard' as const)
        : q?.difficulty === 'EASY'
          ? ('easy' as const)
          : ('medium' as const),
    status:
      q?.status === 'INACTIVE' ? ('inactive' as const) : ('active' as const),
    options: q
      ? q.options.map((o) => ({ id: String(o.id), text: o.content }))
      : [0, 1, 2, 3].map((i) => ({ id: `new-${i}`, text: '' })),
    correctOptionIds: q
      ? q.options.filter((o) => o.correct).map((o) => String(o.id))
      : ([] as string[]),
  };
}
function quizValue(
  detail: QuizDetailV1 | undefined,
  courseId: number | undefined,
) {
  const q = detail?.quiz;
  return {
    title: q?.title ?? '',
    courseId: String(q?.courseId ?? courseId ?? ''),
    description: q?.description ?? '',
    source:
      q?.selectionMode === 'FIXED' ? ('manual' as const) : ('random' as const),
    questionIds:
      detail?.pool.map((p) => String(p.questionId)) ?? ([] as string[]),
    questionCount: q?.questionCount ?? 1,
    minutes: q?.timeLimitMinutes ?? 15,
    passPct: q?.passPercent ?? 70,
    maxAttempts: q?.maxAttempts ?? 3,
    retakeWaitHours: q?.retakeWaitHours ?? 0,
    shuffleQuestions: q?.shuffleQuestions ?? true,
    shuffleOptions: q?.shuffleOptions ?? true,
    openAt: localDate(q?.openAt),
    closeAt: localDate(q?.closeAt),
    reviewPolicy:
      q?.reviewPolicy === 'NEVER'
        ? ('never' as const)
        : q?.reviewPolicy === 'AFTER_PASS'
          ? ('after_pass' as const)
          : q?.reviewPolicy === 'AFTER_CLOSE'
            ? ('after_close' as const)
            : ('after_submit' as const),
    quizType: q?.quizType ?? ('PRACTICE' as const),
    scoringMode: q?.scoringMode ?? ('ALL_OR_NOTHING' as const),
    scoreMethod: q?.scoreMethod ?? ('BEST' as const),
    graceSeconds: q?.graceSeconds ?? 0,
    allowRetakeAfterPass: q?.allowRetakeAfterPass ?? false,
    requireLessonsCompleted: q?.requireLessonsCompleted ?? false,
  };
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
  protected readonly store = inject(AssessmentScreenStore);
  protected readonly letters = [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
  ];
  protected readonly questionColumns: readonly DataTableColumn[] = [
    { key: 'selected', label: '', sortable: false },
    { key: 'code', label: 'Mã' },
    { key: 'contentPreview', label: 'Nội dung', sortable: false },
    { key: 'questionType', label: 'Loại', sortable: false },
    { key: 'difficulty', label: 'Độ khó', sortable: false },
    { key: 'competencyName', label: 'Nhóm năng lực', sortable: false },
    { key: 'usedInQuizCount', label: 'Dùng trong', sortable: false },
    { key: 'status', label: 'Trạng thái', sortable: false },
    { key: 'actions', label: '', sortable: false, kind: 'actions' },
  ];
  protected readonly quizColumns: readonly DataTableColumn[] = [
    { key: 'title', label: 'Bài kiểm tra', sortable: false },
    { key: 'questionCount', label: 'Số câu', sortable: false },
    { key: 'timeLimitMinutes', label: 'Phút', sortable: false },
    { key: 'gradedAttempts', label: 'Lượt đã chấm', sortable: false },
    { key: 'passedAttempts', label: 'Lượt đạt', sortable: false },
    { key: 'status', label: 'Trạng thái', sortable: false },
    { key: 'actions', label: '', sortable: false, kind: 'actions' },
  ];
  private readonly questionModel = linkedSignal(() => {
    this.store.editorOpen$();
    return questionValue(
      this.store.questionDraft$(),
      this.store.selectedProgramId$(),
    );
  });
  protected readonly questionForm = form(this.questionModel, (path) =>
    validateStandardSchema(path, questionSchema),
  );
  protected readonly questionValue = this.questionModel.asReadonly();
  private readonly configModel = linkedSignal<
    {
      detail: QuizDetailV1 | undefined;
      courseId: number | undefined;
      programId: number | undefined;
      routeId: string;
    },
    ReturnType<typeof quizValue>
  >({
    source: () => ({
      detail: this.store.configDetail$(),
      courseId: this.store.selectedCourseId$(),
      programId: this.store.selectedProgramId$(),
      routeId: this.store.routeId$(),
    }),
    computation: (next, previous) => {
      if (next.routeId === 'new' && previous?.source.routeId === 'new') {
        return {
          ...previous.value,
          courseId: String(next.courseId ?? ''),
          questionIds:
            next.programId === previous.source.programId
              ? previous.value.questionIds
              : [],
        };
      }
      return quizValue(next.detail, next.courseId);
    },
  });
  protected readonly configForm = form(this.configModel, (path) =>
    validateStandardSchema(path, configSchema),
  );
  protected readonly configValue = this.configModel.asReadonly();
  hasUnsavedChanges(): boolean {
    return (
      (this.store.routeScreen$() === 'config' &&
        this.configDirty() &&
        !this.store.isSaving$()) ||
      (this.store.editorOpen$() && this.questionForm().dirty())
    );
  }
  protected questionSubmit(event: Event): void {
    event.preventDefault();
    void submit(this.questionForm, async () => {
      const q = this.questionModel();
      this.store.saveQuestion({
        programId: Number(q.programId),
        competencyId: Number(q.competency),
        code: q.code,
        content: q.text,
        questionType: q.type === 'multiple' ? 'MULTIPLE' : 'SINGLE',
        difficulty:
          q.difficulty === 'hard'
            ? 'HARD'
            : q.difficulty === 'easy'
              ? 'EASY'
              : 'MEDIUM',
        status: q.status === 'active' ? 'ACTIVE' : 'INACTIVE',
        explanation: q.explanation,
        points: q.points,
        options: q.options.map((o) => ({
          ...(/^\d+$/.test(o.id) ? { id: Number(o.id) } : {}),
          content: o.text,
          correct: q.correctOptionIds.includes(o.id),
        })),
      });
    });
  }
  protected quizSubmit(event: Event): void {
    event.preventDefault();
    void submit(this.configForm, async () => {
      const q = this.configModel(),
        pool = this.store.configDetail$()?.pool ?? [];
      this.store.saveQuiz(
        {
          courseId: Number(q.courseId),
          title: q.title,
          description: q.description,
          quizType: q.quizType,
          selectionMode: q.source === 'manual' ? 'FIXED' : 'RANDOM_POOL',
          questionCount: q.questionCount,
          timeLimitMinutes: q.minutes,
          passPercent: q.passPct,
          maxAttempts: q.maxAttempts,
          retakeWaitHours: q.retakeWaitHours,
          shuffleQuestions: q.shuffleQuestions,
          shuffleOptions: q.shuffleOptions,
          openAt: q.openAt ? new Date(q.openAt).toISOString() : null,
          closeAt: q.closeAt ? new Date(q.closeAt).toISOString() : null,
          reviewPolicy:
            q.reviewPolicy === 'never'
              ? 'NEVER'
              : q.reviewPolicy === 'after_pass'
                ? 'AFTER_PASS'
                : q.reviewPolicy === 'after_close'
                  ? 'AFTER_CLOSE'
                  : 'AFTER_SUBMIT',
          scoringMode: q.scoringMode,
          scoreMethod: q.scoreMethod,
          graceSeconds: q.graceSeconds,
          allowRetakeAfterPass: q.allowRetakeAfterPass,
          requireLessonsCompleted: q.requireLessonsCompleted,
        },
        {
          items: q.questionIds.map((id, sortNo) => ({
            questionId: Number(id),
            sortNo,
            points:
              pool.find((p) => p.questionId === Number(id))?.pointsOverride ??
              null,
          })),
        },
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
  protected selectPool(id: number, checked: boolean): void {
    this.configModel.update((q) => ({
      ...q,
      questionIds: checked
        ? [...new Set([...q.questionIds, String(id)])]
        : q.questionIds.filter((x) => x !== String(id)),
    }));
  }
  protected poolSelected(id: number): boolean {
    return this.configValue().questionIds.includes(String(id));
  }
  protected configDirty(): boolean {
    const detail = this.store.configDetail$();
    const saved = this.store.completedQuizSave$();
    const savedMatches =
      saved?.quiz.courseId === this.store.selectedCourseId$() &&
      (this.store.routeId$() === 'new' ||
        saved?.quiz.id === Number(this.store.routeId$()));
    const baseline =
      savedMatches &&
      saved &&
      (!detail || saved.quiz.rowVersion >= detail.quiz.rowVersion)
        ? saved
        : detail;
    return (
      JSON.stringify(this.configModel()) !==
      JSON.stringify(quizValue(baseline, this.store.selectedCourseId$()))
    );
  }
}
