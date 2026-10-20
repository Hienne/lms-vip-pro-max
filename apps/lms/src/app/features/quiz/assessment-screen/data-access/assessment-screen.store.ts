import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  filter,
  forkJoin,
  of,
  from,
  concatMap,
  toArray,
  switchMap,
} from 'rxjs';
import { firstValueFrom } from 'rxjs';
import {
  assessmentEndpoints,
  type AttemptSnapshot,
  type Question,
  type SaveQuestion,
  type SaveQuizConfig,
} from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { invalidation } from '../../../../core/data-access/invalidation';
import { LearningChanges } from '../../../../core/data-access/learning-changes';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { confirm, type DataTableSort } from '@lms/ui';

interface PendingAnswer {
  attemptId: string;
  questionId: string;
  optionIds: string[];
  flagged: boolean;
  clientSeq: number;
}
@Injectable()
export class AssessmentScreenStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly changes = inject(LearningChanges);
  private readonly id = toSignal(this.route.paramMap);
  private readonly navigated = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    { initialValue: null },
  );
  private readonly state = {
    screen: signal(''),
    current: signal(0),
    historyPage: signal(0),
    snapshot: signal<AttemptSnapshot | undefined>(undefined),
    questionDraft: signal<Question | undefined>(undefined),
    seconds: signal(0),
    seq: signal(0),
    editorOpen: signal(false),
    questionFilters: signal({
      q: '',
      type: '',
      difficulty: '',
      competency: '',
      lessonId: '',
      status: '',
    }),
    questionPage: signal(1),
    questionSort: signal<DataTableSort>({ key: 'code', dir: 'asc' }),
    selectedIds: signal<string[]>([]),
    reviewOpen: signal(false),
    autoHandledId: signal(''),
    pendingAnswers: signal<PendingAnswer[]>([]),
  };
  readonly routeId$ = computed(() => this.id()?.get('id') ?? 'q1');
  readonly routeScreen$ = computed(() => {
    this.navigated();
    const path = this.router.url.split(/[?#]/)[0];
    if (path === '/quiz') return 'hub';
    if (path === '/admin/questions') return 'questions';
    if (path === '/admin/quizzes') return 'quizzes';
    if (path.startsWith('/admin/quizzes/')) return 'config';
    if (path.endsWith('/take')) return 'take';
    if (path.includes('/result/')) return 'result';
    if (path.endsWith('/attempts')) return 'history';
    return 'intro';
  });
  readonly currentIndex$ = this.state.current.asReadonly();
  readonly snapshot$ = computed(
    () => this.state.snapshot() ?? this.currentData.value() ?? undefined,
  );
  readonly seconds$ = this.state.seconds.asReadonly();
  readonly selectedQuestion$ = computed(
    () => this.snapshot$()?.questions[this.state.current()],
  );
  private readonly questionsData = serverData(
    (query: { page: number; size: number; sort: string }) =>
      this.client.call(assessmentEndpoints.questions, { query }),
    {
      params: () =>
        ['questions', 'config'].includes(this.routeScreen$())
          ? { page: 0, size: 100, sort: 'updatedAt,desc' }
          : undefined,
    },
  );
  private readonly quizListData = serverData(
    (query: { page: number; size: number; sort: string }) =>
      this.client.call(assessmentEndpoints.quizzes, { query }),
    {
      params: () =>
        ['hub', 'quizzes'].includes(this.routeScreen$())
          ? { page: 0, size: 50, sort: 'title,asc' }
          : undefined,
    },
  );
  private readonly optionsData = serverData(() =>
    this.client.call(assessmentEndpoints.assessmentOptions, { query: {} }),
  );
  private readonly configData = serverData(
    (quizId: string) =>
      this.client.call(assessmentEndpoints.quiz, { params: { quizId } }),
    {
      params: () =>
        this.routeScreen$() === 'config' && this.routeId$() !== 'new'
          ? this.routeId$()
          : undefined,
    },
  );
  private readonly introData = serverData(
    (quizId: string) =>
      this.client.call(assessmentEndpoints.quizIntro, { params: { quizId } }),
    {
      params: () =>
        this.routeScreen$() === 'intro' ? this.routeId$() : undefined,
      reloadOn: this.changes.results,
    },
  );
  private readonly currentData = serverData(
    (quizId: string) =>
      this.client.call(assessmentEndpoints.currentAttempt, {
        params: { quizId },
      }),
    {
      params: () =>
        this.routeScreen$() === 'take' ? this.routeId$() : undefined,
    },
  );
  private readonly historyData = serverData(
    (params: { quizId: string; page: number; size: number; sort: string }) =>
      this.client.call(assessmentEndpoints.attempts, {
        params: { quizId: params.quizId },
        query: { page: params.page, size: params.size, sort: params.sort },
      }),
    {
      params: () =>
        this.routeScreen$() === 'history'
          ? {
              quizId: this.routeId$(),
              page: this.state.historyPage(),
              size: 20,
              sort: 'submittedAt,desc',
            }
          : undefined,
    },
  );
  private readonly resultData = serverData(
    (params: { quizId: string; attemptId: string }) =>
      this.client.call(assessmentEndpoints.attemptResult, { params }),
    {
      params: () => {
        this.navigated();
        const parts = this.router.url.split('/');
        return this.routeScreen$() === 'result'
          ? { quizId: this.routeId$(), attemptId: parts.at(-1) ?? '' }
          : undefined;
      },
      reloadOn: this.changes.results,
    },
  );
  private readonly refresh = invalidation();
  readonly questions$ = computed(() => this.questionsData.value());
  readonly quizList$ = computed(() => this.quizListData.value()?.items ?? []);
  readonly options$ = this.optionsData.value;
  readonly config$ = this.configData.value;
  readonly intro$ = this.introData.value;
  readonly history$ = this.historyData.value;
  readonly historyPage$ = this.state.historyPage.asReadonly();
  setHistoryPage(page: number): void {
    this.state.historyPage.set(page);
  }
  readonly result$ = this.resultData.value;
  readonly isLoading$ = computed(() => {
    switch (this.routeScreen$()) {
      case 'questions':
        return this.questionsData.isLoading();
      case 'quizzes':
      case 'hub':
        return this.quizListData.isLoading();
      case 'config':
        return this.configData.isLoading();
      case 'intro':
        return this.introData.isLoading();
      case 'take':
        return this.currentData.isLoading();
      case 'history':
        return this.historyData.isLoading();
      case 'result':
        return this.resultData.isLoading();
      default:
        return false;
    }
  });
  readonly error$ = computed(() => {
    switch (this.routeScreen$()) {
      case 'questions':
        return this.questionsData.error();
      case 'quizzes':
      case 'hub':
        return this.quizListData.error();
      case 'config':
        return this.configData.error();
      case 'intro':
        return this.introData.error();
      case 'take':
        return this.currentData.error();
      case 'history':
        return this.historyData.error();
      case 'result':
        return this.resultData.error();
      default:
        return undefined;
    }
  });
  private readonly startMutation = serverMutation(
    (quizId: string) =>
      this.client.call(assessmentEndpoints.startAttempt, {
        params: { quizId },
        body: { requestId: crypto.randomUUID() },
      }),
    {
      errors: 'toast',
      success: () => 'Đã bắt đầu lượt thi',
      onSuccess: () => {
        void this.router.navigate(['/quiz', this.routeId$(), 'take']);
      },
    },
  );
  private flushAnswers(answers: PendingAnswer[]) {
    return from(answers).pipe(
      concatMap((input) =>
        this.client.call(assessmentEndpoints.saveAnswer, {
          params: { attemptId: input.attemptId, questionId: input.questionId },
          body: {
            optionIds: input.optionIds,
            flagged: input.flagged,
            clientSeq: input.clientSeq,
          },
        }),
      ),
      toArray(),
    );
  }
  private readonly answerMutation = serverMutation(
    (answers: PendingAnswer[]) => this.flushAnswers(answers),
    {
      errors: 'alert',
      success: () => null,
      onSuccess: () => this.setPendingAnswers([]),
    },
  );
  private readonly submitMutation = serverMutation(
    (input: { attemptId: string; auto: boolean; pending: PendingAnswer[] }) =>
      this.flushAnswers(input.pending).pipe(
        switchMap(() =>
          this.client.call(assessmentEndpoints.submitAttempt, {
            params: { attemptId: input.attemptId },
            body: { requestId: crypto.randomUUID(), auto: input.auto },
          }),
        ),
      ),
    {
      errors: 'toast',
      success: () => 'Đã nộp bài',
      onSuccess: (result) => {
        this.setPendingAnswers([]);
        const current = this.snapshot$();
        if (current)
          this.setSnapshot({
            ...current,
            attempt: { ...current.attempt, status: 'submitted' },
          });
        this.changes.results.bump();
        void this.router.navigateByUrl(result.resultPath);
      },
    },
  );
  private readonly questionSave = serverMutation(
    (input: { id?: string; command: SaveQuestion }) =>
      input.id
        ? this.client.call(assessmentEndpoints.saveQuestion, {
            params: { questionId: input.id },
            body: input.command,
          })
        : this.client.call(assessmentEndpoints.createQuestion, {
            body: input.command,
          }),
    {
      errors: 'alert',
      success: (input) =>
        input.id ? 'Đã cập nhật câu hỏi' : 'Đã thêm câu hỏi',
      invalidates: this.refresh,
      onSuccess: () => {
        this.setEditorOpen(false);
        this.questionsData.reload();
      },
    },
  );
  private readonly questionStatus = serverMutation(
    (input: { id: string; status: 'active' | 'inactive' }) =>
      this.client.call(assessmentEndpoints.questionStatus, {
        params: { questionId: input.id },
        body: { status: input.status },
      }),
    {
      errors: 'toast',
      success: () => 'Đã cập nhật trạng thái câu hỏi',
      invalidates: this.refresh,
      onSuccess: () => this.questionsData.reload(),
    },
  );
  private readonly questionDelete = serverMutation(
    (id: string) =>
      this.client.call(assessmentEndpoints.deleteQuestion, {
        params: { questionId: id },
      }),
    {
      errors: 'toast',
      success: () => 'Đã xóa câu hỏi',
      invalidates: this.refresh,
      onSuccess: () => this.questionsData.reload(),
    },
  );
  private readonly quizSave = serverMutation(
    (input: { id?: string; command: SaveQuizConfig }) =>
      input.id
        ? this.client.call(assessmentEndpoints.saveQuiz, {
            params: { quizId: input.id },
            body: input.command,
          })
        : this.client.call(assessmentEndpoints.createQuiz, {
            body: input.command,
          }),
    {
      errors: 'toast',
      success: () => 'Đã lưu cấu hình bài kiểm tra',
      invalidates: this.refresh,
      onSuccess: (quiz) => {
        this.configData.reload();
        void this.router.navigate(['/admin/quizzes', quiz.id]);
      },
    },
  );
  readonly isSaving$ = computed(
    () =>
      this.answerMutation.isPending() ||
      this.submitMutation.isPending() ||
      this.questionSave.isPending() ||
      this.quizSave.isPending() ||
      this.questionStatus.isPending() ||
      this.questionDelete.isPending(),
  );
  readonly editorOpen$ = this.state.editorOpen.asReadonly();
  readonly questionFilters$ = this.state.questionFilters.asReadonly();
  readonly questionPage$ = this.state.questionPage.asReadonly();
  readonly questionSort$ = this.state.questionSort.asReadonly();
  readonly selectedIds$ = this.state.selectedIds.asReadonly();
  readonly reviewOpen$ = this.state.reviewOpen.asReadonly();
  readonly answerError$ = this.answerMutation.error;
  readonly hasUnsavedAnswers$ = computed(
    () => this.state.pendingAnswers().length > 0,
  );
  readonly isStarting$ = this.startMutation.isPending;
  readonly isSubmitting$ = this.submitMutation.isPending;
  readonly questionSaveError$ = this.questionSave.error;
  readonly questionStats$ = computed(() => {
    const rows = this.questions$()?.items ?? [];
    return {
      active: rows.filter((x) => x.status === 'active').length,
      single: rows.filter((x) => x.type === 'single').length,
      multiple: rows.filter((x) => x.type === 'multiple').length,
      inactive: rows.filter((x) => x.status !== 'active').length,
    };
  });
  readonly filteredQuestions$ = computed(() => {
    const f = this.questionFilters$(),
      sort = this.questionSort$();
    const rows = (this.questions$()?.items ?? []).filter(
      (x) =>
        (!f.q ||
          (x.code + ' ' + x.text)
            .toLocaleLowerCase('vi')
            .includes(f.q.toLocaleLowerCase('vi'))) &&
        (!f.type || x.type === f.type) &&
        (!f.difficulty || x.difficulty === f.difficulty) &&
        (!f.competency || x.competency === f.competency) &&
        (!f.lessonId || x.lessonId === f.lessonId) &&
        (!f.status || x.status === f.status),
    );
    const value = (row: Question): string | number => {
      if (sort.key === 'usedIn') return row.usedIn.length;
      if (sort.key === 'difficulty')
        return ['easy', 'medium', 'hard'].indexOf(row.difficulty);
      return String(row[sort.key as keyof Question] ?? '');
    };
    return rows.sort(
      (a, b) =>
        String(value(a)).localeCompare(String(value(b)), 'vi', {
          numeric: true,
        }) * (sort.dir === 'asc' ? 1 : -1),
    );
  });
  readonly questionRows$ = computed(() =>
    this.filteredQuestions$().slice(
      (this.questionPage$() - 1) * 10,
      this.questionPage$() * 10,
    ),
  );
  readonly answeredCount$ = computed(
    () =>
      this.snapshot$()?.questions.filter(
        (q) => this.snapshot$()?.attempt.answers[q.id]?.length,
      ).length ?? 0,
  );
  readonly questionCells$ = computed(
    () =>
      this.snapshot$()?.questions.map((q) => ({
        answered: !!this.snapshot$()?.attempt.answers[q.id]?.length,
        flagged: this.snapshot$()?.attempt.flags.includes(q.id) ?? false,
      })) ?? [],
  );
  private readonly clock = computed(
    () => {
      const s = this.snapshot$();
      return s
        ? {
            id: s.attempt.id,
            deadlineAt: s.attempt.deadlineAt,
            status: s.attempt.status,
            serverNow: s.serverNow,
          }
        : undefined;
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  private readonly bulkMutation = serverMutation(
    (input: { ids: string[]; action: 'active' | 'inactive' | 'delete' }) =>
      input.ids.length
        ? forkJoin(
            input.ids.map((id) =>
              input.action === 'delete'
                ? this.client.call(assessmentEndpoints.deleteQuestion, {
                    params: { questionId: id },
                  })
                : this.client.call(assessmentEndpoints.questionStatus, {
                    params: { questionId: id },
                    body: { status: input.action },
                  }),
            ),
          )
        : of([]),
    {
      errors: 'toast',
      success: () => 'Đã cập nhật các câu hỏi đã chọn',
      onSuccess: () => {
        this.setSelectedIds([]);
        this.questionsData.reload();
      },
    },
  );
  readonly isBulkSaving$ = this.bulkMutation.isPending;
  constructor() {
    effect((onCleanup) => {
      const clock = this.clock();
      untracked(() => {
        if (!clock || clock.status !== 'in_progress') {
          this.setSeconds(0);
          return;
        }
        const offset = Date.parse(clock.serverNow) - Date.now();
        const tick = () => {
          const left = Math.max(
            0,
            Math.ceil(
              (Date.parse(clock.deadlineAt) - Date.now() - offset) / 1000,
            ),
          );
          this.setSeconds(left);
          if (
            left === 0 &&
            this.state.autoHandledId() !== clock.id &&
            !this.isSaving$()
          ) {
            this.setAutoHandledId(clock.id);
            void this.submit(true);
          }
        };
        tick();
        const timer = setInterval(tick, 1000);
        onCleanup(() => clearInterval(timer));
      });
    });
  }
  private setSeconds(value: number): void {
    this.state.seconds.set(value);
  }
  private setAutoHandledId(value: string): void {
    this.state.autoHandledId.set(value);
  }
  setEditorOpen(value: boolean): void {
    this.state.editorOpen.set(value);
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
  }
  setQuestionSort(sort: DataTableSort): void {
    this.state.questionSort.set(sort);
  }
  setSelectedIds(ids: string[]): void {
    this.state.selectedIds.set(ids);
  }
  toggleQuestion(id: string, checked: boolean): void {
    this.setSelectedIds(
      checked
        ? [...new Set([...this.selectedIds$(), id])]
        : this.selectedIds$().filter((x) => x !== id),
    );
  }
  setReviewOpen(open: boolean): void {
    this.state.reviewOpen.set(open);
  }
  cancelQuestion(): void {
    this.setEditorOpen(false);
  }
  async bulkQuestions(action: 'active' | 'inactive' | 'delete'): Promise<void> {
    if (!this.selectedIds$().length) return;
    if (
      action === 'delete' &&
      !(await firstValueFrom(
        confirm(this.dialog, {
          title: `Xóa ${this.selectedIds$().length} câu hỏi?`,
          message:
            'Câu hỏi đang được dùng trong bài kiểm tra không thể xóa. Thao tác không thể hoàn tác.',
          confirmLabel: 'Xóa',
          tone: 'danger',
        }),
      ))
    )
      return;
    this.bulkMutation.run({ ids: [...this.selectedIds$()], action });
  }
  private setPendingAnswers(answers: PendingAnswer[]): void {
    this.state.pendingAnswers.set(answers);
  }
  private setSequence(seq: number): void {
    this.state.seq.set(seq);
  }
  private queueAnswer(answer: PendingAnswer): void {
    this.setPendingAnswers(
      [
        ...this.state
          .pendingAnswers()
          .filter((x) => x.questionId !== answer.questionId),
        answer,
      ].sort((a, b) => a.clientSeq - b.clientSeq),
    );
    this.retryAnswers();
  }
  retryAnswers(): void {
    if (!this.isSaving$() && this.state.pendingAnswers().length)
      this.answerMutation.run([...this.state.pendingAnswers()]);
  }
  private setSnapshot(value: AttemptSnapshot): void {
    this.state.snapshot.set(value);
  }
  retry(): void {
    switch (this.routeScreen$()) {
      case 'questions':
        this.questionsData.reload();
        break;
      case 'config':
        this.configData.reload();
        break;
      case 'intro':
        this.introData.reload();
        break;
      case 'take':
        this.currentData.reload();
        break;
      case 'history':
        this.historyData.reload();
        break;
      case 'result':
        this.resultData.reload();
        break;
      default:
        this.quizListData.reload();
    }
  }
  async start(): Promise<void> {
    const data = this.intro$();
    if (data?.block || this.isStarting$()) return;
    if (
      !data?.pendingAttemptId &&
      data &&
      !(await firstValueFrom(
        confirm(this.dialog, {
          title: 'Bắt đầu làm bài?',
          message: `Bạn có ${data.quiz.minutes} phút cho ${data.quiz.questionCount} câu. Lượt thi sẽ được tính khi bắt đầu.`,
          confirmLabel: 'Bắt đầu',
        }),
      ))
    )
      return;
    this.startMutation.run(this.routeId$());
  }
  chooseOption(
    questionId: string,
    optionId: string,
    checked: boolean,
    multiple: boolean,
  ): void {
    const current = this.snapshot$()?.attempt.answers[questionId] ?? [];
    this.selectAnswer(
      questionId,
      multiple
        ? checked
          ? [...new Set([...current, optionId])]
          : current.filter((x) => x !== optionId)
        : [optionId],
    );
  }
  handleQuizKey(event: KeyboardEvent): void {
    if (
      this.routeScreen$() !== 'take' ||
      this.dialog.openDialogs.length ||
      (event.target instanceof HTMLElement &&
        event.target.matches(
          'textarea,input:not([type=radio]):not([type=checkbox]),select,button',
        ))
    )
      return;
    const q = this.selectedQuestion$();
    if (!q) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.goto(this.currentIndex$() + 1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.goto(this.currentIndex$() - 1);
    }
    const option = /^[1-8]$/.test(event.key)
      ? q.options[Number(event.key) - 1]
      : undefined;
    if (option) {
      event.preventDefault();
      this.chooseOption(
        q.id,
        option.id,
        !(this.snapshot$()?.attempt.answers[q.id] ?? []).includes(option.id),
        q.type === 'multiple',
      );
    }
  }
  selectAnswer(questionId: string, optionIds: string[]): void {
    const snapshot = this.snapshot$();
    if (!snapshot || this.answerMutation.isPending()) return;
    const seq = Math.max(this.state.seq(), snapshot.attempt.revision) + 1;
    this.setSequence(seq);
    this.setSnapshot({
      ...snapshot,
      attempt: {
        ...snapshot.attempt,
        answers: { ...snapshot.attempt.answers, [questionId]: optionIds },
      },
    });
    this.queueAnswer({
      attemptId: snapshot.attempt.id,
      questionId,
      optionIds,
      flagged: snapshot.attempt.flags.includes(questionId),
      clientSeq: seq,
    });
  }
  toggleFlag(questionId: string): void {
    const snapshot = this.snapshot$();
    if (!snapshot || this.isSaving$()) return;
    const flags = snapshot.attempt.flags.includes(questionId)
      ? snapshot.attempt.flags.filter((id) => id !== questionId)
      : [...snapshot.attempt.flags, questionId];
    this.setSnapshot({
      ...snapshot,
      attempt: { ...snapshot.attempt, flags },
    });
    const seq = Math.max(this.state.seq(), snapshot.attempt.revision) + 1;
    this.setSequence(seq);
    this.queueAnswer({
      attemptId: snapshot.attempt.id,
      questionId,
      optionIds: snapshot.attempt.answers[questionId] ?? [],
      flagged: flags.includes(questionId),
      clientSeq: seq,
    });
  }
  goto(index: number): void {
    const total = this.snapshot$()?.questions.length ?? 0;
    this.state.current.set(Math.max(0, Math.min(index, total - 1)));
  }
  async submit(auto = false): Promise<void> {
    const attempt = this.snapshot$()?.attempt;
    if (!attempt || this.isSubmitting$() || this.answerMutation.isPending())
      return;
    if (!auto) {
      const ok = await firstValueFrom(
        confirm(this.dialog, {
          title: 'Nộp bài kiểm tra?',
          message: `Còn ${(this.snapshot$()?.questions.length ?? 0) - this.answeredCount$()} câu chưa trả lời và ${attempt.flags.length} câu đánh dấu xem lại. Sau khi nộp, bạn không thể thay đổi đáp án. Câu chưa trả lời được tính là sai.`,
          cancelLabel: 'Xem lại',
          confirmLabel: 'Nộp bài',
          tone: 'warning',
        }),
      );
      if (!ok) return;
    }
    this.submitMutation.run({
      attemptId: attempt.id,
      auto,
      pending: this.state.pendingAnswers(),
    });
  }
  editQuestion(question: Question | null): void {
    this.questionSave.reset();
    this.setQuestionDraft(question ?? undefined);
    this.setEditorOpen(true);
  }
  private setQuestionDraft(question: Question | undefined): void {
    this.state.questionDraft.set(question);
  }
  readonly questionDraft$ = this.state.questionDraft.asReadonly();
  saveQuestion(command: SaveQuestion, id?: string): void {
    this.questionSave.run({ command, id });
  }
  saveQuiz(command: SaveQuizConfig, id?: string): void {
    this.quizSave.run({ command, id });
  }
  changeQuestionStatus(id: string, status: 'active' | 'inactive'): void {
    this.questionStatus.run({ id, status });
  }
  deleteQuestion(id: string): void {
    this.questionDelete.run(id);
  }
}
