import { Dialog } from '@angular/cdk/dialog';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
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
import { confirm } from '@lms/ui';

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
    snapshot: signal<AttemptSnapshot | undefined>(undefined),
    questionDraft: signal<Question | undefined>(undefined),
    seconds: signal(0),
    seq: signal(0),
    submitting: signal(false),
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
              page: 0,
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
      onSuccess: (snapshot) => this.setSnapshot(snapshot),
    },
  );
  private readonly answerMutation = serverMutation(
    (input: {
      attemptId: string;
      questionId: string;
      optionIds: string[];
      flagged: boolean;
      clientSeq: number;
    }) =>
      this.client.call(assessmentEndpoints.saveAnswer, {
        params: { attemptId: input.attemptId, questionId: input.questionId },
        body: {
          optionIds: input.optionIds,
          flagged: input.flagged,
          clientSeq: input.clientSeq,
        },
      }),
    { errors: 'toast', success: () => 'Đã lưu đáp án' },
  );
  private readonly submitMutation = serverMutation(
    (input: { attemptId: string; auto: boolean }) =>
      this.client.call(assessmentEndpoints.submitAttempt, {
        params: { attemptId: input.attemptId },
        body: { requestId: crypto.randomUUID(), auto: input.auto },
      }),
    {
      errors: 'toast',
      success: () => 'Đã nộp bài',
      onSuccess: (result) => {
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
      errors: 'toast',
      success: (input) =>
        input.id ? 'Đã cập nhật câu hỏi' : 'Đã thêm câu hỏi',
      invalidates: this.refresh,
      onSuccess: () => this.questionsData.reload(),
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
      onSuccess: () => this.quizListData.reload(),
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
  constructor() {
    effect((onCleanup) => {
      const snapshot = this.snapshot$();
      if (!snapshot || snapshot.attempt.status !== 'in_progress') {
        this.state.seconds.set(0);
        return;
      }
      const offset = Date.parse(snapshot.serverNow) - Date.now();
      const tick = () =>
        this.state.seconds.set(
          Math.max(
            0,
            Math.ceil(
              (Date.parse(snapshot.attempt.deadlineAt) -
                (Date.now() + offset)) /
                1000,
            ),
          ),
        );
      tick();
      const timer = setInterval(tick, 1000);
      onCleanup(() => clearInterval(timer));
    });
    effect(() => {
      if (
        this.snapshot$()?.attempt.status === 'in_progress' &&
        this.seconds$() === 0 &&
        !this.state.submitting()
      ) {
        this.state.submitting.set(true);
        this.submit(true);
      }
    });
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
  start(): void {
    this.startMutation.run(this.routeId$());
  }
  selectAnswer(questionId: string, optionIds: string[]): void {
    const snapshot = this.snapshot$();
    if (!snapshot || this.answerMutation.isPending()) return;
    const seq = this.state.seq() + 1;
    this.state.seq.set(seq);
    this.state.snapshot.set({
      ...snapshot,
      attempt: {
        ...snapshot.attempt,
        answers: { ...snapshot.attempt.answers, [questionId]: optionIds },
      },
    });
    this.answerMutation.run({
      attemptId: snapshot.attempt.id,
      questionId,
      optionIds,
      flagged: snapshot.attempt.flags.includes(questionId),
      clientSeq: seq,
    });
  }
  toggleFlag(questionId: string): void {
    const snapshot = this.snapshot$();
    if (!snapshot) return;
    const flags = snapshot.attempt.flags.includes(questionId)
      ? snapshot.attempt.flags.filter((id) => id !== questionId)
      : [...snapshot.attempt.flags, questionId];
    this.state.snapshot.set({
      ...snapshot,
      attempt: { ...snapshot.attempt, flags },
    });
    const seq = this.state.seq() + 1;
    this.state.seq.set(seq);
    this.answerMutation.run({
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
    if (!attempt || (this.state.submitting() && !auto)) return;
    if (!auto) {
      const ok = await firstValueFrom(
        confirm(this.dialog, {
          title: 'Nộp bài kiểm tra?',
          message:
            'Sau khi nộp, bạn không thể sửa đáp án. Câu chưa trả lời được tính là sai.',
          confirmLabel: 'Nộp bài',
          tone: 'warning',
        }),
      );
      if (!ok) return;
    }
    this.state.submitting.set(true);
    this.submitMutation.run({ attemptId: attempt.id, auto });
  }
  editQuestion(question: Question | null): void {
    this.state.questionDraft.set(question ?? undefined);
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
