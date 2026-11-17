import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  assessmentV1Endpoints,
  type ConfirmDraftingStepCommand,
  type DraftingSession,
  type DraftingStep,
  type DraftingStepNumber,
} from '@lms/contracts';
import { catchError, throwError } from 'rxjs';
import { CourseDraftingStore } from '../../../../core/course-drafting/course-drafting.store';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { toAppError } from '../../../../core/errors/app-error';
import type { CourseDraftValue } from '../course-draft';
import { CourseEditorStore, DUPLICATE_CODE } from './course-editor.store';
import {
  DRAFTING_FIELD_DELAY_MS,
  fillSteps,
  type DraftingPatch,
  type FillField,
} from './drafting-fill';
import {
  emptyRules,
  rulesProblem,
  toConfirmQuestions,
  type DraftQuestionValue,
  type DraftRulesValue,
} from './drafting-rules';

/** The fields the assistant may leave empty, with what the page says under them. */
const EMPTY_HINTS = {
  programId: 'Trợ lý chưa chọn được chương trình. Hãy chọn trong danh sách.',
  moduleId:
    'Trợ lý chưa chọn được phân hệ. Chọn nếu khóa học thuộc một phân hệ.',
} as const;

export type DraftingHints = Partial<Record<keyof typeof EMPTY_HINTS, string>>;

/** The steps the page confirms with "Đã chốt". */
const CONFIRMABLE_STEPS: readonly DraftingStepNumber[] = [1, 2, 3, 4];

/**
 * What the outline shows under a lesson the assistant proposed: what it teaches and the part of
 * the document it comes from, and whether it is still a proposal (step 2 not confirmed yet).
 */
export interface LessonNoteView {
  readonly text: string;
  readonly suggested: boolean;
}

/** One "Đề xuất lại", "Thử lại" or "Tự điền": the step of the session. */
interface StepInput {
  readonly sessionId: number;
  readonly step: DraftingStepNumber;
}

/** A step the assistant could not propose, with why, as the page shows it. */
export interface FailedStepView {
  readonly step: DraftingStepNumber;
  readonly error: string;
}

/** The states a step is proposed again from ("Đề xuất lại"); a failed one is retried instead. */
const PROPOSE_AGAIN_FROM: readonly DraftingStep['state'][] = [
  'proposed',
  'confirmed',
];

/** One "Đã chốt": the step and the page's values for it. */
interface ConfirmInput {
  readonly sessionId: number;
  readonly step: DraftingStepNumber;
  readonly body: ConfirmDraftingStepCommand;
}

const sameValue = (
  value: CourseDraftValue,
  field: FillField,
  written: string,
) => JSON.stringify(value[field]) === written;

/**
 * The editor's side of a drafting session: it attaches the page to the session in the URL
 * (`/admin/courses/new?session={id}`), and when a step's proposal arrives it writes it into the
 * editor's form one field at a time, the step locked meanwhile. It remembers what it wrote, so a
 * field shows "AI đề xuất" until the author changes it. "Dừng" stops the writing (and the server,
 * while it still works). Provided by the editor page; the session itself is
 * {@link CourseDraftingStore}'s.
 */
@Injectable()
export class DraftingFillStore {
  private readonly drafting = inject(CourseDraftingStore);
  private readonly editor = inject(CourseEditorStore);
  private readonly route = inject(ActivatedRoute);
  private readonly client = inject(EndpointClient);

