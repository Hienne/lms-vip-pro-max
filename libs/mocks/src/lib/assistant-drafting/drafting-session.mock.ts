import {
  ConfirmAudienceCommandSchema,
  ConfirmBasicsCommandSchema,
  ConfirmOutlineCommandSchema,
  ConfirmRulesCommandSchema,
  draftingSessionEndpoints,
  StartDraftingFieldsSchema,
  type AnyEndpoint,
  type CourseDetail,
  type ConfirmRulesCommand,
  type CreateCourseCommand,
  type DraftingSession,
  type DraftingStep,
  type DraftingStepNumber,
  type LessonNote,
  type OutlineProposal,
  type SaveDraftCommand,
  type StartDraftingFields,
} from '@lms/contracts';
import { backendRefusal, BACKEND_RESPONSES } from '../backend-responses';
import type { FakeReply, FakeRequest } from '../backend/fake-backend';
import { envelopeError, envelopeOk } from '../envelope';
import {
  basicsProposalFixture,
  draftingStepFixture,
} from './drafting-session.fixtures';

// The backend's drafting sessions (corebanking-academy `assistant/drafting`) as the in-app mock:
// sessions live in memory and a proposing step becomes ready after a few looks at the session, so
// the editor's fill, confirm, propose-again, stop and failures can be tried without a model. The
// knobs below let a spec fail a step, take a course code or change how long a proposal takes.

const ok = (data: unknown): FakeReply => ({
  status: 200,
  body: envelopeOk(data),
});
const refusal = (key: keyof typeof BACKEND_RESPONSES): FakeReply =>
  backendRefusal(key);

const INVALID_STATE_MESSAGE = 'Bước này chưa sẵn sàng để chốt.';
const invalidState = (message = INVALID_STATE_MESSAGE): FakeReply => ({
  status: 200,
  body: envelopeError(
    BACKEND_RESPONSES.validationFailed.code,
    BACKEND_RESPONSES.validationFailed.title,
    message,
    [{ field: 'step', code: 'INVALID_STATE', message }],
  ),
});

/** A session the assistant still works in: a failed one is retried or filled by hand. */
const isOpen = (session: DraftingSession) =>
  session.status === 'active' || session.status === 'failed';
const fieldRequired = (field: string, message: string): FakeReply => ({
  status: 200,
  body: envelopeError(
    BACKEND_RESPONSES.validationFailed.code,
    BACKEND_RESPONSES.validationFailed.title,
    message,
    [{ field, code: 'REQUIRED', message }],
  ),
});
const takenCode = (): FakeReply => {
  const { status, code, title, message } = BACKEND_RESPONSES.learningDuplicate;
  return {
    status,
    body: envelopeError(code, title, message, [
      { field: 'course.code', code: 'DUPLICATE', message },
    ]),
  };
};

/** Files a user may upload for the assistant and leave unused within a day, as the server allows. */
export const DRAFTING_UPLOADS_PER_DAY = 10;

/** The server's refusal of an upload past the daily cap: why, and how long to wait, on `limit`. */
const uploadLimit = (): FakeReply => ({
  status: 200,
  body: envelopeError(
    'ASSISTANT-JOB_RATE_LIMITED',
    'Đã hết lượt',
    'Bạn đã tạo đủ số khóa học bằng AI cho phép trong ngày.',
    [
      {
        field: 'limit',
        code: 'DAILY_UPLOAD_LIMIT',
        message: `Bạn đã tải lên ${DRAFTING_UPLOADS_PER_DAY} tài liệu cho trợ lý trong ngày, thử lại sau 3 giờ.`,
      },
    ],
  ),
});

/** The runner's text for a document it could not read, the failure a spec asks for. */
export const DRAFTING_STEP_FAILURE =
  'Không đọc được tài liệu nguồn. Hãy thử lại hoặc tự điền bước này.';

const CONFIRM_BODIES = {
  1: ConfirmBasicsCommandSchema,
  2: ConfirmOutlineCommandSchema,
  3: ConfirmRulesCommandSchema,
  4: ConfirmAudienceCommandSchema,
} as const;

/** A chat attachment uploaded as a course source: its uploader's, usable for one session. */
interface MockSource {
  readonly documentId: number;
  readonly owner: string;
  readonly fileName: string;
  used: boolean;
}

