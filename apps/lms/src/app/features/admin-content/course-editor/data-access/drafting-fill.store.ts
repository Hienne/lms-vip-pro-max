import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  draftingSessionEndpoints,
  type ConfirmDraftingStepCommand,
  type DraftingSession,
  type DraftingStep,
  type DraftingStepNumber,
} from '@lms/contracts';
import { confirm as confirmDialog } from '@lms/ui';
import { catchError, firstValueFrom, map, throwError } from 'rxjs';
import { CourseDraftingStore } from '../../../../core/course-drafting/course-drafting.store';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { toAppError } from '../../../../core/errors/app-error';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import {
  toCreateCourseCommand,
  toSaveDraftCommand,
  type CourseDraftValue,
} from '../course-draft';
import { CourseEditorStore, DUPLICATE_CODE } from './course-editor.store';
import {
  fieldPatch,
  fillSteps,
  writtenOf,
  type DraftingPatch,
  type FillField,
  type FillPatch,
  type LessonNoteView,
} from './drafting-fill';
import { FillPlayer } from './drafting-fill-player';
import { DraftingQuestionsStore } from './drafting-questions.store';
import type { toConfirmQuestions } from './drafting-rules';

export type { LessonNoteView } from './drafting-fill';

/** The step 1 refusal of a course made for another unit than the session's. */
const OWNER_MISMATCH = 'OWNER_MISMATCH';

/** The fields the assistant may leave empty, with what the page says under them. */
const EMPTY_HINTS = {
  programId: 'Trợ lý chưa chọn được chương trình. Hãy chọn trong danh sách.',
  moduleId:
    'Trợ lý chưa chọn được phân hệ. Chọn nếu khóa học thuộc một phân hệ.',
} as const;

export type DraftingHints = Partial<Record<keyof typeof EMPTY_HINTS, string>>;

/** The steps the page confirms with "Đã chốt". */
const CONFIRMABLE_STEPS: readonly DraftingStepNumber[] = [1, 2, 3, 4];

/** The states a step is proposed again from ("Đề xuất lại"); a failed one is retried instead. */
const PROPOSE_AGAIN_FROM: readonly DraftingStep['state'][] = [
  'proposed',
  'confirmed',
];

/** One write the page applies to its form model, numbered so each is applied once. */
export interface QueuedPatch {
  readonly seq: number;
  readonly patch: FillPatch;
}

/** A step the assistant could not propose, with why, as the page shows it. */
export interface FailedStepView {
  readonly step: DraftingStepNumber;
  readonly error: string;
}

/** What "Đã chốt" on step 3 sends beside the draft: the competency and the kept questions. */
export interface RulesCommand {
  readonly competencyId: number | null;
  readonly questions: ReturnType<typeof toConfirmQuestions>;
}

/** What the page knows of its form when a step is confirmed. */
export interface DraftingPageFacts {
  /** The draft as it is saved now. */
  readonly value: CourseDraftValue;
  /** A field of the step shown is invalid. */
  readonly stepInvalid: boolean;
  /** Why step 3's kept questions cannot be sent yet; null when they can. */
  readonly rulesProblem: string | null;
  /** Step 3's competency and kept questions; null while they cannot be sent. */
  readonly rules: RulesCommand | null;
}

/** What a "Đã chốt" did: sent, opened the step it names, or refused for the reason the bar shows. */
export type ConfirmOutcome = 'sent' | 'opened' | 'refused';

/** One "Đề xuất lại", "Thử lại" or "Tự điền": the step of the session. */
interface StepInput {
  readonly sessionId: number;
  readonly step: DraftingStepNumber;
}

/** One "Đã chốt": the step and the page's values for it. */
interface ConfirmInput extends StepInput {
  readonly body: ConfirmDraftingStepCommand;
}

const positiveId = (value: string | null): number | undefined => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
};