  private readonly state = {
    /** The session a new course page follows (`?session=`); none for a course typed by hand. */
    sessionId: signal<number | undefined>(undefined),
    /** The draft course an edit page shows: it follows the session that drafted it, if any. */
    courseId: signal<number | undefined>(undefined),
    /** The edit page has gone to the session's current step once. */
    resumed: signal(false),
    /** The editor's form model, handed over once by the page. */
    target: signal<WritableSignal<CourseDraftValue> | null>(null),
    /** Fields are being written into the form. */
    playing: signal(false),
    /** The proposal last written (`step|updateTime`), so it is written once. */
    played: signal<string | null>(null),
    /** The steps whose proposal was written. */
    playedSteps: signal<readonly DraftingStepNumber[]>([]),
    /** Steps the author stopped: what the server proposes for them later is not written. */
    stopped: signal<readonly DraftingStepNumber[]>([]),
    /** Steps the author asked to propose again: their next proposal is written over the form. */
    reproposed: signal<readonly DraftingStepNumber[]>([]),
    /** What was written into each field, as JSON, for the "AI đề xuất" marker. */
    written: signal<Partial<Record<FillField, string>>>({}),
    /** How the page confirms a step with its values, handed over by the page. */
    pageConfirm: signal<((step: DraftingStepNumber) => void) | null>(null),
    /** Step 3's draft questions and their competency, kept here until the step is confirmed. */
    rules: signal<DraftRulesValue>(emptyRules()),
    /** What was written into the competency, as JSON, for its "AI đề xuất" marker. */
    writtenCompetency: signal<string | null>(null),
    /** Each question as the assistant wrote it, as JSON by key, for its "AI đề xuất" marker. */
    writtenQuestions: signal<Readonly<Record<string, string>>>({}),
  };

  private timer: ReturnType<typeof setTimeout> | undefined;

  /** The session this page follows: the one in the URL, or the one that drafted its course. */
  private readonly session = computed((): DraftingSession | undefined => {
    const session = this.drafting.session$();
    if (!session) return undefined;
    const sessionId = this.state.sessionId();
    if (sessionId !== undefined)
      return session.id === sessionId ? session : undefined;
    const courseId = this.state.courseId();
    return courseId !== undefined && session.courseId === courseId
      ? session
      : undefined;
  });

  /** The session's current step, when the session is this page's. */
  private readonly step = computed((): DraftingStep | undefined =>
    this.session() ? this.drafting.step$() : undefined,
  );

  /** The session's step the page shows, whether it is the current one or one before it. */
  private readonly shownStep = computed((): DraftingStep | undefined => {
    const session = this.session();
    const index = this.editor.step$();
    return session?.steps.find((step) => step.step === index + 1);
  });

  /** The page shows the session's current step. */
  private readonly shown = computed(() => {
    const step = this.step();
    return step !== undefined && this.editor.step$() === step.step - 1;
  });

  private readonly confirmMutation = serverMutation(
    (input: ConfirmInput) =>
      this.drafting.confirmWith(input.sessionId, input.step, input.body).pipe(
        catchError((error: unknown) => {
          if (toAppError(error).messageCode === DUPLICATE_CODE) {
            // The server proposes another code: the field says "mã đã có" until it arrives.
            const course = 'course' in input.body ? input.body.course : null;
            if (course) this.editor.markCodeTaken(course.code);
            this.drafting.refresh();
          }
          return throwError(() => error);
        }),
      ),
    {
      errors: 'alert',
      success: () => 'Đã chốt bước',
      onSuccess: (session) => this.moveOn(session),
    },
  );

  private readonly againMutation = serverMutation(
    (input: StepInput) =>
      this.drafting.proposeAgain(input.sessionId, input.step),
    {
      errors: 'toast',
      onSuccess: (session) => this.awaitAgain(session),
    },
  );

  private readonly manualMutation = serverMutation(
    (input: StepInput) => this.drafting.manual(input.sessionId, input.step),
    {
      errors: 'toast',
      success: () => 'Bạn tự điền tiếp khóa học',
      onSuccess: () => this.drafting.refresh(),
    },
  );

  /**
   * The step whose proposal is ready and not written yet: the current step, or one the author
   * asked to propose again.
   */
  private readonly ready = computed((): DraftingStep | null => {
    const session = this.session();
    if (!this.state.target() || !session) return null;
    const awaited = (step: DraftingStep) =>
      step.step === session.currentStep ||
      this.state.reproposed().includes(step.step);
    return (
      session.steps.find(
        (step) =>
          awaited(step) &&
          !!step.proposal &&
          step.state === 'proposed' &&
          !this.state.stopped().includes(step.step) &&
          `${step.step}|${step.updateTime}` !== this.state.played(),
      ) ?? null
    );
  });

