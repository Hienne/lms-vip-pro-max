import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  learnerQuizEndpoints,
  type AttemptSession,
  type SaveAnswerBody,
  type SessionQuestion,
} from '@lms/contracts';
import { confirm, NOW, Toaster } from '@lms/ui';
import {
  catchError,
  concat,
  concatMap,
  defer,
  EMPTY,
  firstValueFrom,
  Subject,
  tap,
} from 'rxjs';
import { LearningChanges } from '../../../../core/data-access/learning-changes';
import { serverData } from '../../../../core/data-access/server-data';
import { toAppError } from '../../../../core/errors/app-error';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { routeId } from './route-id';

type Job =
  | { readonly kind: 'save'; readonly questionId: number }
  | { readonly kind: 'submit'; readonly auto: boolean };

interface Choice {
  readonly selectedOptionIds: number[];
  readonly flagged: boolean;
}

/**
 * Taking a quiz. The server owns the attempt: opening the screen asks it to start the attempt (or
 * return the one in progress, so a reload or another device continues it), every choice is sent
 * as soon as it is made, and the countdown is the server's deadline measured on the server's
 * clock. Saves and the submit go through one queue so the submit never overtakes a save.
 */
@Injectable()
export class QuizTakeStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly toaster = inject(Toaster);
  private readonly changes = inject(LearningChanges);
  private readonly clock = inject(NOW);

  readonly quizId$ = routeId(this.route, 'id');

  private readonly sessionData = serverData(
    (quizId: number) =>
      this.client.call(learnerQuizEndpoints.startAttempt, {
        params: { quizId },
      }),
    { params: () => this.quizId$() },
  );

  readonly session$ = this.sessionData.value;
  readonly loadError$ = this.sessionData.error;

  /** What the learner has chosen, by attempt question; starts from what the server saved. */
  private readonly choices = linkedSignal<
    AttemptSession | undefined,
    ReadonlyMap<number, Choice>
  >({
    source: this.session$,
    computation: (session) =>
      new Map(
        (session?.questions ?? []).map((q) => [
          q.attemptQuestionId,
          { selectedOptionIds: q.selectedOptionIds, flagged: q.flagged },
        ]),
      ),
  });

  /** Questions whose last save failed, with the server's message. */
  private readonly failed = signal<ReadonlyMap<number, string>>(new Map());

  readonly current$ = signal(0);
  readonly isSaving$ = signal(false);
  readonly isSubmitting$ = signal(false);

  /** The dealt questions with the learner's current choice laid over what the server saved. */
  readonly questions$ = computed((): readonly SessionQuestion[] => {
    const choices = this.choices();
    return (this.session$()?.questions ?? []).map((q) => ({
      ...q,
      ...(choices.get(q.attemptQuestionId) ?? {}),
    }));
  });

  readonly answeredCount$ = computed(
    () => this.questions$().filter((q) => q.selectedOptionIds.length).length,
  );
  readonly flaggedCount$ = computed(
    () => this.questions$().filter((q) => q.flagged).length,
  );

  /** The failure to show with "Thử lại", or `undefined` when every choice is saved. */
  readonly saveError$ = computed((): string | undefined =>
    this.failed().size ? [...this.failed().values()][0] : undefined,
  );

  // The clock. The deadline and the server's "now" arrive together; the difference between the
  // server's "now" and this device's clock at that moment is kept, so a wrong device clock moves
  // neither the deadline nor the countdown.
  private readonly timing = linkedSignal<
    AttemptSession | undefined,
    { readonly deadline: number; readonly offset: number } | undefined
  >({
    source: this.session$,
    computation: (session) =>
      session && this.timingOf(session.deadlineAt, session.serverTime),
  });
  private readonly now = signal(this.clock());

  readonly seconds$ = computed((): number => {
    const timing = this.timing();
    if (!timing) return 0;
    return Math.max(
      0,
      Math.ceil((timing.deadline - (this.now() + timing.offset)) / 1000),
    );
  });

  private readonly jobs = new Subject<Job>();
  private submitted = false;

  constructor() {
    const timer = setInterval(() => this.now.set(this.clock()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    this.jobs
      .pipe(
        concatMap((job) => this.run(job)),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Time is up: the server grades what it has saved.
    effect(() => {
      const session = this.session$();
      if (!session || this.submitted) return;
      if (session.expired || this.seconds$() === 0)
        untracked(() => void this.submit(true));
    });
  }

  private timingOf(deadlineAt: string, serverTime: string) {
    return {
      deadline: Date.parse(deadlineAt),
      offset: Date.parse(serverTime) - this.clock(),
    };
  }

  retryLoad(): void {
    this.sessionData.reload();
  }

  goto(index: number): void {
    const last = (this.session$()?.questions.length ?? 1) - 1;
    this.current$.set(Math.min(Math.max(0, index), last));
  }

  chooseOption(questionId: number, optionId: number, checked: boolean): void {
    const question = this.questions$().find(
      (q) => q.attemptQuestionId === questionId,
    );
    if (!question || this.isSubmitting$()) return;
    const selected: number[] =
      question.questionType === 'MULTIPLE'
        ? checked
          ? [...new Set([...question.selectedOptionIds, optionId])]
          : question.selectedOptionIds.filter((id) => id !== optionId)
        : [optionId];
    this.update(questionId, { selectedOptionIds: selected });
  }

  toggleFlag(questionId: number): void {
    const question = this.questions$().find(
      (q) => q.attemptQuestionId === questionId,
    );
    if (question && !this.isSubmitting$())
      this.update(questionId, { flagged: !question.flagged });
  }

  /** Sends again every choice whose last save failed. */
  retrySave(): void {
    for (const questionId of this.failed().keys())
      this.jobs.next({ kind: 'save', questionId });
  }

  async submit(auto = false): Promise<void> {
    if (this.isSubmitting$() || this.submitted) return;
    if (!auto) {
      const left = this.questions$().length - this.answeredCount$();
      const flagged = this.flaggedCount$();
      const note = [
        left
          ? `Còn ${left} câu chưa trả lời, các câu này được tính là sai.`
          : 'Bạn đã trả lời tất cả các câu.',
        flagged ? `Có ${flagged} câu đang đánh dấu xem lại.` : '',
        'Sau khi nộp, bạn không thể thay đổi đáp án.',
      ]
        .filter(Boolean)
        .join(' ');
      const ok = await firstValueFrom(
        confirm(this.dialog, {
          title: 'Nộp bài kiểm tra?',
          message: note,
          confirmLabel: 'Nộp bài',
          tone: left ? 'danger' : 'primary',
        }),
      );
      if (!ok) return;
    }
    this.isSubmitting$.set(true);
    this.jobs.next({ kind: 'submit', auto });
  }

  private update(questionId: number, patch: Partial<Choice>): void {
    const previous = this.choices().get(questionId) ?? {
      selectedOptionIds: [],
      flagged: false,
    };
    this.choices.set(
      new Map(this.choices()).set(questionId, { ...previous, ...patch }),
    );
    this.jobs.next({ kind: 'save', questionId });
  }

  private run(job: Job) {
    return job.kind === 'save' ? this.save(job.questionId) : this.finish(job);
  }

  /** Sends the question's choice as it is now, so a queued older save is not sent stale. */
  private save(questionId: number) {
    const session = this.session$();
    const choice = this.choices().get(questionId);
    if (!session || !choice) return EMPTY;
    const body: SaveAnswerBody = {
      selectedOptionIds: [...choice.selectedOptionIds],
      flagged: choice.flagged,
    };
    this.isSaving$.set(true);
    return this.client
      .call(learnerQuizEndpoints.saveAnswer, {
        params: { attemptId: session.attemptId, attemptQuestionId: questionId },
        body,
      })
      .pipe(
        tap((receipt) => {
          this.failed.update((failed) => {
            const next = new Map(failed);
            next.delete(questionId);
            return next;
          });
          this.timing.set(
            this.timingOf(receipt.deadlineAt, receipt.serverTime),
          );
        }),
        catchError((error: unknown) => {
          this.failed.update((failed) =>
            new Map(failed).set(questionId, toAppError(error).message),
          );
          return EMPTY;
        }),
        tap({ finalize: () => this.isSaving$.set(false) }),
      );
  }

  /** Re-sends what failed, then submits; a submit the server refuses leaves the learner here. */
  private finish(job: Extract<Job, { kind: 'submit' }>) {
    const session = this.session$();
    if (!session) return EMPTY;
    return concat(
      ...[...this.failed().keys()].map((id) => this.save(id)),
      defer(() => this.sendSubmit(session.attemptId, job.auto)),
    );
  }

  private sendSubmit(attemptId: number, auto: boolean) {
    if (this.failed().size && !auto) {
      this.isSubmitting$.set(false);
      this.toaster.error(
        'Chưa nộp được bài',
        'Một số đáp án chưa lưu được. Nhấn Thử lại rồi nộp bài.',
      );
      return EMPTY;
    }
    return this.client
      .call(learnerQuizEndpoints.submitAttempt, { params: { attemptId } })
      .pipe(
        tap((result) => {
          this.submitted = true;
          this.changes.results.bump();
          void this.router.navigate([
            '/quiz',
            result.quizId,
            'result',
            result.attemptId,
          ]);
        }),
        catchError((error: unknown) => {
          this.isSubmitting$.set(false);
          const { title, message } = toAppError(error);
          this.toaster.error(title || 'Chưa nộp được bài', message);
          return EMPTY;
        }),
      );
  }
}