/** Told when a step of a session gets its proposal, or fails: the chat's step message. */
export type DraftingStepReady = (
  owner: string,
  session: DraftingSession,
  step: DraftingStep,
) => void;

interface MockSession {
  session: DraftingSession;
  readonly owner: string;
  readonly fields: StartDraftingFields;
  /** Looks at the session while each step was proposing. */
  readonly polls: Map<number, number>;
  /** The course code step 1 proposes; replaced when a confirm finds it taken. */
  code: string;
}

const now = () => new Date().toISOString();

const formValue = (body: unknown, name: string): unknown =>
  body instanceof FormData
    ? body.get(name)
    : (body as Record<string, unknown> | null)?.[name];

const stepNumber = (value: unknown): DraftingStepNumber | undefined => {
  const step = Number(value);
  return step === 1 || step === 2 || step === 3 || step === 4
    ? step
    : undefined;
};

/**
 * The course writes of a confirm, as the backend does them through its course service: step 1
 * creates the draft course, step 2 saves the outline (and marks the revision as AI made when the
 * step held a proposal), step 3 saves the rules, creates the kept questions and a new final exam
 * of them, all or nothing. The fake backend hands its own over; without one, the mock makes up ids.
 */
export interface DraftingCourses {
  create(command: CreateCourseCommand): FakeReply | undefined;
  saveOutline(
    courseId: number,
    revisionId: number,
    draft: SaveDraftCommand,
    aiGenerated: boolean,
  ): FakeReply | undefined;
  saveRules(
    courseId: number,
    revisionId: number,
    command: ConfirmRulesCommand,
    aiGenerated: boolean,
  ): FakeReply | undefined;
  /** The draft of the course as saved now, for the step 4 publish check. */
  detail?(courseId: number): CourseDetail | undefined;
  /** The draft holds content the assistant proposed: publishing asks "Tôi đã rà soát nội dung". */
  markAiGenerated?(courseId: number): void;
}

type SavedLesson = CourseDetail['chapters'][number]['lessons'][number];

/** The editor's `lessonProblem` on a saved lesson: what stops it from being published. */
const lessonIncomplete = ({ lesson, blocks }: SavedLesson): boolean => {
  if (lesson.lessonType === 'scorm') return !lesson.scormPackageId;
  if (lesson.lessonType === 'quiz') return !lesson.quizId;
  return blocks.length === 0;
};

/**
 * What still blocks publishing the saved draft, as step 4 lists it in the chat: the labels of the
 * editor's failing required pre-publish checks (`draftChecks`), in its order, then how many
 * content lessons are still empty. A spec on the editor proves the two lists agree.
 */
export function publishBlockersOf(detail: CourseDetail): string[] {
  const { revision } = detail;
  const lessons = detail.chapters.flatMap((chapter) => chapter.lessons);
  const empty = lessons.filter(
    (item) =>
      item.lesson.lessonType !== 'quiz' &&
      item.lesson.lessonType !== 'scorm' &&
      item.blocks.length === 0,
  ).length;
  const blockers: string[] = [];
  if (!revision.title?.trim() || !revision.programId)
    blockers.push('Có tên khóa học và chương trình');
  if (lessons.length === 0) blockers.push('Có ít nhất 1 bài học');
  if (lessons.some(lessonIncomplete))
    blockers.push('Mọi bài học có nội dung, đủ tệp hoặc đã chọn bài kiểm tra');
  if (!revision.level) blockers.push('Đã chọn mức độ khóa học');
  if (empty > 0) blockers.push(`${empty} bài chưa có nội dung`);
  return blockers;
}

type ProposedLesson = OutlineProposal['chapters'][number]['lessons'][number];

/**
 * Each saved lesson that came from the proposal, as the server keeps it: matched by title first,
 * then a renamed one by its place in the outline. Lessons the author added get none.
 */