  /** The page follows a session. */
  readonly attached$ = computed(
    () => this.state.sessionId() !== undefined || this.session() !== undefined,
  );

  /** "Trợ lý đang soạn…": the server works on the step, or its fields are being written. */
  readonly working$ = computed(() => {
    if (this.state.playing()) return true;
    const step = this.shownStep();
    return (
      step?.state === 'proposing' && !this.state.stopped().includes(step.step)
    );
  });

  /**
   * The step "Đã chốt" confirms: the session's current step while the page shows it and it is
   * not confirmed yet. A step confirmed before is edited and saved with "Lưu nháp".
   */
  readonly confirmStep$ = computed((): DraftingStepNumber | null => {
    const session = this.session();
    const step = this.step();
    return session?.status === 'active' &&
      step &&
      this.shown() &&
      step.state !== 'confirmed' &&
      CONFIRMABLE_STEPS.includes(step.step)
      ? step.step
      : null;
  });

  readonly isConfirming$ = this.confirmMutation.isPending;

  /**
   * The step shown can be proposed again ("Đề xuất lại"): it holds a proposal or was confirmed,
   * the session is not over and nothing is being written. Null otherwise.
   */
  readonly proposeAgainStep$ = computed((): DraftingStepNumber | null => {
    const session = this.session();
    const step = this.shownStep();
    return session?.status === 'active' &&
      step &&
      PROPOSE_AGAIN_FROM.includes(step.state) &&
      !this.working$()
      ? step.step
      : null;
  });

  /** The step shown failed: its error, with "Thử lại" and "Tự điền". */
  readonly failed$ = computed((): FailedStepView | null => {
    const session = this.session();
    const step = this.shownStep();
    return session?.status === 'failed' && step?.state === 'failed'
      ? {
          step: step.step,
          error:
            step.error ?? session.error ?? 'Trợ lý không soạn được bước này.',
        }
      : null;
  });

  /** "Đề xuất lại", "Thử lại" or "Tự điền" is on its way. */
  readonly isChanging$ = computed(
    () => this.againMutation.isPending() || this.manualMutation.isPending(),
  );

  /**
   * The code the server proposes after the one confirmed was taken, while the code field still
   * holds another one.
   */
  readonly suggestedCode$ = computed((): string | null => {
    const step = this.step();
    const value = this.state.target()?.();
    if (step?.step !== 1 || !step.proposal || !value) return null;
    if (this.editor.takenCode$() === null) return null;
    return step.proposal.code !== value.code.trim() ? step.proposal.code : null;
  });

  /** Why the last "Đã chốt" failed; a taken code is shown on the code field instead. */
  readonly confirmError$ = computed(() => {
    const error = this.confirmMutation.error();
    return error?.messageCode === DUPLICATE_CODE ? undefined : error;
  });

  /** The step cannot be edited until the assistant finishes or is stopped. */
  readonly locked$ = this.working$;

  /** The fields that still hold what the assistant wrote. */
  readonly marks$ = computed((): ReadonlySet<FillField> => {
    const value = this.state.target()?.();
    if (!value) return new Set();
    return new Set(
      (Object.entries(this.state.written()) as [FillField, string][])
        .filter(([field, written]) => sameValue(value, field, written))
        .map(([field]) => field),
    );
  });

  /** What the page says under a programme or module the assistant left empty. */
  readonly hints$ = computed((): DraftingHints => {
    const step = this.step();
    const value = this.state.target()?.();
    if (step?.step !== 1 || !step.proposal || !value) return {};
    const proposal = step.proposal;
    const hints: DraftingHints = {};
    for (const field of ['programId', 'moduleId'] as const) {
      const unsure =
        proposal[field] === null || proposal.unsure.includes(field);
      if (unsure && !value[field]) hints[field] = EMPTY_HINTS[field];
    }
    return hints;
  });

