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
import type {
  ConfirmDraftingStepCommand,
  DraftingSession,
  DraftingStep,
  DraftingStepNumber,
} from '@lms/contracts';
import { catchError, throwError } from 'rxjs';
import { CourseDraftingStore } from '../../../../core/course-drafting/course-drafting.store';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { toAppError } from '../../../../core/errors/app-error';
import type { CourseDraftValue } from '../course-draft';
import { CourseEditorStore, DUPLICATE_CODE } from './course-editor.store';
import {
  DRAFTING_FIELD_DELAY_MS,
  fillSteps,
  type FillField,
  type FillPatch,
} from './drafting-fill';

/** The fields the assistant may leave empty, with what the page says under them. */
const EMPTY_HINTS = {
  programId: 'Trợ lý chưa chọn được chương trình. Hãy chọn trong danh sách.',
  moduleId:
    'Trợ lý chưa chọn được phân hệ. Chọn nếu khóa học thuộc một phân hệ.',
} as const;

export type DraftingHints = Partial<Record<keyof typeof EMPTY_HINTS, string>>;

/** The steps the page confirms with "Đã chốt" so far; the later tickets add theirs. */
const CONFIRMABLE_STEPS: readonly DraftingStepNumber[] = [1];

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
    /** What was written into each field, as JSON, for the "AI đề xuất" marker. */
    written: signal<Partial<Record<FillField, string>>>({}),
    /** How the page confirms a step with its values, handed over by the page. */
    pageConfirm: signal<((step: DraftingStepNumber) => void) | null>(null),
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

  /** The step whose proposal is ready and not written yet. */
  private readonly ready = computed((): DraftingStep | null => {
    const step = this.step();
    if (
      !this.state.target() ||
      !step?.proposal ||
      step.state !== 'proposed' ||
      this.state.stopped().includes(step.step)
    ) {
      return null;
    }
    return `${step.step}|${step.updateTime}` === this.state.played()
      ? null
      : step;
  });

  /** The page follows a session. */
  readonly attached$ = computed(
    () => this.state.sessionId() !== undefined || this.session() !== undefined,
  );

  /** "Trợ lý đang soạn…": the server works on the step, or its fields are being written. */
  readonly working$ = computed(() => {
    if (this.state.playing()) return true;
    const step = this.step();
    return (
      this.shown() &&
      step?.state === 'proposing' &&
      !this.state.stopped().includes(step.step)
    );
  });

  /**
   * The step "Đã chốt" confirms: the session's current step while the page shows it and it is
   * not confirmed yet. A step confirmed before is edited and saved with "Lưu nháp".
   */
  readonly confirmStep$ = computed((): DraftingStepNumber | null => {
    const session = this.session();
    const step = this.step();
    return session?.status !== 'finished' &&
      step &&
      this.shown() &&
      step.state !== 'confirmed' &&
      CONFIRMABLE_STEPS.includes(step.step)
      ? step.step
      : null;
  });

  readonly isConfirming$ = this.confirmMutation.isPending;

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

  private setWritten(field: FillField, written: string): void {
    this.state.written.update((fields) => ({ ...fields, [field]: written }));
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

  /** "Dùng mã …": the code field takes the code the server proposed. */
  useSuggestedCode(): void {
    const code = this.suggestedCode$();
    if (code === null) return;
    this.write({ field: 'code', apply: (value) => ({ ...value, code }) });
  }

  private moveOn(session: DraftingSession): void {
    const next = session.currentStep - 1;
    if (this.editor.isCreate$() && session.courseId !== null)
      this.editor.moveToCourse(session.courseId, next);
    else this.editor.goToStep(next);
    this.drafting.refresh();
  }

  /** "Dừng": nothing more is written, and the server stops if it still works on the step. */
  stop(): void {
    const step = this.step();
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
    const patches = [...fillSteps(step)];
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

  private write(patch: FillPatch): void {
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
