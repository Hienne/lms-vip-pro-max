import {
  assessmentV1Endpoints,
  authV1Endpoints,
  courseEndpoints,
  draftingSessionEndpoints,
  DraftingSessionSchema,
  type AnyEndpoint,
  type DraftingSession,
} from '@lms/contracts';
import {
  FakeBackend,
  type FakeReply,
  type FakeRequest,
} from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';
import {
  audienceProposalFixture,
  basicsProposalFixture,
  draftingSessionFixture,
  outlineProposalFixture,
  rulesProposalFixture,
} from './drafting-session.fixtures';
import { DraftingSessionMock } from './drafting-session.mock';

const request = (
  body: unknown = null,
  params: Record<string, string> = {},
): FakeRequest => ({ token: null, body, params, query: {} }) as FakeRequest;

const form = (fields?: Record<string, unknown>) => {
  const data = new FormData();
  data.set('file', new File(['x'], 'quy-trinh.pdf'));
  if (fields) data.set('fields', JSON.stringify(fields));
  return data;
};

const code = (reply: FakeReply | undefined) => reply?.body.messageCode;

/** Every success is parsed by the endpoint's own response schema. */
const parsed = (endpoint: AnyEndpoint, reply: FakeReply | undefined) => {
  expect(reply?.body.status, JSON.stringify(reply?.body)).toBe('SUCCESS');
  return endpoint.response.parse(reply?.body.data);
};

const draft = {
  expectedVersion: 1,
  defaultRequirement: 'mandatory',
  objectives: [],
  chapters: [],
};

const confirmBody = (session: DraftingSession, step: number): unknown => {
  if (step === 1) {
    const basics = (session.steps[0].proposal ?? basicsProposalFixture) as {
      code: string;
      title: string;
    };
    return {
      course: { ownerOrgId: 1, code: basics.code, title: basics.title },
    };
  }
  if (step === 2) return { draft };
  if (step === 3)
    return {
      draft: { ...draft, programId: 1 },
      competencyId: 4,
      questions: rulesProposalFixture.questions,
    };
  return {};
};