/**
 * The editor's side of a drafting session. A new course page follows the session in its URL
 * (`/admin/courses/new?session={id}`), a course's edit page the session that drafted it, resuming
 * at its current step. When a step's proposal arrives, its writes are queued one field at a time
 * ({@link queue$}) for the page to apply to its own form, the step locked meanwhile; the store keeps
 * what each field was given, so the page marks it "AI đề xuất" until the author changes it. It owns
 * the step commands ("Đã chốt", "Đề xuất lại", "Thử lại", "Tự điền", "Dừng") and their requests.
 * Provided by the editor page; the session itself is {@link CourseDraftingStore}'s.
 */
@Injectable()
export class DraftingFillStore {
  private readonly drafting = inject(CourseDraftingStore);
  private readonly editor = inject(CourseEditorStore);
  private readonly questions = inject(DraftingQuestionsStore);
  private readonly client = inject(EndpointClient);
  private readonly dialog = inject(Dialog);
  private readonly route = inject(ActivatedRoute);

  private readonly state = {
    /** The session that drafted the course an edit page shows, once looked up. */
    courseSessionId: signal<number | undefined>(undefined),
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
    /** The writes of the step being written, for the page to apply in order. */
    queue: signal<readonly QueuedPatch[]>([]),
    /** What was written into each field, as JSON, for the "AI đề xuất" marker. */
    written: signal<Partial<Record<FillField, string>>>({}),
    /** The line under each lesson the outline proposal wrote, by row key. */
    notes: signal<Readonly<Record<string, LessonNoteView>>>({}),
    /** Step 4's assign rows as the assistant wrote them, as JSON by row id. */
    writtenRows: signal<Readonly<Record<number, string>>>({}),
  };

  private readonly player = new FillPlayer();
  private seq = 0;