function lessonNotesOf(
  proposal: OutlineProposal,
  saved: CourseDetail,
): LessonNote[] {
  const proposed = proposal.chapters.flatMap((chapter) => chapter.lessons);
  const used = new Set<ProposedLesson>();
  const matched = new Map<number, ProposedLesson>();
  const savedLessons = saved.chapters.flatMap((chapter) =>
    chapter.lessons.map((item) => item.lesson),
  );
  for (const lesson of savedLessons) {
    const found = proposed.find(
      (item) => !used.has(item) && item.title.trim() === lesson.title.trim(),
    );
    if (found) {
      used.add(found);
      matched.set(lesson.id, found);
    }
  }
  saved.chapters.forEach((chapter, ci) =>
    chapter.lessons.forEach(({ lesson }, li) => {
      const found = proposal.chapters[ci]?.lessons[li];
      if (found && !matched.has(lesson.id) && !used.has(found)) {
        used.add(found);
        matched.set(lesson.id, found);
      }
    }),
  );
  return savedLessons.flatMap((lesson) => {
    const from = matched.get(lesson.id);
    return from
      ? [
          {
            lessonId: lesson.id,
            description: from.description,
            sourceSection: from.sourceSection,
          },
        ]
      : [];
  });
}

const replyData = (reply: FakeReply | undefined): unknown =>
  reply &&
  typeof reply.body === 'object' &&
  reply.body !== null &&
  'data' in reply.body
    ? (reply.body as { data: unknown }).data
    : undefined;

const replyCode = (reply: FakeReply | undefined): unknown =>
  reply && typeof reply.body === 'object' && reply.body !== null
    ? (reply.body as { messageCode?: unknown }).messageCode
    : undefined;

export class DraftingSessionMock {
  /** How many looks at a session still show a step `proposing` before its proposal is ready. */
  pollsBeforeProposal = 2;

  private nextId = 1;
  private nextDocument = 40;
  private nextCode = 1;
  private sessions: MockSession[] = [];
  private readonly failing = new Set<DraftingStepNumber>();
  private readonly takenCodes = new Set<string>();
  private readonly sources: MockSource[] = [];

  /** Called each time a step becomes `proposed` or `failed`; the fake backend posts the step message. */
  onStepReady: DraftingStepReady | undefined;

  /** The courses the steps save into, for the session reads that make a proposal (step 4's check). */
  private courses: DraftingCourses | undefined;

  /** The next time `step` would be ready, it fails instead (once). */
  failNext(step: DraftingStepNumber): void {
    this.failing.add(step);
  }

  /** A step 1 confirm with this course code is refused as taken, and a new code is proposed. */
  takeCodeOnConfirm(code: string): void {
    this.takenCodes.add(code);
  }

  answers(endpoint: AnyEndpoint): boolean {
    return Object.values(draftingSessionEndpoints).some(
      (item) => item === endpoint,
    );
  }

  handle(
    endpoint: AnyEndpoint,
    request: FakeRequest,
    owner: string,
    courses?: DraftingCourses,
  ): FakeReply | undefined {
    if (!this.answers(endpoint)) return undefined;
    this.courses = courses;
    if (endpoint === draftingSessionEndpoints.start)
      return this.start(request, owner);
    if (endpoint === draftingSessionEndpoints.uploadSource) {
      const file = formValue(request.body, 'file');
      if (!(file instanceof Blob)) return refusal('validationFailed');
      // Like the server: a cap on the files waiting unused for a session.
      const unused = this.sources.filter(
        (item) => item.owner === owner && !item.used,
      );
      if (unused.length >= DRAFTING_UPLOADS_PER_DAY) return uploadLimit();
      const source: MockSource = {
        documentId: this.nextDocument++,
        owner,
        fileName: (file as File).name || 'tai-lieu.pdf',
        used: false,
      };
      this.sources.push(source);
      return ok({
        documentId: source.documentId,
        fileName: source.fileName,
        status: 'ready',
      });
    }
    if (endpoint === draftingSessionEndpoints.forCourse) {
      const courseId = Number(request.params['courseId']);
      const entry = this.sessions.find(
        (item) => item.owner === owner && item.session.courseId === courseId,
      );
      if (!entry) return ok(null);
      this.advance(entry);
      return ok(this.view(entry));
    }
    const entry = this.sessions.find(
      (item) =>
        item.owner === owner &&
        item.session.id === Number(request.params['sessionId']),
    );
    if (!entry) return refusal('resourceNotFound');
    if (endpoint === draftingSessionEndpoints.get) {
      this.advance(entry);
      return ok(this.view(entry));
    }
    if (endpoint === draftingSessionEndpoints.stop) return this.stop(entry);
    const step = stepNumber(request.params['step']);
    if (!step) return refusal('validationFailed');
    if (endpoint === draftingSessionEndpoints.confirm)
      return this.confirm(entry, step, request.body, courses);
    if (endpoint === draftingSessionEndpoints.proposeAgain)
      return this.proposeAgain(entry, step);
    return this.manual(entry, step);
  }