  /**
   * The step 2 proposal's lessons by title: a lesson of the outline with that title shows the
   * line. Lessons have no description of their own, so the line lives on the session only.
   */
  readonly lessonNotes$ = computed((): ReadonlyMap<string, LessonNoteView> => {
    const outline = this.session()?.steps.find((step) => step.step === 2);
    if (outline?.step !== 2 || !outline.proposal) return new Map();
    const suggested = outline.state !== 'confirmed';
    const notes = new Map<string, LessonNoteView>();
    for (const chapter of outline.proposal.chapters) {
      for (const lesson of chapter.lessons) {
        const title = lesson.title.trim();
        if (!notes.has(title))
          notes.set(title, {
            text: `${lesson.description} · Nguồn: ${lesson.sourceSection}`,
            suggested,
          });
      }
    }
    return notes;
  });

  /**
   * Step 3's draft questions are on the page: the step is the session's current one and not
   * confirmed yet. Once confirmed they are the course's final exam, shown by the exam card.
   */
  readonly rulesShown$ = computed(() => {
    const step = this.step();
    return step?.step === 3 && step.state !== 'confirmed';
  });

  /** The draft questions and their competency as the author has them now. */
  readonly rules$ = this.state.rules.asReadonly();

  /** Why the kept questions cannot become the final exam yet; null when they can. */
  readonly rulesProblem$ = computed(() =>
    this.rulesShown$() ? rulesProblem(this.state.rules()) : null,
  );

  /** The competency still holds what the assistant picked. */
  readonly competencyMarked$ = computed(
    () =>
      this.state.writtenCompetency() !== null &&
      this.state.writtenCompetency() === this.state.rules().competencyId,
  );

  /** The keys of the questions the author has not changed since the assistant wrote them. */
  readonly questionMarks$ = computed((): ReadonlySet<string> => {
    const written = this.state.writtenQuestions();
    return new Set(
      this.state
        .rules()
        .questions.filter(
          (question) => written[question.key] === JSON.stringify(question),
        )
        .map((question) => question.key),
    );
  });

  private readonly competenciesData = serverData(
    () =>
      this.client.call(assessmentV1Endpoints.competencies, {
        query: { status: 'ACTIVE' },
      }),
    { params: () => (this.rulesShown$() ? true : undefined) },
  );

  /** The competencies a question may be tagged with, the list the server picks from. */
  readonly competencies$ = computed(() => this.competenciesData.value() ?? []);

  /** A proposal arrived: writing it starts a timer, outside the signal graph. */
  private readonly playWhenReady = effect(() => {
    const step = this.ready();
    if (step) untracked(() => this.play(step));
  });

  /** An edit page opened on a drafted course lands on the session's current step, once. */
  private readonly resumeAtCurrentStep = effect(() => {
    const session = this.session();
    if (!session || this.state.courseId() === undefined || this.state.resumed())
      return;
    untracked(() => {
      this.setResumed();
      if (session.status !== 'finished')
        this.editor.goToStep(session.currentStep - 1);
    });
  });