  /** The session a new course page's URL names (`?session=`). */
  private readonly urlSessionId = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => positiveId(params.get('session'))),
    ),
  );

  /** The session this page shows: the one in its URL, or the one that drafted its course. */
  readonly sessionId$ = computed(() =>
    this.editor.isCreate$()
      ? this.urlSessionId()
      : this.state.courseSessionId(),
  );

  /** The session, once read, when it is this page's. */
  private readonly session = computed((): DraftingSession | undefined => {
    const session = this.drafting.session$();
    return session && session.id === this.sessionId$() ? session : undefined;
  });

  /** The session's current step, when the session is this page's. */
  private readonly step = computed((): DraftingStep | undefined =>
    this.session() ? this.drafting.step$() : undefined,
  );

  /** The session's step the page shows, whether it is the current one or one before it. */
  private readonly shownStep = computed((): DraftingStep | undefined => {
    const index = this.editor.step$();
    return this.session()?.steps.find((step) => step.step === index + 1);
  });

  /** The page shows the session's current step. */
  private readonly shown = computed(() => {
    const step = this.step();
    return step !== undefined && this.editor.step$() === step.step - 1;
  });

  /** The session that drafted the edit page's course: the page then resumes at its current step. */
  private readonly lookupMutation = serverMutation(
    (courseId: number) =>
      this.client.call(draftingSessionEndpoints.forCourse, {
        params: { courseId },
      }),
    { errors: 'toast', onSuccess: (session) => this.resume(session) },
  );

  private readonly confirmMutation = serverMutation(
    (input: ConfirmInput) =>
      this.client
        .call(draftingSessionEndpoints.confirm, {
          params: { sessionId: input.sessionId, step: input.step },
          body: input.body,
        })
        .pipe(
          catchError((error: unknown) => {
            if (toAppError(error).messageCode === DUPLICATE_CODE)
              this.codeTaken(input.body);
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
      this.client.call(draftingSessionEndpoints.proposeAgain, {
        params: { sessionId: input.sessionId, step: input.step },
      }),
    { errors: 'toast', onSuccess: (session) => this.awaitAgain(session) },
  );

  private readonly manualMutation = serverMutation(
    (input: StepInput) =>
      this.client.call(draftingSessionEndpoints.manual, {
        params: { sessionId: input.sessionId, step: input.step },
      }),
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
    if (!session) return null;
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
  readonly attached$ = computed(() => this.sessionId$() !== undefined);

  /** "Trợ lý đang soạn…": the server works on the step, or its fields are being written. */
  readonly working$ = computed(() => {
    if (this.state.playing()) return true;
    const step = this.shownStep();
    return (
      step?.state === 'proposing' && !this.state.stopped().includes(step.step)
    );
  });

  /** The step cannot be edited until the assistant finishes or is stopped. */
  readonly locked$ = this.working$;

  /** A Trợ lý ngoài, not the in-house assistant, proposes this page's session. */
  readonly external$ = computed(() => this.session()?.proposer === 'external');

  /** The document the Trợ lý ngoài reads on the author's machine, as it named it. */
  readonly externalSourceName$ = computed(() =>
    this.external$() ? (this.session()?.sourceName ?? null) : null,
  );

  /**
   * "Đang chờ Trợ lý ngoài đề xuất": the step shown waits for the Trợ lý ngoài's proposal. It
   * comes when the author asks the assistant on their machine, so no timer or progress is shown.
   */
  readonly waitingExternal$ = computed(
    () => this.external$() && this.working$() && !this.state.playing(),
  );

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
   * The step shown can be proposed again ("Đề xuất lại"): it is the session's current step, it
   * holds a proposal or was confirmed, the session is not over and nothing is being written.
   */
  readonly proposeAgainStep$ = computed((): DraftingStepNumber | null => {
    const session = this.session();
    const step = this.shownStep();
    return session?.status === 'active' &&
      step &&
      step.step === session.currentStep &&
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
   * The code the server proposes after the one confirmed was taken; the page offers it while its
   * code field holds another one.
   */
  readonly proposedCode$ = computed((): string | null => {
    const step = this.step();
    if (step?.step !== 1 || !step.proposal) return null;
    return this.editor.takenCode$() === null ? null : step.proposal.code;
  });

  /**
   * Why the last "Đã chốt" failed; a taken code is shown on the code field instead. A refusal that
   * names a field the page has no input for (the unit, `OWNER_MISMATCH`) says the server's line.
   */
  readonly confirmError$ = computed(() => {
    const error = this.confirmMutation.error();
    if (!error || error.messageCode === DUPLICATE_CODE) return undefined;
    const owner = error.fieldErrors?.find(
      (field) => field.code === OWNER_MISMATCH,
    );
    return owner ? { ...error, message: owner.message } : error;
  });

  /** The writes for the page's form, in order; each is applied once, by its `seq`. */
  readonly queue$ = this.state.queue.asReadonly();

  /** What the assistant wrote into each field, as JSON: the field is marked while it holds that. */
  readonly written$ = this.state.written.asReadonly();

  /** What the page says under a programme or module the assistant could not pick, while it is empty. */
  readonly emptyHints$ = computed((): DraftingHints => {
    const step = this.step();
    if (step?.step !== 1 || !step.proposal) return {};
    const proposal = step.proposal;
    const hints: DraftingHints = {};
    for (const field of ['programId', 'moduleId'] as const) {
      // A code-only proposal (after a taken code) says nothing about the programme or module.
      if (!(field in proposal)) continue;
      if (proposal[field] === null || proposal.unsure?.includes(field))
        hints[field] = EMPTY_HINTS[field];
    }
    return hints;
  });

  /**
   * The assistant's line under each lesson of its outline: by row key (`key:…`) while the outline
   * is a proposal, then by saved lesson id (`id:…`), as the server keeps them once confirmed.
   */
  readonly lessonNotes$ = computed((): ReadonlyMap<string, LessonNoteView> => {
    const outline = this.session()?.steps.find((step) => step.step === 2);
    if (outline?.step !== 2) return new Map();
    if (outline.state === 'confirmed')
      return new Map(
        (outline.lessonNotes ?? []).map((note) => [
          `id:${note.lessonId}`,
          {
            text: `${note.description} · Nguồn: ${note.sourceSection}`,
            suggested: false,
          },
        ]),
      );
    return new Map(
      Object.entries(this.state.notes()).map(([key, note]) => [
        `key:${key}`,
        note,
      ]),
    );
  });

  /**
   * Step 3's draft questions are on the page: the step is the session's current one and not
   * confirmed yet. Once confirmed they are the course's final exam, shown by the exam card.
   */
  readonly rulesShown$ = computed(() => {
    const step = this.step();
    return step?.step === 3 && step.state !== 'confirmed';
  });

  /** The assign rows that still hold what the assistant wrote, until step 4 is confirmed. */
  readonly suggestedRows$ = computed((): ReadonlySet<number> => {
    const audience = this.session()?.steps.find((step) => step.step === 4);
    if (!audience || audience.state === 'confirmed') return new Set();
    const written = this.state.writtenRows();
    return new Set(
      this.editor
        .publishRows$()
        .filter((row) => written[row.id] === JSON.stringify(row))
        .map((row) => row.id),
    );
  });

  /** The chat card's "Đã chốt" for a step of this page's session: the page confirms it. */
  readonly confirmRequested$ = computed((): DraftingStepNumber | null => {
    const request = this.drafting.confirmRequest$();
    return request && request.sessionId === this.session()?.id
      ? request.step
      : null;
  });

  /** A proposal arrived: writing it starts a timer, outside the signal graph. */
  private readonly playWhenReady = effect(() => {
    const step = this.ready();
    if (step) untracked(() => this.play(step));
  });

  constructor() {
    this.drafting.showInEditor(this.sessionId$);
    this.findCourseSession();
    inject(DestroyRef).onDestroy(() => {
      this.player.cancel();
      this.drafting.leaveEditor(this.sessionId$);
    });
  }

  // ---- setters ----------------------------------------------------------------------------

  private setCourseSessionId(sessionId: number): void {
    this.state.courseSessionId.set(sessionId);
  }

  private setPlaying(playing: boolean): void {
    this.state.playing.set(playing);
  }

  private setPlayed(key: string): void {
    this.state.played.set(key);
  }

  private setPlayedSteps(steps: readonly DraftingStepNumber[]): void {
    this.state.playedSteps.set(steps);
  }

  private setStopped(steps: readonly DraftingStepNumber[]): void {
    this.state.stopped.set(steps);
  }

  private setReproposed(steps: readonly DraftingStepNumber[]): void {
    this.state.reproposed.set(steps);
  }

  private setQueue(queue: readonly QueuedPatch[]): void {
    this.state.queue.set(queue);
  }

  private setWritten(written: Partial<Record<FillField, string>>): void {
    this.state.written.set(written);
  }

  private setNotes(notes: Readonly<Record<string, LessonNoteView>>): void {
    this.state.notes.set(notes);
  }

  private setWrittenRows(rows: Readonly<Record<number, string>>): void {
    this.state.writtenRows.set(rows);
  }

  // ---- commands ---------------------------------------------------------------------------

  /**
   * Why "Đã chốt" cannot confirm the step shown yet, given what the page knows of its form: the
   * assistant still writes it, a field of the step is invalid, a file still uploads, there is no
   * unit to own a new course, or step 3's kept questions are not complete. Null when it can.
   */
  problemFor(
    facts: Pick<DraftingPageFacts, 'stepInvalid' | 'rulesProblem'>,
  ): string | null {
    if (this.locked$())
      return 'Trợ lý đang soạn bước này. Chờ trợ lý soạn xong hoặc bấm Dừng.';
    if (facts.stepInvalid)
      return 'Còn trường chưa hợp lệ ở bước này. Sửa xong rồi bấm Đã chốt.';
    const coverUploading =
      this.editor.isCreate$() &&
      this.editor.step$() === 0 &&
      this.editor.coverUploading$();
    if (this.editor.pendingUploads$() > 0 || coverUploading)
      return 'Còn tệp đang tải lên. Chờ tải xong rồi bấm Đã chốt.';
    if (this.editor.isCreate$() && !this.editor.ownerOrgId$())
      return 'Chưa xác định được đơn vị sở hữu khóa học.';
    if (this.editor.step$() === 2) return facts.rulesProblem;
    return null;
  }

  /**
   * "Đã chốt" on the bar or on the chat's card: the step is confirmed with what the page holds
   * now. Step 1 sends the create command, so the server makes the draft course from it; step 2
   * the whole draft, as "Lưu nháp" saves it (lessons without content do not stop it); step 3 the
   * draft with the kept questions and their competency, which become a new final exam; step 4
   * nothing: it ends the flow, and the assign rows wait for the author's own "Xuất bản". On
   * another step the page first opens the one named, where the bar says what still stops it.
   */
  confirm(step: DraftingStepNumber, facts: DraftingPageFacts): ConfirmOutcome {
    const sessionId = this.session()?.id;
    if (sessionId === undefined) return 'refused';
    if (this.editor.step$() !== step - 1) {
      this.editor.goToStep(step - 1);
      return 'opened';
    }
    if (this.confirmStep$() !== step || this.problemFor(facts) !== null)
      return 'refused';
    const body = this.confirmBody(step, facts);
    if (!body) return 'refused';
    this.player.cancel();
    this.setPlaying(false);
    this.confirmMutation.run({ sessionId, step, body });
    return 'sent';
  }

  /** The page took the chat card's "Đã chốt". */
  confirmRequestTaken(): void {
    this.drafting.confirmRequestTaken();
  }

  /** "Dùng mã …": the code field takes the code the server proposed. */
  useSuggestedCode(): void {
    const code = this.proposedCode$();
    if (code !== null) this.write(fieldPatch('code', code));
  }

  /**
   * "Đề xuất lại": the author agrees first, since what the step holds on the page is replaced.
   * The server proposes only this step again, and its proposal replaces only this step's fields.
   */
  async proposeAgain(step: DraftingStepNumber): Promise<void> {
    if (this.proposeAgainStep$() !== step) return;
    // A Trợ lý ngoài proposes only when asked on the author's machine: the dialog says so.
    const message = this.external$()
      ? 'Bước này quay lại chờ đề xuất. Hãy nhắn Trợ lý ngoài (ví dụ Claude Code) đề xuất lại bước này; khi đề xuất mới tới, các trường của bước, kể cả phần bạn đã sửa, sẽ được thay. Các bước khác giữ nguyên.'
      : 'Trợ lý soạn lại bước này từ tài liệu. Các trường của bước, kể cả phần bạn đã sửa, sẽ được thay bằng đề xuất mới. Các bước khác giữ nguyên.';
    const agreed = await firstValueFrom(
      confirmDialog(this.dialog, {
        title: 'Đề xuất lại bước này?',
        message,
        confirmLabel: 'Đề xuất lại',
        tone: 'danger',
      }),
    );
    const sessionId = this.session()?.id;
    if (agreed && sessionId !== undefined)
      this.againMutation.run({ sessionId, step });
  }

  /** "Thử lại" on a failed step: the server proposes only this step again. */
  retry(step: DraftingStepNumber): void {
    const sessionId = this.session()?.id;
    if (sessionId === undefined || this.failed$()?.step !== step) return;
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

  /** "Dừng": nothing more is written, and the server stops if it still works on the step. */
  stop(): void {
    const step = this.shownStep() ?? this.step();
    this.player.cancel();
    this.setPlaying(false);
    if (!step) return;
    this.setStopped(withStep(this.state.stopped(), step.step));
    if (step.state === 'proposing') this.drafting.stop();
  }

  /** An edit page looks up the session that drafted its course; the one just confirmed is known. */
  private findCourseSession(): void {
    if (untracked(this.editor.isCreate$)) return;
    const courseId = untracked(this.editor.courseId$);
    if (courseId === undefined) return;
    const followed = untracked(this.drafting.session$);
    if (followed?.courseId === courseId) {
      this.setCourseSessionId(followed.id);
      this.drafting.refresh();
      return;
    }
    this.lookupMutation.run(courseId);
  }

  /** The edit page of a drafted course lands on the session's current step. */
  private resume(session: DraftingSession | null): void {
    if (!session) return;
    this.setCourseSessionId(session.id);
    if (session.status !== 'finished')
      this.editor.goToStep(session.currentStep - 1);
  }

  private confirmBody(
    step: DraftingStepNumber,
    { value, rules }: DraftingPageFacts,
  ): ConfirmDraftingStepCommand | null {
    if (step === 1) {
      const ownerOrgId = this.editor.ownerOrgId$();
      return ownerOrgId
        ? { course: toCreateCourseCommand(value, value.code, ownerOrgId) }
        : null;
    }
    if (step === 4) return {};
    const revision = this.editor.course$()?.revision;
    if (!revision) return null;
    const draft = toSaveDraftCommand(value, revision.rowVersion);
    if (step === 2) return { draft };
    return rules ? { draft, ...rules } : null;
  }

  /** The server proposes another code: the field says "mã đã có" until the author takes it. */
  private codeTaken(body: ConfirmDraftingStepCommand): void {
    const course = 'course' in body ? body.course : null;
    if (course) this.editor.markCodeTaken(course.code);
    this.drafting.refresh();
  }

  /** Step 1 makes the draft course: the page then continues as its edit page, on the next step. */
  private moveOn(session: DraftingSession): void {
    const next = session.currentStep - 1;
    // Confirmed questions are the course's exam now: the page keeps no draft of them.
    if (
      session.steps.some(
        (step) => step.step === 3 && step.state === 'confirmed',
      )
    )
      this.questions.clear();
    this.drafting.follow(session.id);
    if (this.editor.isCreate$() && session.courseId !== null)
      this.editor.moveToCourse(session.courseId, next);
    else {
      // The confirm saved the draft: the page reads it again (its version, the AI flag).
      this.editor.reloadCourse();
      this.editor.goToStep(next);
    }
    this.drafting.refresh();
  }

  /** The steps now proposed again get their next proposal written over what the form holds. */
  private awaitAgain(session: DraftingSession): void {
    for (const step of session.steps) {
      if (step.state !== 'proposing') continue;
      this.setStopped(
        this.state.stopped().filter((item) => item !== step.step),
      );
      this.setPlayedSteps(
        this.state.playedSteps().filter((item) => item !== step.step),
      );
      this.setReproposed(withStep(this.state.reproposed(), step.step));
    }
    this.drafting.refresh();
  }

  private play(step: DraftingStep): void {
    this.player.cancel();
    this.setPlayed(`${step.step}|${step.updateTime}`);
    // A later proposal of a step already written (a new code after a taken one) is not written
    // over what the author has: the page offers the new code instead.
    if (this.state.playedSteps().includes(step.step)) {
      this.setPlaying(false);
      return;
    }
    this.setPlayedSteps(withStep(this.state.playedSteps(), step.step));
    // A course that exists keeps its code: step 1 proposed again leaves it alone.
    const keepCode = !this.editor.isCreate$();
    const patches = fillSteps(step).filter(
      (patch) => !(keepCode && patch.field === 'code'),
    );
    this.setQueue([]);
    this.setPlaying(true);
    // The step unlocks as soon as its last field is written.
    this.player.play(
      patches,
      (patch) => this.write(patch),
      () => this.setPlaying(false),
    );
  }

  private write(patch: DraftingPatch): void {
    if ('picks' in patch) {
      // Step 4 fills the assign rows only: they are saved when the author publishes.
      this.editor.setPublishPicks(patch.picks);
      this.setWrittenRows(
        Object.fromEntries(
          this.editor
            .publishRows$()
            .map((row) => [row.id, JSON.stringify(row)]),
        ),
      );
      return;
    }
    if ('rules' in patch) {
      this.questions.write(patch);
      return;
    }
    this.setQueue([...this.state.queue(), { seq: ++this.seq, patch }]);
    this.setWritten({
      ...this.state.written(),
      [patch.field]: writtenOf(patch),
    });
    if (patch.notes) this.setNotes(patch.notes);
    // A programme picked here is not a change event of its select: the page lists its modules.
    if (patch.field === 'programId')
      this.editor.pickProgram(String(patch.value));
  }
}

const withStep = (
  steps: readonly DraftingStepNumber[],
  step: DraftingStepNumber,
): readonly DraftingStepNumber[] =>
  steps.includes(step) ? steps : [...steps, step];