  private start(request: FakeRequest, owner: string): FakeReply {
    const file = formValue(request.body, 'file');
    if (!(file instanceof Blob)) return refusal('validationFailed');
    let fields: StartDraftingFields = {};
    const text = formValue(request.body, 'fields');
    if (typeof text === 'string' && text !== '') {
      try {
        fields = StartDraftingFieldsSchema.parse(JSON.parse(text));
      } catch {
        return refusal('validationFailed');
      }
    }
    const conversation = formValue(request.body, 'conversationId');
    return ok(
      this.create(
        owner,
        fields,
        {
          documentId: this.nextDocument++,
          fileName: (file as File).name || 'tai-lieu.pdf',
        },
        conversation == null || conversation === ''
          ? null
          : Number(conversation),
      ),
    );
  }

  /**
   * `start_course_drafting` with the chat's attachment: a session for this conversation, from a
   * source the owner uploaded that no session uses yet. `undefined` for any other document.
   */
  startFromSource(
    owner: string,
    documentId: number,
    fields: StartDraftingFields,
    conversationId: number | null,
  ): DraftingSession | undefined {
    const source = this.sources.find(
      (item) =>
        item.documentId === documentId && item.owner === owner && !item.used,
    );
    if (!source) return undefined;
    source.used = true;
    return this.create(owner, fields, source, conversationId);
  }

  private create(
    owner: string,
    fields: StartDraftingFields,
    source: { readonly documentId: number; readonly fileName: string },
    conversationId: number | null,
  ): DraftingSession {
    const time = now();
    const entry: MockSession = {
      owner,
      fields,
      polls: new Map(),
      code: basicsProposalFixture.code,
      session: {
        id: this.nextId++,
        status: 'active',
        currentStep: 1,
        courseId: null,
        revisionId: null,
        conversationId,
        source: {
          documentId: source.documentId,
          fileName: source.fileName,
          status: 'ready',
        },
        error: null,
        steps: [draftingStepFixture(1, 'proposing')],
        createTime: time,
        updateTime: time,
      },
    };
    this.sessions.unshift(entry);
    return this.view(entry);
  }

  /** The state of a step of the owner's session now, for the chat's card; `undefined` when none. */
  stepState(
    owner: string,
    sessionId: number,
    step: number,
  ): { state: DraftingStep['state']; courseId: number | null } | undefined {
    const entry = this.sessions.find(
      (item) => item.owner === owner && item.session.id === sessionId,
    );
    const found = entry && this.stepOf(entry, step);
    return entry && found
      ? { state: found.state, courseId: entry.session.courseId }
      : undefined;
  }

