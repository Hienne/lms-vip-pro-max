import { computed, inject, Injectable, linkedSignal } from '@angular/core';
import {
  CHECKPOINT_STALE_CODE,
  checkpointEndpoints,
  type CheckpointQuestion,
  type CheckpointResult,
} from '@lms/contracts';
import type { OptionCardTone } from '@lms/ui';
import { catchError, map, of, throwError } from 'rxjs';
import { invalidation } from '../../../../../../core/data-access/invalidation';
import { serverData } from '../../../../../../core/data-access/server-data';
import { serverMutation } from '../../../../../../core/data-access/server-mutation';
import { toAppError } from '../../../../../../core/errors/app-error';
import { EndpointClient } from '../../../../../../core/http/endpoint-client';
import { LessonStore } from '../../../data-access/lesson.store';

/** What the card shows: nothing, a placeholder while it loads, the questions, or a way out. */
export type CheckpointStatus =
  | 'hidden'
  | 'loading'
  | 'error'
  | 'empty'
  | 'question'
  | 'summary';

/** One option of the question on screen, as the card draws it. */
export interface OptionRow {
  readonly id: number;
  readonly content: string;
  readonly letter: string;
  readonly picked: boolean;
  /** Set once the question is graded: the key and the learner's wrong picks are marked. */
  readonly tone: OptionCardTone | undefined;
}

/** The question the learner answered, with the server's grading of it. */
export interface Graded {
  readonly result: CheckpointResult;
  /** The options the learner ticked, kept so the review marks them. */
  readonly picked: readonly number[];
}

/** The reply of one answer: the grading, or the sign that the question changed. */
type Reply = { readonly stale: true } | (CheckpointResult & { stale?: never });

/**
 * "Câu hỏi nhanh" of the lesson page: up to three ungraded recall questions of the lesson. It owns
 * the round the learner is in (which question, what is ticked, how each came out); the server owns
 * the questions and the grading. It never touches completion, so it cannot block "Tiếp theo".
 */
@Injectable()
export class LessonCheckpointStore {
  private readonly client = inject(EndpointClient);
  private readonly lesson = inject(LessonStore);

  private readonly state = {
    /** Which question of the round is on screen; a new lesson or a new round starts at the first. */
    index: linkedSignal<number | undefined, number>({
      source: () => this.lesson.lessonId$(),
      computation: () => 0,
    }),
    /** The options ticked for the question on screen. */
    picked: linkedSignal<number | undefined, readonly number[]>({
      source: () => this.lesson.lessonId$(),
      computation: () => [],
    }),
    /** The grading of the question on screen, once it has been checked. */
    graded: linkedSignal<number | undefined, Graded | null>({
      source: () => this.lesson.lessonId$(),
      computation: () => null,
    }),
    /** Whether each question answered in this round was right. */
    tally: linkedSignal<number | undefined, readonly boolean[]>({
      source: () => this.lesson.lessonId$(),
      computation: () => [],
    }),
    /** The questions changed under the learner; the round started again. */
    refreshed: linkedSignal<number | undefined, boolean>({
      source: () => this.lesson.lessonId$(),
      computation: () => false,
    }),
  };

  private readonly changes = invalidation();

  private readonly checkpointData = serverData(
    (lessonId: number) =>
      this.client.call(checkpointEndpoints.checkpoint, {
        params: { lessonId },
      }),
    {
      params: () =>
        this.lesson.checkpointWanted$() ? this.lesson.lessonId$() : undefined,
      reloadOn: this.changes,
    },
  );

  private readonly answerMutation = serverMutation(
    (input: {
      readonly lessonId: number;
      readonly question: CheckpointQuestion;
      readonly optionIds: readonly number[];
    }) =>
      this.client
        .call(checkpointEndpoints.answerCheckpoint, {
          params: { lessonId: input.lessonId },
          body: {
            questionId: input.question.questionId,
            questionVersion: input.question.questionVersion,
            optionIds: [...input.optionIds],
          },
        })
        .pipe(
          map((result): Reply => result),
          // A question that changed is not a failure: the round starts again on the new ones.
          catchError((error: unknown) =>
            toAppError(error).messageCode === CHECKPOINT_STALE_CODE
              ? of<Reply>({ stale: true })
              : throwError(() => error),
          ),
        ),
    {
      errors: 'toast',
      onSuccess: (reply) => {
        if (reply === undefined) return;
        if (reply.stale) this.restart(true);
        else this.recordAnswer(reply);
      },
    },
  );

