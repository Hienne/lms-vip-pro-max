import { Dialog } from '@angular/cdk/dialog';
import { computed, inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  expand,
  filter,
  firstValueFrom,
  of,
  reduce,
  switchMap,
  tap,
} from 'rxjs';
import {
  programAssessmentEndpoints as api,
  courseEndpoints,
  trainingCatalogEndpoints,
  type TrainingProgram,
  type ProgramQuestionQuery,
  type ProgramQuestionRequest,
  type QuizRequestV1,
  type QuizDetailV1,
  type QuizPoolRequestV1,
} from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';
import { confirm, type DataTableSort } from '@lms/ui';

const positiveId = (value: string | null | undefined): number | undefined => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
};

/** Program-scoped bank and course-scoped quizzes; v1 program bank integration. */
@Injectable()
export class AssessmentScreenStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly params = toSignal(this.route.paramMap);
  private readonly queryParams = toSignal(this.route.queryParamMap);
  private readonly navigated = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)),
    { initialValue: null },
  );
  private readonly state = {
    courseId: signal<number | undefined>(undefined),
    programId: signal<number | null | undefined>(undefined),
    programSearch: signal(''),
    programPage: signal(0),
    courseSearch: signal(''),
    coursePage: signal(0),
    questionId: signal<number | undefined>(undefined),
    editorOpen: signal(false),
    questionFilters: signal({
      q: '',
      questionType: '',
      difficulty: '',
      competencyId: '',
      status: '',
    }),
    questionPage: signal(1),
    questionSort: signal<DataTableSort>({ key: 'id', dir: 'desc' }),
    quizPage: signal(1),
    selectedIds: signal<number[]>([]),
    // A successful settings write must not be repeated as a create if the separate pool write fails.
    saveReceipt: signal<QuizDetailV1 | undefined>(undefined),
    completedSave: signal<QuizDetailV1 | undefined>(undefined),
  };
  readonly routeId$ = computed(() => this.params()?.get('id') ?? '');
  readonly routeScreen$ = computed(() => {
    this.navigated();
    const path = this.router.url.split(/[?#]/)[0];
    return path === '/admin/questions'
      ? 'questions'
      : path === '/admin/quizzes'
        ? 'quizzes'
        : path.startsWith('/admin/quizzes/')
          ? 'config'
          : '';
  });
  readonly isNewQuiz$ = computed(
    () => this.routeScreen$() === 'config' && this.routeId$() === 'new',
  );
  /** The type a new quiz starts as: `?quizType=FINAL_EXAM` comes from the course editor's link. */
  readonly newQuizType$ = computed(() =>
    this.queryParams()?.get('quizType') === 'FINAL_EXAM'
      ? ('FINAL_EXAM' as const)
      : ('PRACTICE' as const),
  );
  readonly canCreateQuiz$ = computed(() =>
    this.session.menus$().includes('QUIZ_MANAGEMENT'),
  );
  readonly canManageBank$ = computed(() =>
    this.session.menus$().includes('QUESTION_BANK'),
  );
  readonly courseProgramFilter$ = computed(() => {
    if (this.routeScreen$() === 'config' && !this.isNewQuiz$())
      return undefined;
    return this.state.programId() === undefined
      ? positiveId(this.queryParams()?.get('programId'))
      : (this.state.programId() ?? undefined);
  });
  readonly courseProgramFilterMissing$ = computed(() => {
    const id = this.courseProgramFilter$();
    return id &&
      this.programsData.value() &&
      !this.programsData.value()?.some((p) => p.id === id)
      ? id
      : undefined;
  });
  private readonly coursesData = serverData(
    (query: { q?: string; programId?: number; page: number; size: number }) =>
      this.client.call(courseEndpoints.instructorCourses, { query }),
    {
      params: () =>
        this.routeScreen$() === 'questions'
          ? undefined
          : {
              q: this.state.courseSearch() || undefined,
              programId: this.courseProgramFilter$(),
              page: this.state.coursePage(),
              size: 50,
            },
    },
  );
  private readonly programsData = serverData(
    (ownerOrgId: number) =>
      this.client
        .call(trainingCatalogEndpoints.listPrograms, {
          query: { ownerOrgId, page: 0, size: 100 },
        })
        .pipe(
          expand((page) =>
            page.page + 1 < page.totalPages
              ? this.client.call(trainingCatalogEndpoints.listPrograms, {
                  query: { ownerOrgId, page: page.page + 1, size: 100 },
                })
              : EMPTY,
          ),
          reduce(
            (programs, page) => [...programs, ...page.items],
            [] as TrainingProgram[],
          ),
        ),
    {
      // Reuse the course editor's catalogue source for bank and quiz scope selectors.
      params: () => this.session.user$()?.org?.id,
    },
  );
  readonly programOptions$ = computed(() => this.programsData.value() ?? []);
  readonly programs$ = computed(() => {
    const programs = this.programsData.value();
    if (!programs) return undefined;
    // The existing catalogue API has no q filter; search its loaded names/codes locally.
    const q = this.state.programSearch().trim().toLocaleLowerCase('vi');
    const matching = programs.filter(
      (p) => !q || `${p.name} ${p.code}`.toLocaleLowerCase('vi').includes(q),
    );
    const size = 50;
    const totalPages = Math.ceil(matching.length / size);
    const page = Math.min(
      this.state.programPage(),
      Math.max(0, totalPages - 1),
    );
    return {
      items: matching.slice(page * size, (page + 1) * size),
      page,
      size,
      totalPages,
      totalElements: matching.length,
    };
  });
  readonly programSearch$ = this.state.programSearch.asReadonly();
  private readonly configData = serverData(
    (id: number) => this.client.call(api.quiz, { params: { id } }),
    {
      params: () =>
        this.routeScreen$() === 'config'
          ? positiveId(this.routeId$())
          : undefined,
    },
  );
  readonly courses$ = this.coursesData.value;
  readonly courseSearch$ = this.state.courseSearch.asReadonly();
  readonly configDetail$ = this.configData.value;
  readonly config$ = computed(() => this.configData.value()?.quiz);
  readonly selectedCourseId$ = computed(
    () =>
      this.config$()?.courseId ??
      this.state.courseId() ??
      (this.state.programId() === undefined
        ? positiveId(this.queryParams()?.get('courseId'))
        : undefined) ??
      this.courses$()?.items[0]?.courseId,
  );
  readonly selectedCourseTitle$ = computed(
    () =>
      this.courses$()?.items.find(
        (x) => x.courseId === this.selectedCourseId$(),
      )?.title ??
      (this.courseData.value()?.course.id === this.selectedCourseId$()
        ? this.courseData.value()?.revision.title
        : undefined) ??
      `Khóa học #${this.selectedCourseId$() ?? ''}`,
  );
  readonly selectedCourseMissing$ = computed(() => {
    const id = this.selectedCourseId$();
    return id && !this.courses$()?.items.some((c) => c.courseId === id)
      ? id
      : undefined;
  });
  private readonly courseData = serverData(
    (id: number) =>
      this.client.call(courseEndpoints.getCourse, {
        params: { courseId: id },
        query: {},
      }),
    {
      params: () =>
        this.routeScreen$() === 'config' ? this.selectedCourseId$() : undefined,
    },
  );
  private readonly competenciesData = serverData(
    () => this.client.call(api.competencies, { query: {} }),
    { params: () => (this.session.user$() ? true : undefined) },
  );
  readonly competencies$ = computed(() => this.competenciesData.value() ?? []);
  readonly selectedProgramId$ = computed(() => {
    if (this.routeScreen$() === 'questions')
      return this.courseProgramFilter$() ?? this.programs$()?.items[0]?.id;
    const id = this.selectedCourseId$();
    return (
      (this.courseData.value()?.course.id === id
        ? this.courseData.value()?.revision.programId
        : undefined) ??
      this.courses$()?.items.find((c) => c.courseId === id)?.programId ??
      this.courseProgramFilter$()
    );
  });
  readonly courseProgramMismatch$ = computed(
    () =>
      this.isNewQuiz$() &&
      !!this.courseProgramFilter$() &&
      !!this.selectedCourseId$() &&
      this.courseData.value()?.course.id === this.selectedCourseId$() &&
      this.courseData.value()?.revision.programId !==
        this.courseProgramFilter$(),
  );
  readonly selectedProgramTitle$ = computed(
    () =>
      this.programsData.value()?.find((p) => p.id === this.selectedProgramId$())
        ?.name ??
      this.courses$()?.items.find(
        (c) => c.courseId === this.selectedCourseId$(),
      )?.programName ??
      (this.selectedProgramId$()
        ? 'Chương trình #' + this.selectedProgramId$()
        : 'Chưa gắn chương trình'),
  );
  readonly bankProgramMissing$ = computed(() => {
    const id = this.selectedProgramId$();
    return id && !this.programs$()?.items.some((p) => p.id === id)
      ? { id, name: this.selectedProgramTitle$() }
      : undefined;
  });
  readonly publishBlockedReason$ = computed(() => {
    const detail = this.configDetail$();
    return detail && detail.activePoolSize < detail.quiz.questionCount
      ? `Bộ đề có ${detail.activePoolSize} câu đang dùng, cần ít nhất ${detail.quiz.questionCount} câu trước khi xuất bản.`
      : '';
  });
  private readonly questionQuery = computed<ProgramQuestionQuery | undefined>(
    () => {
      const programId = this.selectedProgramId$();
      if (
        !this.session.user$() ||
        !programId ||
        this.courseProgramMismatch$() ||
        !['questions', 'config'].includes(this.routeScreen$())
      )
        return undefined;
      const f = this.state.questionFilters();
      return {
        programId,
        ...(this.routeScreen$() === 'config'
          ? { courseId: this.selectedCourseId$() }
          : {}),
        page: this.state.questionPage() - 1,
        size: 20,
        sort: `${this.state.questionSort().key},${this.state.questionSort().dir}`,
        q: f.q || undefined,
        questionType:
          f.questionType === 'SINGLE' || f.questionType === 'MULTIPLE'
            ? f.questionType
            : undefined,
        difficulty:
          f.difficulty === 'EASY' ||
          f.difficulty === 'MEDIUM' ||
          f.difficulty === 'HARD'
            ? f.difficulty
            : undefined,
        status:
          f.status === 'ACTIVE' || f.status === 'INACTIVE'
            ? f.status
            : undefined,
        competencyId: positiveId(f.competencyId),
      };
    },
  );
  private readonly questionsData = serverData(
    (query: ProgramQuestionQuery) => this.client.call(api.questions, { query }),
    { params: () => this.questionQuery() },
  );
  private readonly quizzesData = serverData(
    (query: { courseId: number; page: number; size: number; sort: string }) =>
      this.client.call(api.courseQuizList, { query }),
    {
      params: () =>
        this.routeScreen$() === 'quizzes' && this.selectedCourseId$()
          ? {
              courseId: this.selectedCourseId$() as number,
              page: this.state.quizPage() - 1,
              size: 20,
              sort: 'id,desc',
            }
          : undefined,
    },
  );
  private readonly questionData = serverData(
    (id: number) => this.client.call(api.question, { params: { id } }),
    {
      params: () =>
        this.state.editorOpen() ? this.state.questionId() : undefined,
    },
  );
  readonly questions$ = this.questionsData.value;
  readonly questionRows$ = computed(() => this.questions$()?.items ?? []);
  readonly quizList$ = computed(() => this.quizzesData.value()?.items ?? []);
  readonly quizTotal$ = computed(
    () => this.quizzesData.value()?.totalElements ?? 0,
  );
  readonly quizPage$ = this.state.quizPage.asReadonly();
  readonly editorOpen$ = this.state.editorOpen.asReadonly();
  readonly questionDraft$ = this.questionData.value;
  readonly questionLoading$ = this.questionData.isLoading;
  readonly questionLoadError$ = this.questionData.error;
  readonly questionFilters$ = this.state.questionFilters.asReadonly();
  readonly questionPage$ = this.state.questionPage.asReadonly();
  readonly questionSort$ = this.state.questionSort.asReadonly();
  readonly selectedIds$ = this.state.selectedIds.asReadonly();
  readonly isLoading$ = computed(
    () =>
      this.programsData.isLoading() ||
      this.coursesData.isLoading() ||
      this.courseData.isLoading() ||
      this.competenciesData.isLoading() ||
      (this.routeScreen$() === 'questions'
        ? this.questionsData.isLoading()
        : this.routeScreen$() === 'quizzes'
          ? this.quizzesData.isLoading()
          : this.configData.isLoading()),
  );
  readonly error$ = computed(
    () =>
      this.programsData.error() ??
      this.coursesData.error() ??
      this.courseData.error() ??
      this.competenciesData.error() ??
      (this.routeScreen$() === 'quizzes'
        ? this.quizzesData.error()
        : (this.configData.error() ?? this.questionsData.error())),
  );
  readonly poolRows$ = computed(() => {
    const selected = (this.configDetail$()?.pool ?? []).map((p) => ({
      id: p.questionId,
      code: p.code,
      contentPreview: p.contentPreview,
      status: p.status,
    }));
    return [
      ...selected,
      ...this.questionRows$().filter(
        (q) => !selected.some((p) => p.id === q.id),
      ),
    ];
  });
  private readonly questionSave = serverMutation(
    (command: ProgramQuestionRequest) => {
      const draft = this.questionDraft$();
      return draft
        ? this.client.call(api.updateQuestion, {
            params: { id: draft.id },
            query: { expectedVersion: draft.rowVersion },
            body: command,
          })
        : this.client.call(api.createQuestion, { body: command });
    },
    {
      errors: 'alert',
      success: () => 'Đã lưu câu hỏi',
      onSuccess: () => {
        this.setEditorOpen(false);
        this.questionsData.reload();
      },
    },
  );
  private readonly bulkMutation = serverMutation(
    (input: { ids: number[]; action: 'ACTIVE' | 'INACTIVE' | 'delete' }) =>
      input.action === 'delete'
        ? this.client.call(api.bulkDeleteQuestions, {
            body: { ids: input.ids },
          })
        : this.client.call(api.bulkQuestionStatus, {
            body: { ids: input.ids, status: input.action },
          }),
    {
      errors: 'toast',
      success: (_, result) => `Đã cập nhật ${result.affected} câu hỏi`,
      onSuccess: () => {
        this.setSelectedIds([]);
        this.questionsData.reload();
      },
    },
  );
  private readonly quizSave = serverMutation(
    (input: { command: QuizRequestV1; pool: QuizPoolRequestV1 }) => {
      const receipt = this.state.saveReceipt();
      const current =
        receipt &&
        (this.routeId$() === 'new' ||
          receipt.quiz.id === positiveId(this.routeId$()))
          ? receipt
          : this.configDetail$();
      const save = current
        ? this.client.call(api.updateQuiz, {
            params: { id: current.quiz.id },
            query: { expectedVersion: current.quiz.rowVersion },
            body: input.command,
          })
        : this.client.call(api.createQuiz, { body: input.command });
      return save.pipe(
        tap((detail) => this.setSaveReceipt(detail)),
        switchMap((detail) => {
          const before = detail.pool.map((p) => ({
            questionId: p.questionId,
            points: p.pointsOverride,
          }));
          const after = input.pool.items.map(({ questionId, points }) => ({
            questionId,
            points,
          }));
          return JSON.stringify(before) === JSON.stringify(after)
            ? of(detail)
            : this.client.call(api.replacePool, {
                params: { id: detail.quiz.id },
                query: { expectedVersion: detail.quiz.rowVersion },
                body: input.pool,
              });
        }),
        tap((detail) => this.setSaveReceipt(detail)),
      );
    },
    {
      errors: 'alert',
      success: () => 'Đã lưu cấu hình và bộ câu hỏi',
      onSuccess: (detail) => {
        this.state.completedSave.set(detail);
        this.configData.reload();
        void this.router.navigate(['/admin/quizzes', detail.quiz.id], {
          queryParams: { courseId: detail.quiz.courseId },
        });
      },
    },
  );
  private readonly quizState = serverMutation(
    (action: 'publish' | 'close') => {
      const receipt = this.state.saveReceipt();
      const detail =
        receipt && receipt.quiz.id === positiveId(this.routeId$())
          ? receipt
          : this.configDetail$();
      if (!detail) throw new Error('Quiz detail is required');
      const input = {
        params: { id: detail.quiz.id },
        body: { expectedVersion: detail.quiz.rowVersion },
      };
      return this.client.call(
        action === 'publish' ? api.publishQuiz : api.closeQuiz,
        input,
      );
    },
    {
      errors: 'alert',
      success: () => 'Đã cập nhật trạng thái bài kiểm tra',
      onSuccess: (detail) => {
        this.setSaveReceipt(detail);
        this.configData.reload();
      },
    },
  );
  readonly questionSaveError$ = this.questionSave.error;
  readonly completedQuizSave$ = this.state.completedSave.asReadonly();
  readonly invalidQuizId$ = computed(
    () =>
      this.routeScreen$() === 'config' &&
      this.routeId$() !== 'new' &&
      !positiveId(this.routeId$()),
  );
  readonly quizSaveError$ = computed(
    () => this.quizSave.error() ?? this.quizState.error(),
  );
  readonly partialSave$ = computed(
    () => !!this.state.saveReceipt() && !!this.quizSave.error(),
  );
  readonly isBulkSaving$ = this.bulkMutation.isPending;
  readonly isSaving$ = computed(
    () =>
      this.questionSave.isPending() ||
      this.quizSave.isPending() ||
      this.quizState.isPending(),
  );
  private setSaveReceipt(value: QuizDetailV1 | undefined): void {
    this.state.saveReceipt.set(value);
  }
  setEditorOpen(value: boolean): void {
    this.state.editorOpen.set(value);
  }
  private setQuestionId(value: number | undefined): void {
    this.state.questionId.set(value);
  }
  private setCourseId(value: number | undefined): void {
    this.state.courseId.set(value);
  }
  private setCourseSearch(value: string): void {
    this.state.courseSearch.set(value);
  }
  private setCoursePage(value: number): void {
    this.state.coursePage.set(value);
  }
  setQuestionFilter(
    key: keyof ReturnType<typeof this.questionFilters$>,
    value: string,
  ): void {
    this.state.questionFilters.update((f) => ({ ...f, [key]: value }));
    this.setQuestionPage(1);
  }
  setQuestionPage(page: number): void {
    this.state.questionPage.set(page);
    this.setSelectedIds([]);
  }
  setQuestionSort(sort: DataTableSort): void {
    if (['id', 'code', 'updateTime'].includes(sort.key)) {
      this.state.questionSort.set(sort);
      this.setQuestionPage(1);
    }
  }
  setQuizPage(page: number): void {
    this.state.quizPage.set(page);
  }
  setSelectedIds(ids: number[]): void {
    this.state.selectedIds.set(ids);
  }
  toggleQuestion(id: number, checked: boolean): void {
    this.setSelectedIds(
      checked
        ? [...new Set([...this.selectedIds$(), id])]
        : this.selectedIds$().filter((x) => x !== id),
    );
  }
  private setProgramId(value: number | null | undefined): void {
    this.state.programId.set(value);
  }
  private setProgramSearch(value: string): void {
    this.state.programSearch.set(value);
  }
  private setProgramPage(value: number): void {
    this.state.programPage.set(value);
  }
  selectProgram(value: string): void {
    if (this.editorOpen$() || this.isSaving$()) return;
    if (this.partialSave$()) return;
    this.setProgramId(positiveId(value) ?? null);
    this.setCourseId(undefined);
    this.setCoursePage(0);
    this.setCourseSearch('');
    this.setQuizPage(1);
    this.setQuestionPage(1);
  }
  searchPrograms(value: string): void {
    if (this.editorOpen$() || this.isSaving$()) return;
    this.setProgramSearch(value);
    this.setProgramId(null);
    this.setProgramPage(0);
    this.setQuestionPage(1);
  }
  nextProgramPage(delta: number): void {
    const page = this.programs$();
    if (!page || this.editorOpen$() || this.isSaving$()) return;
    this.setProgramId(null);
    this.setProgramPage(
      Math.max(0, Math.min(page.totalPages - 1, page.page + delta)),
    );
    this.setQuestionPage(1);
  }
  selectCourse(value: string): void {
    if (this.editorOpen$() || this.isSaving$() || this.partialSave$()) return;
    this.setCourseId(positiveId(value));
    this.setQuestionPage(1);
    this.setQuizPage(1);
  }
  searchCourses(value: string): void {
    if (this.editorOpen$() || this.isSaving$() || this.partialSave$()) return;
    this.setCourseSearch(value);
    this.setCoursePage(0);
  }
  nextCoursePage(delta: number): void {
    if (this.partialSave$() || this.isSaving$()) return;
    const page = this.courses$();
    if (page)
      this.setCoursePage(
        Math.max(0, Math.min(page.totalPages - 1, page.page + delta)),
      );
  }
  editQuestion(id: number | null): void {
    if (!this.selectedProgramId$() || this.isSaving$()) return;
    this.questionSave.reset();
    this.setQuestionId(id ?? undefined);
    this.setEditorOpen(true);
  }
  cancelQuestion(): void {
    if (!this.isSaving$()) this.setEditorOpen(false);
  }
  retryQuestion(): void {
    this.questionData.reload();
  }
  saveQuestion(command: ProgramQuestionRequest): void {
    if (
      command.programId === this.selectedProgramId$() &&
      !this.isSaving$() &&
      !this.questionLoading$() &&
      !this.questionLoadError$()
    )
      this.questionSave.run(command);
  }
  saveQuiz(command: QuizRequestV1, pool: QuizPoolRequestV1): void {
    if (
      command.courseId === this.selectedCourseId$() &&
      !this.isSaving$() &&
      !this.invalidQuizId$() &&
      !this.courseProgramMismatch$() &&
      this.selectedProgramId$()
    ) {
      this.quizSave.run({ command, pool });
    }
  }
  async changeQuizState(action: 'publish' | 'close'): Promise<void> {
    if (this.isSaving$() || !this.configDetail$()) return;
    const accepted = await firstValueFrom(
      confirm(this.dialog, {
        title:
          action === 'publish'
            ? 'Xuất bản bài kiểm tra?'
            : 'Đóng bài kiểm tra?',
        message:
          action === 'publish'
            ? 'Học viên đủ điều kiện có thể bắt đầu thi. Hãy lưu thay đổi trước khi xuất bản.'
            : 'Các lượt đang làm sẽ được tự nộp với đáp án đã lưu.',
        confirmLabel: action === 'publish' ? 'Xuất bản' : 'Đóng bài kiểm tra',
        tone: 'warning',
      }),
    );
    if (accepted) this.quizState.run(action);
  }
  async bulkQuestions(action: 'ACTIVE' | 'INACTIVE' | 'delete'): Promise<void> {
    if (!this.selectedIds$().length || this.isBulkSaving$()) return;
    if (
      action === 'delete' &&
      !(await firstValueFrom(
        confirm(this.dialog, {
          title: `Xóa ${this.selectedIds$().length} câu hỏi?`,
          message:
            'Câu đang trong bộ đề không thể xóa. Lượt thi cũ được giữ nguyên.',
          confirmLabel: 'Xóa',
          tone: 'danger',
        }),
      ))
    )
      return;
    this.bulkMutation.run({ ids: [...this.selectedIds$()], action });
  }
  retry(): void {
    this.setSaveReceipt(undefined);
    this.programsData.reload();
    this.coursesData.reload();
    this.competenciesData.reload();
    this.courseData.reload();
    this.questionsData.reload();
    this.quizzesData.reload();
    this.configData.reload();
  }
}