  private confirm(
    entry: MockSession,
    step: DraftingStepNumber,
    body: unknown,
    courses?: DraftingCourses,
  ): FakeReply {
    const session = entry.session;
    const current = this.stepOf(entry, step);
    // Confirming step 1 again (a retried request) returns the session as it is: no second course.
    if (step === 1 && session.courseId !== null) {
      return ok(this.view(entry));
    }
    // Like the server: only an active session's current step, once proposed or left to the author.
    if (
      session.status !== 'active' ||
      step !== session.currentStep ||
      !current ||
      !['proposed', 'failed', 'manual'].includes(current.state)
    ) {
      return invalidState();
    }
    const parsed = CONFIRM_BODIES[step].safeParse(body);
    if (!parsed.success) return refusal('validationFailed');
    if (step === 1) {
      const course = (parsed.data as { course: CreateCourseCommand }).course;
      const code = course.code.trim();
      const created = this.takenCodes.has(code)
        ? undefined
        : courses?.create(course);
      if (
        this.takenCodes.has(code) ||
        replyCode(created) === BACKEND_RESPONSES.learningDuplicate.code
      ) {
        this.proposeCode(entry, current, code);
        // The chat says which code is proposed now.
        this.ready(entry, 1);
        return takenCode();
      }
      if (created && !replyData(created)) return created;
      const detail = replyData(created) as
        | { course: { id: number }; revision: { id: number } }
        | undefined;
      session.courseId = detail?.course.id ?? 500 + session.id;
      session.revisionId = detail?.revision.id ?? 600 + session.id;
    }
    let confirmed: DraftingStep = current;
    if (current.step === 3) {
      const rules = parsed.data as ConfirmRulesCommand;
      // Kept questions go to the bank, which tags each with a competency and the course's programme.
      if (rules.questions.length > 0 && rules.competencyId === null)
        return fieldRequired(
          'competencyId',
          'Chọn năng lực cho các câu hỏi trước khi chốt bước này.',
        );
      if (rules.questions.length > 0 && rules.draft.programId == null)
        return fieldRequired(
          'draft.programId',
          'Chọn chương trình đào tạo để tạo bài kiểm tra từ các câu hỏi.',
        );
      const savedReply =
        session.courseId !== null && session.revisionId !== null
          ? courses?.saveRules(
              session.courseId,
              session.revisionId,
              rules,
              current.proposal !== null && rules.questions.length > 0,
            )
          : undefined;
      if (savedReply && !replyData(savedReply)) return savedReply;
    }
    if (current.step === 2) {
      const draft = (parsed.data as { draft: SaveDraftCommand }).draft;
      const proposal = current.proposal;
      // The page sends what it holds, content included: the assistant itself never writes any.
      const proposedTitles = new Set(
        (proposal?.chapters ?? []).flatMap((chapter) =>
          chapter.lessons.map((lesson) => lesson.title.trim()),
        ),
      );
      // AI made only when a proposed lesson is among the saved ones.
      const keepsProposal = draft.chapters.some((chapter) =>
        chapter.lessons.some((lesson) =>
          proposedTitles.has(lesson.title.trim()),
        ),
      );
      const savedReply =
        session.courseId !== null && session.revisionId !== null
          ? courses?.saveOutline(
              session.courseId,
              session.revisionId,
              draft,
              keepsProposal,
            )
          : undefined;
      if (savedReply && !replyData(savedReply)) return savedReply;
      const saved = replyData(savedReply) as CourseDetail | undefined;
      confirmed = {
        ...current,
        lessonNotes: !proposal
          ? null
          : saved
            ? lessonNotesOf(proposal, saved)
            : proposal.chapters
                .flatMap((chapter) => chapter.lessons)
                .map((lesson, index) => ({
                  lessonId: 900 + index,
                  description: lesson.description,
                  sourceSection: lesson.sourceSection,
                })),
      };
    }
    this.replace(entry, { ...confirmed, state: 'confirmed', error: null });
    if (step === 4) {
      session.status = 'finished';
    } else {
      const next = (step + 1) as DraftingStepNumber;
      session.currentStep = next;
      entry.polls.set(next, 0);
      session.steps = [
        ...session.steps,
        draftingStepFixture(next, 'proposing'),
      ];
    }
    return ok(this.view(entry));
  }

  /**
   * Step 1 proposes a new code after a taken one, with a line for the chat, as the server does.
   */
  private proposeCode(
    entry: MockSession,
    current: DraftingStep,
    taken: string,
  ): void {
    entry.code = this.freshCode();
    // A step with no proposal (filled by hand, failed) gets one holding only the code.
    if (current.step === 1) {
      this.replace(entry, {
        ...current,
        proposal: { ...(current.proposal ?? {}), code: entry.code },
        notes: [
          ...current.notes,
          `Mã ${taken} đã có; trợ lý đề xuất mã ${entry.code}.`,
        ],
      });
    }
  }

  private proposeAgain(
    entry: MockSession,
    step: DraftingStepNumber,
  ): FakeReply {
    const current = this.stepOf(entry, step);
    // Only the session's current step: a proposal for another one would show nowhere.
    if (step !== entry.session.currentStep)
      return invalidState(
        'Chỉ đề xuất lại được bước trợ lý đang soạn. Các bước đã chốt, bạn tự sửa rồi Lưu nháp.',
      );
    if (
      !isOpen(entry.session) ||
      !current ||
      !['proposed', 'failed'].includes(current.state)
    )
      return invalidState('Bước này không đề xuất lại được lúc này.');
    entry.polls.set(step, 0);
    this.replace(entry, {
      ...current,
      state: 'proposing',
      proposal: null,
      error: null,
    });
    entry.session.status = 'active';
    entry.session.error = null;
    return ok(this.view(entry));
  }