  // Selectors
  readonly questions$ = computed(
    () => this.checkpointData.value()?.questions ?? [],
  );
  readonly index$ = this.state.index.asReadonly();
  readonly picked$ = this.state.picked.asReadonly();
  readonly graded$ = this.state.graded.asReadonly();
  readonly refreshed$ = this.state.refreshed.asReadonly();
  readonly loadError$ = this.checkpointData.error;
  readonly isChecking$ = this.answerMutation.isPending;

  readonly current$ = computed(
    (): CheckpointQuestion | undefined => this.questions$()[this.index$()],
  );
  readonly total$ = computed(() => this.questions$().length);
  readonly rows$ = computed((): readonly OptionRow[] => {
    const options = this.current$()?.options ?? [];
    const picked = this.picked$();
    const graded = this.graded$();
    return options.map((option, i) => {
      const isPicked = picked.includes(option.id);
      const right = graded?.result.correctOptionIds.includes(option.id);
      return {
        id: option.id,
        content: option.content,
        letter: String.fromCharCode(65 + i),
        picked: isPicked,
        tone: !graded
          ? undefined
          : right
            ? 'correct'
            : isPicked
              ? 'wrong'
              : 'neutral',
      };
    });
  });
  readonly score$ = computed(
    () => this.state.tally().filter((right) => right).length,
  );

  /** Ticking is allowed until the question is checked. */
  readonly locked$ = computed(
    () => this.graded$() !== null || this.isChecking$(),
  );
  readonly canCheck$ = computed(
    () => this.picked$().length > 0 && !this.locked$(),
  );
  readonly isLast$ = computed(() => this.index$() >= this.total$() - 1);

  readonly status$ = computed((): CheckpointStatus => {
    if (!this.lesson.checkpointWanted$()) return 'hidden';
    // Reached by itself at the end of a lesson, the card stays out of the way unless it has questions.
    const asked = this.lesson.checkpointAsked$();
    // A card already on screen ("Làm lại") keeps its place while the new questions load.
    if (this.checkpointData.isLoading())
      return asked || this.total$() > 0 ? 'loading' : 'hidden';
    if (this.loadError$()) return asked ? 'error' : 'hidden';
    if (this.total$() === 0) return asked ? 'empty' : 'hidden';
    return this.index$() >= this.total$() ? 'summary' : 'question';
  });

  // Setters: the only writers of state
  setIndex(index: number): void {
    this.state.index.set(index);
  }

  setPicked(picked: readonly number[]): void {
    this.state.picked.set(picked);
  }

  setGraded(graded: Graded | null): void {
    this.state.graded.set(graded);
  }

  setTally(tally: readonly boolean[]): void {
    this.state.tally.set(tally);
  }

  setRefreshed(refreshed: boolean): void {
    this.state.refreshed.set(refreshed);
  }

  // Commands
  /** Ticks or unticks an option; a single-choice question keeps only the last one. */
  toggle(optionId: number): void {
    if (this.locked$()) return;
    const multiple = this.current$()?.questionType === 'MULTIPLE';
    const picked = this.picked$();
    if (!multiple) this.setPicked([optionId]);
    else if (picked.includes(optionId))
      this.setPicked(picked.filter((id) => id !== optionId));
    else this.setPicked([...picked, optionId]);
  }

  /** "Kiểm tra": the server grades the ticked options. */
  check(): void {
    const question = this.current$();
    const lessonId = this.lesson.lessonId$();
    if (!question || lessonId === undefined || !this.canCheck$()) return;
    this.setRefreshed(false);
    this.answerMutation.run({
      lessonId,
      question,
      optionIds: this.picked$(),
    });
  }

  /** "Câu tiếp" / "Xem kết quả". */
  next(): void {
    this.setIndex(this.index$() + 1);
    this.setPicked([]);
    this.setGraded(null);
  }

  /** "Làm lại": new questions from the server, starting at the first. */
  again(): void {
    this.restart(false);
  }

  /** "Thử lại" after the questions failed to load. */
  retry(): void {
    this.checkpointData.reload();
  }

  /** "Bỏ qua" and "Đóng": the card goes; "Tiếp theo" was never waiting for it. */
  skip(): void {
    this.lesson.skipCheckpoint();
  }

  /** "Xem lại bài học": back to the first block of the lesson. */
  reviewLesson(): void {
    this.lesson.reviewFromStart();
  }

  private recordAnswer(result: CheckpointResult): void {
    this.setGraded({ result, picked: this.picked$() });
    this.setTally([...this.state.tally(), result.correct]);
  }

  private restart(refreshed: boolean): void {
    this.setIndex(0);
    this.setPicked([]);
    this.setGraded(null);
    this.setTally([]);
    this.setRefreshed(refreshed);
    this.changes.bump();
  }
}