  /** The page confirms with its own values when "Đã chốt" is pressed elsewhere (the chat). */
  private readonly offerPageConfirm = effect((onCleanup) => {
    const sessionId = this.session()?.id;
    const confirm = this.state.pageConfirm();
    if (sessionId === undefined || !confirm) return;
    onCleanup(this.drafting.registerPageConfirm(sessionId, confirm));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  // ---- setters ----------------------------------------------------------------------------

  private setSessionId(sessionId: number | undefined): void {
    this.state.sessionId.set(sessionId);
  }

  private setTarget(target: WritableSignal<CourseDraftValue>): void {
    this.state.target.set(target);
  }

  private setPlaying(playing: boolean): void {
    this.state.playing.set(playing);
  }

  private setPlayed(key: string): void {
    this.state.played.set(key);
  }

  private setPlayedStep(step: DraftingStepNumber): void {
    this.state.playedSteps.update((steps) =>
      steps.includes(step) ? steps : [...steps, step],
    );
  }

  private setCourseId(courseId: number): void {
    this.state.courseId.set(courseId);
  }

  private setResumed(): void {
    this.state.resumed.set(true);
  }

  private setPageConfirm(
    confirm: ((step: DraftingStepNumber) => void) | null,
  ): void {
    this.state.pageConfirm.set(confirm);
  }

  private setStopped(step: DraftingStepNumber): void {
    this.state.stopped.update((steps) =>
      steps.includes(step) ? steps : [...steps, step],
    );
  }

  /** The step's next proposal is written over what the form holds for it. */
  private setReproposed(step: DraftingStepNumber): void {
    this.state.stopped.update((steps) => steps.filter((item) => item !== step));
    this.state.playedSteps.update((steps) =>
      steps.filter((item) => item !== step),
    );
    this.state.reproposed.update((steps) =>
      steps.includes(step) ? steps : [...steps, step],
    );
  }

  private setWritten(field: FillField, written: string): void {
    this.state.written.update((fields) => ({ ...fields, [field]: written }));
  }

  private setRules(rules: DraftRulesValue): void {
    this.state.rules.set(rules);
  }

  private setWrittenCompetency(competencyId: string | null): void {
    this.state.writtenCompetency.set(competencyId);
  }

  private setWrittenQuestions(questions: readonly DraftQuestionValue[]): void {
    this.state.writtenQuestions.update((written) => ({
      ...written,
      ...Object.fromEntries(
        questions.map((question) => [question.key, JSON.stringify(question)]),
      ),
    }));
  }

  // ---- commands ---------------------------------------------------------------------------

  /**
   * The page hands over its form model and how it confirms a step with its values. On a new
   * course opened with `?session=`, the page follows that session; on a course's edit page, the
   * session that drafted the course, if any, from its current step.
   */
  attach(
    model: WritableSignal<CourseDraftValue>,
    confirm?: (step: DraftingStepNumber) => void,
  ): void {
    this.setTarget(model);
    this.setPageConfirm(confirm ?? null);
    if (!this.editor.isCreate$()) {
      const courseId = this.editor.courseId$();
      if (courseId === undefined) return;
      this.setCourseId(courseId);
      this.drafting.loadForCourse(courseId);
      return;
    }
    const sessionId = Number(this.route.snapshot.queryParamMap.get('session'));
    if (!Number.isInteger(sessionId) || sessionId <= 0) return;
    this.setSessionId(sessionId);
    this.drafting.load(sessionId);
  }

  /**
   * "Đã chốt" with the page's values for the step. Step 1 makes the draft course: the page then
   * continues as its edit page, on the next step. A taken code goes back to the code field.
   */
  confirm(step: DraftingStepNumber, body: ConfirmDraftingStepCommand): void {
    const sessionId = this.session()?.id;
    if (sessionId === undefined || this.confirmStep$() !== step) return;
    this.cancel();
    this.confirmMutation.run({ sessionId, step, body });
  }

  /** The competency the kept questions are tagged with; '' for none. */
  setCompetency(competencyId: string): void {
    this.setRules({ ...this.state.rules(), competencyId });
  }

  /** The author edits a draft question; it stops showing "AI đề xuất". */
  updateQuestion(question: DraftQuestionValue): void {
    this.setRules({
      ...this.state.rules(),
      questions: this.state
        .rules()
        .questions.map((item) => (item.key === question.key ? question : item)),
    });
  }

  /** "Bỏ câu hỏi": the question is not created when the step is confirmed. */
  removeQuestion(key: string): void {
    this.setRules({
      ...this.state.rules(),
      questions: this.state
        .rules()
        .questions.filter((item) => item.key !== key),
    });
  }

  /**
   * What "Đã chốt" on step 3 sends beside the draft: the competency and the kept questions as
   * edited; null while they cannot be sent ({@link rulesProblem$} says why).
   */
  rulesCommand(): {
    competencyId: number | null;
    questions: ReturnType<typeof toConfirmQuestions>;
  } | null {
    const rules = this.state.rules();
    if (rulesProblem(rules) !== null) return null;
    return {
      competencyId: rules.competencyId ? Number(rules.competencyId) : null,
      questions: toConfirmQuestions(rules),
    };
  }

  /** "Dùng mã …": the code field takes the code the server proposed. */
  useSuggestedCode(): void {
    const code = this.suggestedCode$();
    if (code === null) return;
    this.write({ field: 'code', apply: (value) => ({ ...value, code }) });
  }

  private moveOn(session: DraftingSession): void {
    const next = session.currentStep - 1;
    // Confirmed questions are the course's exam now: the page keeps no draft of them.
    if (
      session.steps.some(
        (step) => step.step === 3 && step.state === 'confirmed',
      )
    )
      this.setRules(emptyRules());
    if (this.editor.isCreate$() && session.courseId !== null)
      this.editor.moveToCourse(session.courseId, next);
    else {
      // The confirm saved the draft: the page reads it again (its version, the AI flag).
      this.editor.reloadCourse();
      this.editor.goToStep(next);
    }
    this.drafting.refresh();
  }

  /**
   * "Đề xuất lại" once the author agreed to lose what the step holds, or "Thử lại" on a failed
   * step: the server proposes only this step again, and its proposal replaces only this step's
   * fields.
   */
  proposeAgain(step: DraftingStepNumber): void {
    const sessionId = this.session()?.id;
    if (sessionId === undefined) return;
    if (this.proposeAgainStep$() !== step && this.failed$()?.step !== step)
      return;
    this.againMutation.run({ sessionId, step });
  }

  /**
   * "Tự điền" on a failed step: the assistant's part ends there and the author goes on by hand,
   * saving with the page's own buttons.
   */
  fillByHand(step: DraftingStepNumber): void {
    const sessionId = this.session()?.id;
    if (sessionId === undefined || this.failed$()?.step !== step) return;
    this.manualMutation.run({ sessionId, step });
  }

  private awaitAgain(session: DraftingSession): void {
    for (const step of session.steps)
      if (step.state === 'proposing') this.setReproposed(step.step);
    this.drafting.refresh();
  }

  /** "Dừng": nothing more is written, and the server stops if it still works on the step. */
  stop(): void {
    const step = this.shownStep() ?? this.step();
    this.cancel();
    if (!step) return;
    this.setStopped(step.step);
    if (step.state === 'proposing') this.drafting.stop();
  }

  private play(step: DraftingStep): void {
    this.cancel();
    this.setPlayed(`${step.step}|${step.updateTime}`);
    // A later proposal of a step already written (a new code after a taken one) is not written
    // over what the author has: the page offers the new code instead.
    if (this.state.playedSteps().includes(step.step)) return;
    this.setPlayedStep(step.step);
    // A course that exists keeps its code: step 1 proposed again leaves it alone.
    const keepCode = !this.editor.isCreate$();
    const patches = fillSteps(step).filter(
      (patch) => !(keepCode && patch.field === 'code'),
    );
    // The step unlocks as soon as its last field is written.
    const next = (): void => {
      const patch = patches.shift();
      if (patch) this.write(patch);
      if (patches.length)
        this.timer = setTimeout(next, DRAFTING_FIELD_DELAY_MS);
      else this.cancel();
    };
    this.setPlaying(true);
    next();
  }

  private write(patch: DraftingPatch): void {
    if ('picks' in patch) {
      // Step 4 fills the assign rows only: they are saved when the author publishes.
      this.editor.setPublishPicks(patch.picks);
      return;
    }
    if ('rules' in patch) {
      const rules = patch.rules(this.state.rules());
      this.setRules(rules);
      if (patch.field === 'competencyId')
        this.setWrittenCompetency(rules.competencyId);
      else this.setWrittenQuestions(rules.questions);
      return;
    }
    const target = this.state.target();
    if (!target) return;
    target.update(patch.apply);
    const value = target();
    this.setWritten(patch.field, JSON.stringify(value[patch.field]));
    // A programme picked here is not a change event of its select: the page lists its modules.
    if (patch.field === 'programId') this.editor.pickProgram(value.programId);
  }

  private cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.setPlaying(false);
  }
}
