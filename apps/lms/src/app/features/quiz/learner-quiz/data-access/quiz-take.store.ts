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
 * clock.
 *
 * Saves and the submit go through one ordered queue (`jobs`) instead of `serverMutation`, and that
 * is the one deliberate exception to "every call goes through `serverData` / `serverMutation`":
 * a mutation cancels the run in flight, which would drop a choice that is still being saved, and
 * the submit must never overtake a save.
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

  private readonly state = {
    /** Zero-based index of the question on screen. */
    current: signal(0),
    isSaving: signal(false),
    isSubmitting: signal(false),
    /** The attempt was submitted from this screen. */
    done: signal(false),
    /** Questions whose last save failed, with the server's message. */
    failed: signal<ReadonlyMap<number, string>>(new Map()),
    /** What the learner has chosen, by attempt question; starts from what the server saved. */
    choices: linkedSignal<
      AttemptSession | undefined,
      ReadonlyMap<number, Choice>
    >({
      source: () => this.sessionData.value(),
      computation: (session) =>
        new Map(
          (session?.questions ?? []).map((q) => [
            q.attemptQuestionId,
            { selectedOptionIds: q.selectedOptionIds, flagged: q.flagged },
          ]),
        ),
    }),
    // The clock. The server sends the deadline and its own "now" together; their difference is the
    // time left at that moment, and only the time passed on this device since then is subtracted.
    // The device's clock is never compared with the server's, so a wrong one changes nothing.
    timing: linkedSignal<
      AttemptSession | undefined,
      { readonly leftMs: number; readonly receivedAt: number } | undefined
    >({
      source: () => this.sessionData.value(),
      computation: (session) =>
        session && this.timingOf(session.deadlineAt, session.serverTime),
    }),
    now: signal(this.clock()),
  };

  readonly quizId$ = routeId(this.route, 'id');

  private readonly sessionData = serverData(
    (quizId: number) =>
      this.client.call(learnerQuizEndpoints.startAttempt, {
        params: { quizId },
      }),
    { params: () => this.quizId$() },
  );

  /** Saves and the submit, run one after the other. */
  private readonly jobs = new Subject<Job>();

  readonly session$ = this.sessionData.value;
  readonly loadError$ = this.sessionData.error;
  readonly current$ = this.state.current.asReadonly();
  readonly isSaving$ = this.state.isSaving.asReadonly();
  readonly isSubmitting$ = this.state.isSubmitting.asReadonly();

  /** The dealt questions with the learner's current choice laid over what the server saved. */
  readonly questions$ = computed((): readonly SessionQuestion[] => {
    const choices = this.state.choices();
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
    this.state.failed().size ? [...this.state.failed().values()][0] : undefined,
  );

  readonly seconds$ = computed((): number => {
    const timing = this.state.timing();
    if (!timing) return 0;
    const passed = Math.max(0, this.state.now() - timing.receivedAt);
    return Math.max(0, Math.ceil((timing.leftMs - passed) / 1000));
  });

  /** An attempt is running on this screen: leaving it asks first, because the clock keeps going. */
  readonly inProgress$ = computed(
    () => !!this.session$() && !this.state.done(),
  );

  constructor() {
    const timer = setInterval(() => this.setNow(this.clock()), 1000);
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
      if (!session || this.state.done()) return;
      if (session.expired || this.seconds$() === 0)
        untracked(() => void this.submit(true));
    });
  }

  private setCurrent(index: number): void {
    this.state.current.set(index);
  }

  private setIsSaving(saving: boolean): void {
    this.state.isSaving.set(saving);
  }

  private setIsSubmitting(submitting: boolean): void {
    this.state.isSubmitting.set(submitting);
  }

  private setDone(done: boolean): void {
    this.state.done.set(done);
  }

  private setFailed(failed: ReadonlyMap<number, string>): void {
    this.state.failed.set(failed);
  }

  private setChoices(choices: ReadonlyMap<number, Choice>): void {
    this.state.choices.set(choices);
  }

  private setTiming(timing: { leftMs: number; receivedAt: number }): void {
    this.state.timing.set(timing);
  }

  private setNow(now: number): void {
    this.state.now.set(now);
  }

  private timingOf(deadlineAt: string, serverTime: string) {
    return {
      leftMs: Date.parse(deadlineAt) - Date.parse(serverTime),
      receivedAt: this.clock(),
    };
  }

  retryLoad(): void {
    this.sessionData.reload();
  }

  goto(index: number): void {
    const last = (this.session$()?.questions.length ?? 1) - 1;
    this.setCurrent(Math.min(Math.max(0, index), last));
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

  /** The mockup's shortcuts: 1–8 choose an option, the arrows move between questions. */
  handleKey(event: KeyboardEvent): void {
    const question = this.questions$()[this.current$()];
    if (
      !question ||
      this.dialog.openDialogs.length ||
      (event.target instanceof HTMLElement &&
        event.target.matches(
          'textarea,input:not([type=radio]):not([type=checkbox]),select,button',
        ))
    )
      return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.goto(this.current$() + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.goto(this.current$() - 1);
    } else if (/^[1-8]$/.test(event.key)) {
      const option = question.options[Number(event.key) - 1];
      if (!option) return;
      event.preventDefault();
      this.chooseOption(
        question.attemptQuestionId,
        option.id,
        !question.selectedOptionIds.includes(option.id),
      );
    }
  }

  /** Sends again every choice whose last save failed. */
  retrySave(): void {
    for (const questionId of this.state.failed().keys())
      this.jobs.next({ kind: 'save', questionId });
  }

  async submit(auto = false): Promise<void> {
    if (this.isSubmitting$() || this.state.done()) return;
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
    this.setIsSubmitting(true);
    this.jobs.next({ kind: 'submit', auto });
  }

  private update(questionId: number, patch: Partial<Choice>): void {
    const previous = this.state.choices().get(questionId) ?? {
      selectedOptionIds: [],
      flagged: false,
    };
    this.setChoices(
      new Map(this.state.choices()).set(questionId, { ...previous, ...patch }),
    );
    this.jobs.next({ kind: 'save', questionId });
  }

  private run(job: Job) {
    return job.kind === 'save' ? this.save(job.questionId) : this.finish(job);
  }

  /** Sends the question's choice as it is now, so a queued older save is not sent stale. */
  private save(questionId: number) {
    const session = this.session$();
    const choice = this.state.choices().get(questionId);
    if (!session || !choice) return EMPTY;
    const body: SaveAnswerBody = {
      selectedOptionIds: [...choice.selectedOptionIds],
      flagged: choice.flagged,
    };
    this.setIsSaving(true);
    return this.client
      .call(learnerQuizEndpoints.saveAnswer, {
        params: { attemptId: session.attemptId, attemptQuestionId: questionId },
        body,
      })
      .pipe(
        tap((receipt) => {
          const next = new Map(this.state.failed());
          next.delete(questionId);
          this.setFailed(next);
          this.setTiming(this.timingOf(receipt.deadlineAt, receipt.serverTime));
        }),
        catchError((error: unknown) => {
          this.setFailed(
            new Map(this.state.failed()).set(
              questionId,
              toAppError(error).message,
            ),
          );
          return EMPTY;
        }),
        tap({ finalize: () => this.setIsSaving(false) }),
      );
  }

  /** Re-sends what failed, then submits; a submit the server refuses leaves the learner here. */
  private finish(job: Extract<Job, { kind: 'submit' }>) {
    const session = this.session$();
    if (!session) return EMPTY;
    return concat(
      ...[...this.state.failed().keys()].map((id) => this.save(id)),
      defer(() => this.sendSubmit(session.attemptId, job.auto)),
    );
  }

  private sendSubmit(attemptId: number, auto: boolean) {
    if (this.state.failed().size && !auto) {
      this.setIsSubmitting(false);
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
          this.setDone(true);
          this.changes.results.bump();
          void this.router.navigate([
            '/quiz',
            result.quizId,
            'result',
            result.attemptId,
          ]);
        }),
        catchError((error: unknown) => {
          this.setIsSubmitting(false);
          const { title, message } = toAppError(error);
          this.toaster.error(title || 'Chưa nộp được bài', message);
          return EMPTY;
        }),
      );
  }
}
