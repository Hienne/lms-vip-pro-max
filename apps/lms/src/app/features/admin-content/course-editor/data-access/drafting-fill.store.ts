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
import type { DraftingStep, DraftingStepNumber } from '@lms/contracts';
import { CourseDraftingStore } from '../../../../core/course-drafting/course-drafting.store';
import type { CourseDraftValue } from '../course-draft';
import { CourseEditorStore } from './course-editor.store';
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
    /** The session this page follows; none for a course typed by hand. */
    sessionId: signal<number | undefined>(undefined),
    /** The editor's form model, handed over once by the page. */
    target: signal<WritableSignal<CourseDraftValue> | null>(null),
    /** Fields are being written into the form. */
    playing: signal(false),
    /** The proposal last written (`step|updateTime`), so it is written once. */
    played: signal<string | null>(null),
    /** Steps the author stopped: what the server proposes for them later is not written. */
    stopped: signal<readonly DraftingStepNumber[]>([]),
    /** What was written into each field, as JSON, for the "AI đề xuất" marker. */
    written: signal<Partial<Record<FillField, string>>>({}),
  };

  private timer: ReturnType<typeof setTimeout> | undefined;

  /** The session's current step, when the session is this page's. */
  private readonly step = computed((): DraftingStep | undefined =>
    this.drafting.session$()?.id === this.state.sessionId()
      ? this.drafting.step$()
      : undefined,
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
  readonly attached$ = computed(() => this.state.sessionId() !== undefined);

  /** "Trợ lý đang soạn…": the server works on the step, or its fields are being written. */
  readonly working$ = computed(() => {
    if (this.state.playing()) return true;
    const step = this.step();
    return (
      step?.state === 'proposing' && !this.state.stopped().includes(step.step)
    );
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
   * The page hands over its form model. On a new course opened with `?session=`, the page follows
   * that session.
   */
  attach(model: WritableSignal<CourseDraftValue>): void {
    this.setTarget(model);
    if (!this.editor.isCreate$()) return;
    const sessionId = Number(this.route.snapshot.queryParamMap.get('session'));
    if (!Number.isInteger(sessionId) || sessionId <= 0) return;
    this.setSessionId(sessionId);
    this.drafting.load(sessionId);
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