describe('DraftingSessionMock', () => {
  let mock: DraftingSessionMock;
  beforeEach(() => (mock = new DraftingSessionMock()));

  const call = (
    endpoint: AnyEndpoint,
    body: unknown = null,
    params = {},
    owner = 'a',
  ) => mock.handle(endpoint, request(body, params), owner);

  const start = (fields?: Record<string, unknown>): DraftingSession =>
    parsed(
      draftingSessionEndpoints.start,
      call(draftingSessionEndpoints.start, form(fields)),
    ) as DraftingSession;

  const get = (id: number, owner = 'a'): DraftingSession =>
    parsed(
      draftingSessionEndpoints.get,
      call(
        draftingSessionEndpoints.get,
        null,
        { sessionId: String(id) },
        owner,
      ),
    ) as DraftingSession;

  const stepOf = (session: DraftingSession, step: number) =>
    session.steps.find((item) => item.step === step);

  /** Polls until the current step is no longer proposing. */
  const ready = (id: number): DraftingSession => {
    let session = get(id);
    for (
      let i = 0;
      i < 10 && stepOf(session, session.currentStep)?.state === 'proposing';
      i++
    ) {
      session = get(id);
    }
    return session;
  };

  const confirm = (session: DraftingSession, step = session.currentStep) =>
    call(draftingSessionEndpoints.confirm, confirmBody(session, step), {
      sessionId: String(session.id),
      step: String(step),
    });

  it('answers only the drafting endpoints', () => {
    for (const endpoint of Object.values(draftingSessionEndpoints)) {
      expect(mock.answers(endpoint)).toBe(true);
    }
    expect(mock.answers(authV1Endpoints.login)).toBe(false);
  });

  it('starts at step 1 proposing and is ready after the configured polls', () => {
    mock.pollsBeforeProposal = 2;
    const session = start({ title: 'Đối soát cuối ngày' });
    expect(session.currentStep).toBe(1);
    expect(stepOf(session, 1)).toMatchObject({
      state: 'proposing',
      proposal: null,
    });
    expect(session.source?.fileName).toBe('quy-trinh.pdf');

    expect(stepOf(get(session.id), 1)?.state).toBe('proposing');
    expect(stepOf(get(session.id), 1)?.state).toBe('proposing');
    const third = stepOf(get(session.id), 1);
    expect(third?.state).toBe('proposed');
    expect(third?.proposal).toMatchObject({ title: 'Đối soát cuối ngày' });
  });

  it('is ready on the first poll when no polls are asked for', () => {
    mock.pollsBeforeProposal = 0;
    const session = start();
    expect(stepOf(get(session.id), 1)?.state).toBe('proposed');
  });

  it('walks a session through all four steps', () => {
    let session = ready(start().id);
    expect(stepOf(session, 1)?.proposal).toEqual(basicsProposalFixture);

    session = parsed(
      draftingSessionEndpoints.confirm,
      confirm(session),
    ) as DraftingSession;
    expect(session.courseId).not.toBeNull();
    expect(session.currentStep).toBe(2);
    expect(stepOf(session, 1)?.state).toBe('confirmed');
    expect(stepOf(session, 2)?.state).toBe('proposing');

    session = ready(session.id);
    expect(stepOf(session, 2)?.proposal).toEqual(outlineProposalFixture);
    session = parsed(
      draftingSessionEndpoints.confirm,
      confirm(session),
    ) as DraftingSession;
    const outline = stepOf(session, 2);
    expect(outline?.step === 2 && outline.lessonNotes?.length).toBe(
      outlineProposalFixture.chapters.flatMap((chapter) => chapter.lessons)
        .length,
    );

    session = ready(session.id);
    expect(stepOf(session, 3)?.proposal).toEqual(rulesProposalFixture);
    session = parsed(
      draftingSessionEndpoints.confirm,
      confirm(session),
    ) as DraftingSession;

    session = ready(session.id);
    expect(stepOf(session, 4)?.proposal).toEqual(audienceProposalFixture);
    session = parsed(
      draftingSessionEndpoints.confirm,
      confirm(session),
    ) as DraftingSession;
    expect(session.status).toBe('finished');
    expect(session.steps.map((item) => item.state)).toEqual([
      'confirmed',
      'confirmed',
      'confirmed',
      'confirmed',
    ]);

    const latest = parsed(
      draftingSessionEndpoints.forCourse,
      call(draftingSessionEndpoints.forCourse, null, {
        courseId: String(session.courseId),
      }),
    );
    expect((latest as DraftingSession).id).toBe(session.id);
  });

  it('confirms step 1 once: a second confirm returns the same course', () => {
    const session = ready(start().id);
    const first = parsed(
      draftingSessionEndpoints.confirm,
      confirm(session, 1),
    ) as DraftingSession;
    const again = parsed(
      draftingSessionEndpoints.confirm,
      confirm(session, 1),
    ) as DraftingSession;
    expect(again.courseId).toBe(first.courseId);
    expect(again.steps).toHaveLength(2);
  });

  it('refuses to confirm a step that is still proposing or not current', () => {
    const session = start();
    const early = confirm(session, 1);
    expect(code(early)).toBe('CORE-VALIDATION_FAILED');
    expect(early?.body.message).toBe('Bước này chưa sẵn sàng để chốt.');
    expect(early?.body.errors).toEqual([
      {
        field: 'step',
        code: 'INVALID_STATE',
        message: 'Bước này chưa sẵn sàng để chốt.',
      },
    ]);
    expect(code(confirm(ready(session.id), 2))).toBe('CORE-VALIDATION_FAILED');
  });

  it('refuses a step 2 confirm whose proposed lesson carries content', () => {
    let session = ready(start().id);
    session = parsed(
      draftingSessionEndpoints.confirm,
      confirm(session),
    ) as DraftingSession;
    session = ready(session.id);
    const lesson = outlineProposalFixture.chapters[0].lessons[0];

    const refused = call(
      draftingSessionEndpoints.confirm,
      {
        draft: {
          ...draft,
          chapters: [
            {
              title: 'Chương 1',
              lessons: [
                {
                  title: lesson.title,
                  lessonType: 'content',
                  estimatedDurationSeconds: 600,
                  isRequired: true,
                  blocks: [
                    {
                      blockType: 'text',
                      title: 'Văn bản',
                      body: 'Nội dung',
                      completionMode: 'manual',
                      isRequired: true,
                      assets: [],
                      steps: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      { sessionId: String(session.id), step: '2' },
    );

    expect(code(refused)).toBe('CORE-VALIDATION_FAILED');
    expect(refused?.body.errors?.[0]?.code).toBe('CONTENT_NOT_EMPTY');
    expect(stepOf(get(session.id), 2)?.state).toBe('proposed');
  });

  it('refuses kept questions without a competency or a programme, and keeps the step', () => {
    let session = ready(start().id);
    for (const step of [1, 2]) {
      parsed(draftingSessionEndpoints.confirm, confirm(session, step));
      session = ready(session.id);
    }
    const at = (body: unknown) =>
      call(draftingSessionEndpoints.confirm, body, {
        sessionId: String(session.id),
        step: '3',
      });
    const questions = rulesProposalFixture.questions;

    const noCompetency = at({ draft, competencyId: null, questions });
    expect(code(noCompetency)).toBe('CORE-VALIDATION_FAILED');
    expect(noCompetency?.body.errors?.[0]?.field).toBe('competencyId');
    const noProgramme = at({ draft, competencyId: 4, questions });
    expect(noProgramme?.body.errors?.[0]?.field).toBe('draft.programId');
    expect(get(session.id).currentStep).toBe(3);

    // with every question removed, only the rules are saved
    const kept = parsed(
      draftingSessionEndpoints.confirm,
      at({ draft, competencyId: null, questions: [] }),
    ) as DraftingSession;
    expect(kept.currentStep).toBe(4);
  });

  it('refuses a confirm body that does not fit the step', () => {
    const session = ready(start().id);
    const reply = call(
      draftingSessionEndpoints.confirm,
      { draft },
      {
        sessionId: String(session.id),
        step: '1',
      },
    );
    expect(code(reply)).toBe('CORE-VALIDATION_FAILED');
  });

  it('fails the step it is told to, then proposes it again', () => {
    mock.failNext(2);
    let session = ready(start().id);
    session = parsed(
      draftingSessionEndpoints.confirm,
      confirm(session),
    ) as DraftingSession;
    session = ready(session.id);
    const failed = stepOf(session, 2);
    expect(failed?.state).toBe('failed');
    expect(failed?.error).toBeTruthy();
    expect(session.status).toBe('failed');
    expect(session.error).toBe(failed?.error);

    session = parsed(
      draftingSessionEndpoints.proposeAgain,
      call(draftingSessionEndpoints.proposeAgain, null, {
        sessionId: String(session.id),
        step: '2',
      }),
    ) as DraftingSession;
    expect(session.status).toBe('active');
    expect(stepOf(session, 2)).toMatchObject({
      state: 'proposing',
      proposal: null,
      error: null,
    });
    expect(stepOf(ready(session.id), 2)?.state).toBe('proposed');
  });

  it('answers a taken code with LEARNING-DUPLICATE and proposes a new code', () => {
    const session = ready(start().id);
    const taken = (session.steps[0].proposal as { code: string }).code;
    mock.takeCodeOnConfirm(taken);

    const reply = confirm(session);
    expect(code(reply)).toBe('LEARNING-DUPLICATE');

    const next = get(session.id);
    const fresh = (next.steps[0].proposal as { code: string }).code;
    expect(fresh).not.toBe(taken);
    expect(stepOf(next, 1)?.notes.at(-1)).toBe(
      `Mã ${taken} đã có; trợ lý đề xuất mã ${fresh}.`,
    );
    expect(next.courseId).toBeNull();
    expect(stepOf(next, 1)?.state).toBe('proposed');
    expect(
      parsed(draftingSessionEndpoints.confirm, confirm(next)),
    ).toMatchObject({ currentStep: 2 });
  });

  it('stops a proposing step into manual, and switches a step to manual', () => {
    const session = start();
    const stopped = parsed(
      draftingSessionEndpoints.stop,
      call(draftingSessionEndpoints.stop, null, {
        sessionId: String(session.id),
      }),
    ) as DraftingSession;
    expect(stepOf(stopped, 1)?.state).toBe('manual');
    expect(stepOf(get(session.id), 1)?.state).toBe('manual');

    const other = ready(start().id);
    const manual = parsed(
      draftingSessionEndpoints.manual,
      call(draftingSessionEndpoints.manual, null, {
        sessionId: String(other.id),
        step: '1',
      }),
    ) as DraftingSession;
    expect(manual.status).toBe('manual');
    expect(stepOf(manual, 1)?.state).toBe('manual');
    // The assistant's part is over: nothing is confirmed or proposed again through the session.
    expect(code(confirm(manual, 1))).toBe('CORE-VALIDATION_FAILED');
    expect(
      code(
        call(draftingSessionEndpoints.proposeAgain, null, {
          sessionId: String(other.id),
          step: '1',
        }),
      ),
    ).toBe('CORE-VALIDATION_FAILED');
    expect(get(other.id).steps).toHaveLength(1);
  });

  it('fills a failed step by hand: the session ends as manual', () => {
    mock.failNext(1);
    const failed = ready(start().id);
    expect(failed.status).toBe('failed');

    const manual = parsed(
      draftingSessionEndpoints.manual,
      call(draftingSessionEndpoints.manual, null, {
        sessionId: String(failed.id),
        step: '1',
      }),
    ) as DraftingSession;

    expect(manual).toMatchObject({ status: 'manual', error: null });
    expect(stepOf(manual, 1)).toMatchObject({ state: 'manual', error: null });
  });

  it('keeps a session private to its owner', () => {
    const session = start();
    const reply = call(
      draftingSessionEndpoints.get,
      null,
      { sessionId: String(session.id) },
      'b',
    );
    expect(code(reply)).toBe('CORE-RESOURCE_NOT_FOUND');
    expect(
      parsed(
        draftingSessionEndpoints.forCourse,
        call(draftingSessionEndpoints.forCourse, null, { courseId: '999' }),
      ),
    ).toBeNull();
  });

  it('refuses a start without a file and uploads a chat source', () => {
    expect(code(call(draftingSessionEndpoints.start, new FormData()))).toBe(
      'CORE-VALIDATION_FAILED',
    );
    const data = new FormData();
    data.set('file', new File(['x'], 'tai-lieu.docx'));
    expect(
      parsed(
        draftingSessionEndpoints.uploadSource,
        call(draftingSessionEndpoints.uploadSource, data),
      ),
    ).toMatchObject({
      fileName: 'tai-lieu.docx',
    });
  });
});

describe('drafting fixtures', () => {
  it.each([1, 2, 3, 4] as const)(
    'a session at step %i parses and has its proposal',
    (step) => {
      const session = DraftingSessionSchema.parse(draftingSessionFixture(step));
      expect(session.currentStep).toBe(step);
      expect(session.steps).toHaveLength(step);
      expect(session.steps.at(-1)).toMatchObject({ step, state: 'proposed' });
      expect(session.steps.at(-1)?.proposal).not.toBeNull();
    },
  );
});

describe('FakeBackend drafting sessions', () => {
  const backend = new FakeBackend();
  const login = (username: string): string =>
    (
      backend.handle(authV1Endpoints.login, {
        token: null,
        params: {},
        query: {},
        body: { username, password: SEED_PASSWORD },
      })?.body.data as { accessToken: string }
    ).accessToken;
  const startAs = (token: string | null) =>
    backend.handle(draftingSessionEndpoints.start, {
      token,
      params: {},
      query: {},
      body: form(),
    });

  it('answers the drafting endpoints', () => {
    for (const endpoint of Object.values(draftingSessionEndpoints)) {
      expect(backend.answers(endpoint)).toBe(true);
    }
  });

  it('lets an instructor start a session and refuses a learner', () => {
    expect(startAs(login('giangvien'))?.body.status).toBe('SUCCESS');
    const refused = startAs(login('hocvien'));
    expect(refused?.status).toBe(403);
    expect(code(refused)).toBe('CORE-ACCESS_DENIED');
  });

  it('makes the draft course of a confirmed step 1 through the course create, once', () => {
    const token = login('giangvien');
    const at = (
      endpoint: AnyEndpoint,
      body: unknown,
      params: Record<string, string>,
    ) => backend.handle(endpoint, { token, params, query: {}, body });
    const proposed = (id: number): DraftingSession => {
      let session = parsed(
        draftingSessionEndpoints.get,
        at(draftingSessionEndpoints.get, null, { sessionId: String(id) }),
      ) as DraftingSession;
      for (let i = 0; i < 10 && session.steps[0].state === 'proposing'; i++) {
        session = parsed(
          draftingSessionEndpoints.get,
          at(draftingSessionEndpoints.get, null, { sessionId: String(id) }),
        ) as DraftingSession;
      }
      return session;
    };
    const confirmAt = (session: DraftingSession, body: unknown) =>
      at(draftingSessionEndpoints.confirm, body, {
        sessionId: String(session.id),
        step: '1',
      });

    const first = proposed(
      (
        parsed(
          draftingSessionEndpoints.start,
          startAs(token),
        ) as DraftingSession
      ).id,
    );
    const body = confirmBody(first, 1) as { course: { code: string } };
    const confirmed = parsed(
      draftingSessionEndpoints.confirm,
      confirmAt(first, body),
    ) as DraftingSession;
    const course = parsed(
      courseEndpoints.getCourse,
      at(courseEndpoints.getCourse, null, {
        courseId: String(confirmed.courseId),
      }),
    ) as { course: { code: string } };
    expect(course.course.code).toBe(body.course.code);
    expect(
      (
        parsed(
          draftingSessionEndpoints.confirm,
          confirmAt(first, body),
        ) as DraftingSession
      ).courseId,
    ).toBe(confirmed.courseId);

    // Another session confirming the code that course now has is refused like the server does.
    const second = proposed(
      (
        parsed(
          draftingSessionEndpoints.start,
          startAs(token),
        ) as DraftingSession
      ).id,
    );
    const refused = confirmAt(second, body);
    expect(code(refused)).toBe('LEARNING-DUPLICATE');
    expect(refused?.body.errors?.[0]?.field).toBe('course.code');
    expect(proposed(second.id).courseId).toBeNull();
  });

  it('saves a confirmed outline with empty lessons and marks the revision AI made', () => {
    const token = login('giangvien');
    const at = (
      endpoint: AnyEndpoint,
      body: unknown,
      params: Record<string, string>,
    ) => backend.handle(endpoint, { token, params, query: {}, body });
    const ready = (id: number): DraftingSession => {
      let session: DraftingSession;
      let i = 0;
      do {
        session = parsed(
          draftingSessionEndpoints.get,
          at(draftingSessionEndpoints.get, null, { sessionId: String(id) }),
        ) as DraftingSession;
      } while (++i < 10 && session.steps.at(-1)?.state === 'proposing');
      return session;
    };
    const confirmAt = (session: DraftingSession, step: number, body: unknown) =>
      at(draftingSessionEndpoints.confirm, body, {
        sessionId: String(session.id),
        step: String(step),
      });
    const started = parsed(
      draftingSessionEndpoints.start,
      startAs(token),
    ) as DraftingSession;
    const first = ready(started.id);
    const created = parsed(
      draftingSessionEndpoints.confirm,
      confirmAt(first, 1, {
        course: { ownerOrgId: 1, code: 'AI-OUTLINE1', title: 'Đối soát' },
      }),
    ) as DraftingSession;
    const atStepTwo = ready(created.id);
    const courseParams = { courseId: String(created.courseId) };
    const before = parsed(
      courseEndpoints.getCourse,
      at(courseEndpoints.getCourse, null, courseParams),
    ) as { revision: { rowVersion: number } };

    const confirmed = parsed(
      draftingSessionEndpoints.confirm,
      confirmAt(atStepTwo, 2, {
        draft: {
          ...draft,
          expectedVersion: before.revision.rowVersion,
          chapters: outlineProposalFixture.chapters.map((chapter) => ({
            title: chapter.title,
            lessons: chapter.lessons.map((lesson) => ({
              title: lesson.title,
              lessonType: 'content',
              estimatedDurationSeconds: 600,
              isRequired: true,
              blocks: [],
            })),
          })),
        },
      }),
    ) as DraftingSession;

    const course = parsed(
      courseEndpoints.getCourse,
      at(courseEndpoints.getCourse, null, courseParams),
    ) as {
      revision: { aiGenerated?: boolean };
      chapters: { lessons: { lesson: { id: number }; blocks: unknown[] }[] }[];
    };
    const lessons = course.chapters.flatMap((chapter) => chapter.lessons);
    expect(lessons).toHaveLength(4);
    expect(lessons.every((lesson) => lesson.blocks.length === 0)).toBe(true);
    expect(course.revision.aiGenerated).toBe(true);
    expect(confirmed.currentStep).toBe(3);
    const outline = confirmed.steps.find((step) => step.step === 2);
    expect(
      outline?.step === 2 && outline.lessonNotes?.map((note) => note.lessonId),
    ).toEqual(lessons.map((lesson) => lesson.lesson.id));
  });

  it('creates a final exam of the kept questions only when step 3 is confirmed', () => {
    const token = login('giangvien');
    const at = (
      endpoint: AnyEndpoint,
      body: unknown,
      params: Record<string, string>,
      query: Record<string, string> = {},
    ) => backend.handle(endpoint, { token, params, query, body });
    const ready = (id: number): DraftingSession => {
      let session: DraftingSession;
      let i = 0;
      do {
        session = parsed(
          draftingSessionEndpoints.get,
          at(draftingSessionEndpoints.get, null, { sessionId: String(id) }),
        ) as DraftingSession;
      } while (++i < 10 && session.steps.at(-1)?.state === 'proposing');
      return session;
    };
    const confirmAt = (session: DraftingSession, step: number, body: unknown) =>
      at(draftingSessionEndpoints.confirm, body, {
        sessionId: String(session.id),
        step: String(step),
      });
    const course = (courseId: number | null) =>
      parsed(
        courseEndpoints.getCourse,
        at(courseEndpoints.getCourse, null, { courseId: String(courseId) }),
      ) as {
        revision: {
          rowVersion: number;
          programId: number | null;
          aiGenerated?: boolean;
        };
        finalQuizId?: number | null;
        completionRule?: { rewardPoints: number } | null;
      };
    const bank = (courseId: number | null) =>
      (
        parsed(
          assessmentV1Endpoints.questions,
          at(
            assessmentV1Endpoints.questions,
            null,
            {},
            {
              courseId: String(courseId),
            },
          ),
        ) as { items: { contentPreview: string }[] }
      ).items.map((item) => item.contentPreview);

    const started = parsed(
      draftingSessionEndpoints.start,
      startAs(token),
    ) as DraftingSession;
    let session = parsed(
      draftingSessionEndpoints.confirm,
      confirmAt(ready(started.id), 1, {
        course: { ownerOrgId: 1, code: 'AI-RULES01', title: 'Đối soát' },
      }),
    ) as DraftingSession;
    session = ready(session.id);
    session = parsed(
      draftingSessionEndpoints.confirm,
      confirmAt(session, 2, {
        draft: {
          ...draft,
          expectedVersion: course(session.courseId).revision.rowVersion,
        },
      }),
    ) as DraftingSession;
    session = ready(session.id);
    const before = bank(session.courseId);
    expect(before).toEqual([]);

    const [kept] = rulesProposalFixture.questions;
    const confirmed = parsed(
      draftingSessionEndpoints.confirm,
      confirmAt(session, 3, {
        draft: {
          ...draft,
          programId: 1,
          rewardPoints: 25,
          expectedVersion: course(session.courseId).revision.rowVersion,
        },
        competencyId: 1,
        questions: [kept],
      }),
    ) as DraftingSession;

    expect(confirmed.currentStep).toBe(4);
    expect(bank(session.courseId)).toEqual([kept.content]);
    const detail = course(session.courseId);
    expect(detail.finalQuizId).toEqual(expect.any(Number));
    expect(detail.revision.aiGenerated).toBe(true);
  });

  it('refuses a token it did not issue, like every endpoint the backend serves', () => {
    expect(startAs('real-backend-token')?.status).toBe(401);
  });
});