  /**
   * A stopped step keeps a proposal it still holds (`proposed`), else it is the author's
   * (`manual`); the session goes on. Mock proposals appear whole, so it is `manual`.
   */
  private stop(entry: MockSession): FakeReply {
    for (const step of entry.session.steps) {
      if (step.state === 'proposing')
        this.replace(entry, {
          ...step,
          state: step.proposal ? 'proposed' : 'manual',
        });
    }
    return ok(this.view(entry));
  }

  private manual(entry: MockSession, step: DraftingStepNumber): FakeReply {
    const current = this.stepOf(entry, step);
    if (
      !isOpen(entry.session) ||
      step !== entry.session.currentStep ||
      !current ||
      current.state === 'confirmed'
    ) {
      return invalidState('Bước này không tự điền được lúc này.');
    }
    this.replace(entry, { ...current, state: 'manual', error: null });
    entry.session.status = 'manual';
    entry.session.error = null;
    return ok(this.view(entry));
  }

  /** Each look at the session brings every proposing step closer to its proposal. */
  private advance(entry: MockSession): void {
    for (const step of entry.session.steps) {
      if (step.state !== 'proposing') continue;
      const polls = entry.polls.get(step.step) ?? 0;
      if (polls < this.pollsBeforeProposal) {
        entry.polls.set(step.step, polls + 1);
        continue;
      }
      if (this.failing.delete(step.step)) {
        this.replace(entry, {
          ...step,
          state: 'failed',
          error: DRAFTING_STEP_FAILURE,
        });
        entry.session.status = 'failed';
        entry.session.error = DRAFTING_STEP_FAILURE;
        this.ready(entry, step.step);
        continue;
      }
      this.replace(entry, this.proposed(entry, step.step));
      // A proposal of the outline or questions in a course that exists makes it AI made.
      const courseId = entry.session.courseId;
      if (courseId !== null && (step.step === 2 || step.step === 3))
        this.courses?.markAiGenerated?.(courseId);
      this.ready(entry, step.step);
    }
  }

  private ready(entry: MockSession, step: DraftingStepNumber): void {
    const reached = this.stepOf(entry, step);
    if (reached) this.onStepReady?.(entry.owner, this.view(entry), reached);
  }

  private proposed(entry: MockSession, step: DraftingStepNumber): DraftingStep {
    const ready = draftingStepFixture(step, 'proposed');
    if (ready.step === 4 && ready.proposal) {
      const courseId = entry.session.courseId;
      const saved =
        courseId === null ? undefined : this.courses?.detail?.(courseId);
      return saved
        ? {
            ...ready,
            proposal: {
              ...ready.proposal,
              publishBlockers: publishBlockersOf(saved),
            },
          }
        : ready;
    }
    if (ready.step !== 1 || !ready.proposal) return ready;
    return {
      ...ready,
      proposal: {
        ...ready.proposal,
        title: entry.fields.title || ready.proposal.title,
        level: entry.fields.level ?? ready.proposal.level,
        code: entry.code,
      },
    };
  }

  private stepOf(entry: MockSession, step: number): DraftingStep | undefined {
    return entry.session.steps.find((item) => item.step === step);
  }

  private replace(entry: MockSession, step: DraftingStep): void {
    const time = now();
    entry.session.steps = entry.session.steps.map((item) =>
      item.step === step.step ? { ...step, updateTime: time } : item,
    );
    entry.session.updateTime = time;
  }

  private freshCode(): string {
    let code: string;
    do {
      code = `AI-${(this.nextCode++).toString(36).toUpperCase().padStart(8, '0')}`;
    } while (this.takenCodes.has(code));
    return code;
  }

  /** A copy, so a caller never changes the stored session. */
  private view(entry: MockSession): DraftingSession {
    return structuredClone(entry.session);
  }
}
