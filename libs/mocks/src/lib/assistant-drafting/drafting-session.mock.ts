import {
  ConfirmAudienceCommandSchema,
  ConfirmBasicsCommandSchema,
  ConfirmOutlineCommandSchema,
  ConfirmRulesCommandSchema,
  draftingSessionEndpoints,
  StartDraftingFieldsSchema,
  type AnyEndpoint,
  type DraftingSession,
  type DraftingStep,
  type DraftingStepNumber,
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
const invalidState = (): FakeReply => ({
  status: 200,
  body: envelopeError(
    BACKEND_RESPONSES.validationFailed.code,
    BACKEND_RESPONSES.validationFailed.title,
    INVALID_STATE_MESSAGE,
    [{ field: 'step', code: 'INVALID_STATE', message: INVALID_STATE_MESSAGE }],
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

/** The runner's text for a document it could not read, the failure a spec asks for. */
export const DRAFTING_STEP_FAILURE =
  'Không đọc được tài liệu nguồn. Hãy thử lại hoặc tự điền bước này.';

const CONFIRM_BODIES = {
  1: ConfirmBasicsCommandSchema,
  2: ConfirmOutlineCommandSchema,
  3: ConfirmRulesCommandSchema,
  4: ConfirmAudienceCommandSchema,
} as const;

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

export class DraftingSessionMock {
  /** How many looks at a session still show a step `proposing` before its proposal is ready. */
  pollsBeforeProposal = 2;

  private nextId = 1;
  private nextDocument = 40;
  private nextCode = 1;
  private sessions: MockSession[] = [];
  private readonly failing = new Set<DraftingStepNumber>();
  private readonly takenCodes = new Set<string>();

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
  ): FakeReply | undefined {
    if (!this.answers(endpoint)) return undefined;
    if (endpoint === draftingSessionEndpoints.start)
      return this.start(request, owner);
    if (endpoint === draftingSessionEndpoints.uploadSource) {
      const file = formValue(request.body, 'file');
      if (!(file instanceof Blob)) return refusal('validationFailed');
      return ok({
        documentId: this.nextDocument++,
        fileName: (file as File).name || 'tai-lieu.pdf',
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
      return this.confirm(entry, step, request.body);
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
        conversationId:
          conversation == null || conversation === ''
            ? null
            : Number(conversation),
        source: {
          documentId: this.nextDocument++,
          fileName: (file as File).name || 'tai-lieu.pdf',
          status: 'ready',
        },
        error: null,
        steps: [draftingStepFixture(1, 'proposing')],
        createTime: time,
        updateTime: time,
      },
    };
    this.sessions.unshift(entry);
    return ok(this.view(entry));
  }

  private confirm(
    entry: MockSession,
    step: DraftingStepNumber,
    body: unknown,
  ): FakeReply {
    const session = entry.session;
    const current = this.stepOf(entry, step);
    // Confirming step 1 again (a retried request) returns the course it already made.
    if (step === 1 && current?.state === 'confirmed' && session.courseId) {
      return ok(this.view(entry));
    }
    if (
      step !== session.currentStep ||
      !current ||
      !['proposed', 'failed', 'manual'].includes(current.state)
    ) {
      return invalidState();
    }
    const parsed = CONFIRM_BODIES[step].safeParse(body);
    if (!parsed.success) return refusal('validationFailed');
    if (step === 1) {
      const code = (parsed.data as { course: { code: string } }).course.code;
      if (this.takenCodes.has(code)) {
        entry.code = this.freshCode();
        if (current.step === 1 && current.proposal) {
          this.replace(entry, {
            ...current,
            proposal: { ...current.proposal, code: entry.code },
          });
        }
        return takenCode();
      }
      session.courseId = 500 + session.id;
      session.revisionId = 600 + session.id;
    }
    const confirmed: DraftingStep =
      current.step === 2
        ? {
            ...current,
            lessonNotes: (current.proposal?.chapters ?? [])
              .flatMap((chapter) => chapter.lessons)
              .map((lesson, index) => ({
                lessonId: 900 + index,
                description: lesson.description,
                sourceSection: lesson.sourceSection,
              })),
          }
        : current;
    this.replace(entry, { ...confirmed, state: 'confirmed', error: null });
    if (session.status === 'failed') {
      session.status = 'active';
      session.error = null;
    }
    if (step === 4) {
      session.status = 'finished';
    } else {
      const next = (step + 1) as DraftingStepNumber;
      session.currentStep = next;
      entry.polls.set(next, 0);
      session.steps = [
        ...session.steps,
        draftingStepFixture(
          next,
          session.status === 'manual' ? 'manual' : 'proposing',
        ),
      ];
    }
    return ok(this.view(entry));
  }

  private proposeAgain(
    entry: MockSession,
    step: DraftingStepNumber,
  ): FakeReply {
    const current = this.stepOf(entry, step);
    if (
      !current ||
      !['proposed', 'confirmed', 'failed'].includes(current.state)
    )
      return invalidState();
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

  /** Mock proposals appear whole, so a stopped step has nothing yet and becomes `manual`. */
  private stop(entry: MockSession): FakeReply {
    for (const step of entry.session.steps) {
      if (step.state === 'proposing')
        this.replace(entry, { ...step, state: 'manual' });
    }
    return ok(this.view(entry));
  }

  private manual(entry: MockSession, step: DraftingStepNumber): FakeReply {
    const current = this.stepOf(entry, step);
    if (
      step !== entry.session.currentStep ||
      !current ||
      current.state === 'confirmed'
    ) {
      return invalidState();
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
        continue;
      }
      this.replace(entry, this.proposed(entry, step.step));
    }
  }

  private proposed(entry: MockSession, step: DraftingStepNumber): DraftingStep {
    const ready = draftingStepFixture(step, 'proposed');
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
