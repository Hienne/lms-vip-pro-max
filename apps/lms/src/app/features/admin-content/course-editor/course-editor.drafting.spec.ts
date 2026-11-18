import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  assessmentV1Endpoints,
  courseEndpoints,
  draftingSessionEndpoints,
  type ConfirmBasicsCommand,
  type ConfirmOutlineCommand,
  type ConfirmRulesCommand,
  type CourseDetail,
  type DraftingSession,
  type DraftingStep,
} from '@lms/contracts';
import {
  audienceProposalFixture,
  backendRefusal,
  basicsProposalFixture,
  draftingSessionFixture,
  draftingStepFixture,
  envelopeError,
  envelopeOk,
  outlineProposalFixture,
  publishBlockersOf,
  rulesProposalFixture,
  type FakeReply,
} from '@lms/mocks';
import { of } from 'rxjs';
import {
  CourseDraftingStore,
  DRAFTING_POLL_INTERVAL_MS,
} from '../../../core/course-drafting/course-drafting.store';
import { setUpAdminScreen } from '../../../core/dev/mock-api/admin-screen.testing';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import { ReplyGate } from '../../../core/dev/mock-api/mock-backend.testing';
import { LeavePrompt } from '../../../core/routing/unsaved-changes.guard';
import type { CourseEditor } from './course-editor';
import { draftChecks, toDraftValue } from './course-draft';
import { FakeHasher } from './data-access/fake-hasher.testing';
import { DRAFTING_FIELD_DELAY_MS } from './data-access/drafting-fill';
import { Sha256Hasher } from './data-access/sha256-hasher';

const ok = (data: unknown): FakeReply => ({
  status: 200,
  body: envelopeOk(data),
});

/** Session 1 with step 1 still being worked on by the server. */
const proposing = (): DraftingSession => ({
  ...draftingSessionFixture(1),
  steps: [draftingStepFixture(1, 'proposing')],
});

/**
 * The writes of the fixture's proposal: title, programme, code, level, kind and summary (its module
 * is empty, so not written), then one per objective.
 */
const PATCHES = 6 + basicsProposalFixture.objectives.length;

describe('CourseEditor following a drafting session', () => {
  const screen = setUpAdminScreen([
    { provide: Sha256Hasher, useValue: new FakeHasher() },
  ]);

  let session: DraftingSession;

  const original = (endpoint: unknown, request: unknown): FakeReply =>
    MockBackend.prototype.handle.call(
      TestBed.inject(MockBackend),
      endpoint as never,
      request as never,
    ) as FakeReply;

  beforeEach(() => {
    session = proposing();
    screen.calls.mockImplementation((endpoint, request) => {
      if (endpoint === draftingSessionEndpoints.get) return ok(session);
      if (endpoint === draftingSessionEndpoints.stop) {
        session = {
          ...session,
          steps: session.steps.map((step) =>
            step.state === 'proposing' ? { ...step, state: 'manual' } : step,
          ),
        };
        return ok(session);
      }
      return original(endpoint, request);
    });
  });

  afterEach(() => vi.useRealTimers());

  const advance = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
  };

  /**
   * Opens the page, then reads the session under fake timers: the harness waits on real ones, so
   * the session's reply is held until the page is open and the poll and the writes run on the fake
   * clock.
   */
  async function open(url = '/admin/courses/new?session=1') {
    const reply = TestBed.inject(ReplyGate).hold(draftingSessionEndpoints.get);
    await screen.open(url);
    vi.useFakeTimers();
    reply.release();
    await advance(0);
  }

  const tap = async (target: HTMLElement | undefined) => {
    if (!target) throw new Error('Nothing to click');
    target.click();
    await advance(0);
  };

  /** The server finishes the proposal; the page sees it at its next look. */
  const propose = async () => {
    session = draftingSessionFixture(1);
    await advance(DRAFTING_POLL_INTERVAL_MS);
  };

  const fieldset = () =>
    screen.el.querySelector<HTMLFieldSetElement>(
      'fieldset.course-editor__body',
    )!;
  const box = (label: string) =>
    Array.from(screen.el.querySelectorAll<HTMLElement>('ui-field')).find((f) =>
      f.querySelector('label')?.textContent?.includes(label),
    )!;
  const objectives = () =>
    screen.el.querySelectorAll<HTMLInputElement>(
      'input[aria-label^="Mục tiêu"]',
    );
  const marked = () =>
    Array.from(screen.el.querySelectorAll('.course-info__suggested')).length;

  it('reads the session in the URL and locks step 1 while the assistant works', async () => {
    await open();

    expect(screen.callsTo(draftingSessionEndpoints.get)).toBe(1);
    expect(screen.lastCall(draftingSessionEndpoints.get)).toMatchObject({
      params: { sessionId: '1' },
    });
    expect(screen.text()).toContain('Trợ lý đang soạn…');
    expect(screen.button('Dừng')).toBeDefined();
    expect(fieldset().disabled).toBe(true);
    expect((screen.button('Lưu nháp') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.field('Tên khóa học').value).toBe('');
  });

  it('asks again while step 1 is proposing', async () => {
    await open();
    await advance(DRAFTING_POLL_INTERVAL_MS);

    expect(screen.callsTo(draftingSessionEndpoints.get)).toBe(2);
  });

  it('writes the proposal one field at a time, the objectives one by one, then unlocks the step', async () => {
    await open();
    await propose();

    expect(screen.field('Tên khóa học').value).toBe(
      basicsProposalFixture.title,
    );
    expect(screen.field('Mã khóa học').value).toBe('');
    expect(fieldset().disabled).toBe(true);

    await advance(DRAFTING_FIELD_DELAY_MS);
    expect(screen.field('Chương trình').value).toBe('1');
    expect(screen.field('Mã khóa học').value).toBe('');

    await advance(DRAFTING_FIELD_DELAY_MS * (PATCHES - 3));
    expect(objectives()).toHaveLength(1);
    expect(objectives()[0].value).toBe(basicsProposalFixture.objectives[0]);
    expect(fieldset().disabled).toBe(true);
    expect(screen.text()).toContain('Trợ lý đang soạn…');

    await advance(DRAFTING_FIELD_DELAY_MS);
    expect(objectives()).toHaveLength(2);
    expect(screen.field('Mã khóa học').value).toBe(basicsProposalFixture.code);
    expect(screen.field('Mô tả ngắn').value).toBe(
      basicsProposalFixture.summary,
    );
    expect(fieldset().disabled).toBe(false);
    expect(screen.text()).not.toContain('Trợ lý đang soạn…');
  });

  it('marks what the assistant wrote "AI đề xuất" until the author edits it', async () => {
    await open();
    await propose();
    await advance(DRAFTING_FIELD_DELAY_MS * PATCHES);

    expect(box('Tên khóa học').textContent).toContain('AI đề xuất');
    expect(box('Mã khóa học').textContent).toContain('AI đề xuất');
    const before = marked();

    const title = screen.field('Tên khóa học') as HTMLInputElement;
    title.value = 'Tên do tác giả đặt';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    await advance(0);

    expect(box('Tên khóa học').textContent).not.toContain('AI đề xuất');
    expect(box('Mã khóa học').textContent).toContain('AI đề xuất');
    expect(marked()).toBe(before - 1);
  });

  it('leaves an empty module empty, with a hint and no marker', async () => {
    await open();
    await propose();
    await advance(DRAFTING_FIELD_DELAY_MS * PATCHES);

    expect(screen.field('Phân hệ nghiệp vụ').value).toBe('');
    expect(box('Phân hệ nghiệp vụ').textContent).toContain(
      'Trợ lý chưa chọn được phân hệ',
    );
    expect(box('Phân hệ nghiệp vụ').textContent).not.toContain('AI đề xuất');
  });

  it('"Dừng" while the server works stops it, and nothing is written afterwards', async () => {
    await open();

    await tap(screen.button('Dừng'));
    expect(screen.callsTo(draftingSessionEndpoints.stop)).toBe(1);
    expect(fieldset().disabled).toBe(false);
    expect(screen.text()).not.toContain('Trợ lý đang soạn…');

    await propose();
    await advance(DRAFTING_FIELD_DELAY_MS * PATCHES);
    expect(screen.field('Tên khóa học').value).toBe('');
  });

  it('"Dừng" while the fields are written keeps what is there and writes nothing more', async () => {
    await open();
    await propose();
    await advance(DRAFTING_FIELD_DELAY_MS);

    await tap(screen.button('Dừng'));
    await advance(DRAFTING_FIELD_DELAY_MS * PATCHES);

    expect(screen.callsTo(draftingSessionEndpoints.stop)).toBe(0);
    expect(screen.field('Tên khóa học').value).toBe(
      basicsProposalFixture.title,
    );
    expect(screen.field('Mã khóa học').value).toBe('');
    expect(fieldset().disabled).toBe(false);
  });

  it('warns about unsaved changes when leaving before step 1 is confirmed', async () => {
    await open();
    await propose();
    await advance(DRAFTING_FIELD_DELAY_MS * PATCHES);

    expect(screen.page<CourseEditor>().hasUnsavedChanges()).toBe(true);
    const ask = vi.fn((_message?: string) => of(false));
    TestBed.inject(LeavePrompt).use(ask);
    const leaving = TestBed.inject(Router).navigateByUrl('/admin/courses');
    await advance(10);

    expect(ask).toHaveBeenCalledTimes(1);
    expect(await leaving).toBe(false);
  });

  it('follows no session on a new course opened without one', async () => {
    await open('/admin/courses/new');

    expect(screen.callsTo(draftingSessionEndpoints.get)).toBe(0);
    expect(screen.text()).not.toContain('Trợ lý đang soạn…');
    expect(fieldset().disabled).toBe(false);
  });
});

describe('CourseEditor confirming a drafting step', () => {
  const screen = setUpAdminScreen([
    { provide: Sha256Hasher, useValue: new FakeHasher() },
  ]);

  const TAKEN = 'AI-TAKEN001';
  const FRESH = 'AI-FRESH001';
  /** A code the stub refuses as a course for another unit than the session's. */
  const OTHER_UNIT = 'AI-OTHER001';
  const OWNER_LINE =
    'Khóa học được tạo cho đơn vị đã chọn khi bắt đầu soạn; không đổi đơn vị ở bước này.';
  /** The author filled step 1 by hand: a taken code then brings a proposal of the code only. */
  let handFilled = false;

  let session: DraftingSession;

  const original = (endpoint: unknown, request: unknown): FakeReply =>
    MockBackend.prototype.handle.call(
      TestBed.inject(MockBackend),
      endpoint as never,
      request as never,
    ) as FakeReply;

  /** Step 1 confirmed: the course exists and step 2 is being proposed, as the server leaves it. */
  const atStepTwo = (
    courseId: number,
    revisionId: number,
  ): DraftingSession => ({
    ...session,
    courseId,
    revisionId,
    currentStep: 2,
    steps: [
      { ...session.steps[0], state: 'confirmed' } as DraftingStep,
      draftingStepFixture(2, 'proposing'),
    ],
  });

  beforeEach(() => {
    handFilled = false;
    session = {
      ...draftingSessionFixture(1),
      steps: [draftingStepFixture(1, 'proposing')],
    };
    // The server's confirm: a taken code is refused and step 1 proposes another; otherwise the
    // draft course is made through the course create.
    screen.calls.mockImplementation((endpoint, request) => {
      if (endpoint === draftingSessionEndpoints.get) return ok(session);
      if (endpoint === draftingSessionEndpoints.forCourse) {
        const courseId = Number(
          (request as { params: Record<string, string> }).params['courseId'],
        );
        return ok(session.courseId === courseId ? session : null);
      }
      if (
        endpoint === draftingSessionEndpoints.confirm &&
        (request as { params: Record<string, string> }).params['step'] === '2'
      ) {
        return confirmOutline(request);
      }
      if (
        endpoint === draftingSessionEndpoints.confirm &&
        (request as { params: Record<string, string> }).params['step'] === '3'
      ) {
        return confirmRules(request);
      }
      if (endpoint === draftingSessionEndpoints.confirm) {
        const { course } = (request as { body: ConfirmBasicsCommand }).body;
        if (session.courseId !== null) return ok(session);
        if (course.code === OTHER_UNIT)
          return {
            status: 200,
            body: envelopeError(
              'CORE-VALIDATION_FAILED',
              'Dữ liệu không hợp lệ',
              'Dữ liệu gửi lên không hợp lệ.',
              [
                {
                  field: 'course.ownerOrgId',
                  code: 'OWNER_MISMATCH',
                  message: OWNER_LINE,
                },
              ],
            ),
          };
        if (course.code === TAKEN) {
          const step = session.steps[0];
          session = {
            ...session,
            steps: [
              {
                ...step,
                ...(handFilled
                  ? { state: 'manual', proposal: { code: FRESH } }
                  : { proposal: { ...basicsProposalFixture, code: FRESH } }),
                updateTime: '2026-11-17T09:00:00+07:00',
              } as DraftingStep,
            ],
          };
          return backendRefusal('learningDuplicate');
        }
        const created = original(courseEndpoints.createCourse, {
          ...(request as object),
          body: course,
          params: {},
          query: {},
        });
        const detail = (
          created.body as {
            data: { course: { id: number }; revision: { id: number } };
          }
        ).data;
        session = atStepTwo(detail.course.id, detail.revision.id);
        return ok(session);
      }
      return original(endpoint, request);
    });
  });

  /**
   * The server's step 2 confirm: the draft is saved through the course's own save, the step is
   * confirmed and step 3 is queued.
   */
  const confirmOutline = (request: unknown): FakeReply => {
    const { draft } = (request as { body: ConfirmOutlineCommand }).body;
    const saved = original(courseEndpoints.saveDraft, {
      ...(request as object),
      body: draft,
      params: {
        courseId: String(session.courseId),
        revisionId: String(session.revisionId),
      },
      query: {},
    });
    if (saved.body.status !== 'SUCCESS') return saved;
    // The server keeps each proposed lesson's line by the id it saved it under.
    const detail = (saved.body as { data: CourseDetail }).data;
    const proposed = outlineProposalFixture.chapters.flatMap(
      (chapter) => chapter.lessons,
    );
    const lessonNotes = detail.chapters
      .flatMap((chapter) => chapter.lessons)
      .flatMap(({ lesson }, index) =>
        proposed[index]
          ? [
              {
                lessonId: lesson.id,
                description: proposed[index].description,
                sourceSection: proposed[index].sourceSection,
              },
            ]
          : [],
      );
    session = {
      ...session,
      currentStep: 3,
      steps: [
        session.steps[0],
        {
          ...session.steps[1],
          state: 'confirmed',
          lessonNotes,
        } as DraftingStep,
        draftingStepFixture(3, 'proposing'),
      ],
    };
    return ok(session);
  };

  /**
   * The server's step 3 confirm, short of the bank: the draft is saved, the step confirmed and
   * step 4 queued. Questions and the exam are the server's (corebanking-academy `confirmRules`).
   */
  const confirmRules = (request: unknown): FakeReply => {
    const { draft } = (request as { body: ConfirmRulesCommand }).body;
    const saved = original(courseEndpoints.saveDraft, {
      ...(request as object),
      body: draft,
      params: {
        courseId: String(session.courseId),
        revisionId: String(session.revisionId),
      },
      query: {},
    });
    if (saved.body.status !== 'SUCCESS') return saved;
    session = {
      ...session,
      currentStep: 4,
      steps: [
        ...session.steps.slice(0, 2),
        { ...session.steps[2], state: 'confirmed' } as DraftingStep,
        draftingStepFixture(4, 'proposing'),
      ],
    };
    return ok(session);
  };

  /** Steps 1 and 2 confirmed: the rules are being proposed. */
  const atStepThree = (
    courseId: number,
    revisionId: number,
  ): DraftingSession => ({
    ...session,
    courseId,
    revisionId,
    currentStep: 3,
    steps: [
      { ...session.steps[0], state: 'confirmed' } as DraftingStep,
      draftingStepFixture(2, 'confirmed'),
      draftingStepFixture(3, 'proposing'),
    ],
  });

  afterEach(() => vi.useRealTimers());

  const advance = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
  };

  /**
   * A draft the assistant made at step 1, opened later on its edit page: step 1 is confirmed and
   * step 2 is being proposed.
   */
  async function openDraftAtStepTwo(
    at: (courseId: number, revisionId: number) => DraftingSession = atStepTwo,
    chapters: unknown[] = [],
  ): Promise<number> {
    await open('/admin/courses/new');
    // A request the page sent while signed in, so the course is made as its author.
    const template = screen.calls.mock.calls
      .map(([, request]) => request as { token?: string | null })
      .find((request) => request?.token) as object;
    const created = original(courseEndpoints.createCourse, {
      ...template,
      body: {
        ownerOrgId: 1,
        code: 'AI-RESUME01',
        draft: {
          programId: 1,
          title: basicsProposalFixture.title,
          summary: basicsProposalFixture.summary,
          level: 'basic',
          defaultRequirement: 'mandatory',
          objectives: [...basicsProposalFixture.objectives],
          chapters,
          rewardPoints: 0,
        },
      },
      params: {},
      query: {},
    });
    const detail = (
      created.body as {
        data: { course: { id: number }; revision: { id: number } };
      }
    ).data;
    session = at(detail.course.id, detail.revision.id);

    // The draft is opened later: the page follows no session until it asks for the course's.
    const opening = TestBed.inject(Router).navigateByUrl(
      `/admin/courses/${detail.course.id}/edit`,
    );
    await advance(0);
    await opening;
    await advance(0);
    return detail.course.id;
  }

  async function open(
    url = '/admin/courses/new?session=1',
    first: unknown = draftingSessionEndpoints.get,
  ) {
    const reply = TestBed.inject(ReplyGate).hold(first as never);
    await screen.open(url);
    vi.useFakeTimers();
    reply.release();
    await advance(0);
  }

  /** The proposal arrives and every field is written. */
  const filled = async () => {
    await open();
    session = draftingSessionFixture(1);
    await advance(DRAFTING_POLL_INTERVAL_MS);
    await advance(DRAFTING_FIELD_DELAY_MS * PATCHES);
  };

  const confirmButton = () =>
    screen.button('Đã chốt') as HTMLButtonElement | undefined;
  const legend = () =>
    screen.el.querySelector('fieldset.course-editor__body legend')
      ?.textContent ?? '';

  const press = async (target: HTMLElement | undefined) => {
    if (!target) throw new Error('Nothing to click');
    target.click();
    await advance(0);
    await advance(0);
  };

  it('keeps "Đã chốt" disabled, saying why, until the step is written', async () => {
    await open();

    expect(confirmButton()?.disabled).toBe(true);
    expect(screen.text()).toContain('Bạn sửa được khi trợ lý điền xong');

    session = draftingSessionFixture(1);
    await advance(DRAFTING_POLL_INTERVAL_MS);
    expect(confirmButton()?.disabled).toBe(true);

    await advance(DRAFTING_FIELD_DELAY_MS * PATCHES);
    expect(confirmButton()?.disabled).toBe(false);
    expect(screen.text()).toContain('Bấm Đã chốt để lưu');
  });

  it('keeps "Đã chốt" disabled with the reason while a field of the step is invalid', async () => {
    await filled();

    const title = screen.field('Tên khóa học') as HTMLInputElement;
    title.value = '';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    await advance(0);

    expect(confirmButton()?.disabled).toBe(true);
    expect(screen.text()).toContain('Còn trường chưa hợp lệ ở bước này');
    expect(screen.callsTo(draftingSessionEndpoints.confirm)).toBe(0);
  });

  it('confirms step 1 with the values on the page, makes the draft and continues on its edit page at step 2', async () => {
    await filled();
    const title = screen.field('Tên khóa học') as HTMLInputElement;
    title.value = 'Tên do tác giả sửa';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    await advance(0);

    await press(confirmButton());

    expect(screen.callsTo(draftingSessionEndpoints.confirm)).toBe(1);
    const sent = screen.lastCall(draftingSessionEndpoints.confirm) as {
      params: Record<string, unknown>;
      body: ConfirmBasicsCommand;
    };
    expect(sent.params).toMatchObject({ sessionId: '1', step: '1' });
    expect(sent.body.course).toMatchObject({
      code: basicsProposalFixture.code,
      draft: {
        title: 'Tên do tác giả sửa',
        summary: basicsProposalFixture.summary,
      },
    });
    expect(session.courseId).not.toBeNull();
    expect(screen.url()).toBe(`/admin/courses/${session.courseId}/edit?step=1`);
    expect(legend()).toContain('Nội dung khóa học');
    // Step 2 is being proposed: its "Đã chốt" waits for the outline.
    expect(screen.text()).toContain('Trợ lý đang soạn…');
    expect(confirmButton()?.disabled).toBe(true);
    expect(screen.page<CourseEditor>().hasUnsavedChanges()).toBe(false);
  });

  it('shows a taken code on the field, offers the code the server proposes and keeps the other fields', async () => {
    await filled();
    const code = screen.field('Mã khóa học') as HTMLInputElement;
    code.value = TAKEN;
    code.dispatchEvent(new Event('input', { bubbles: true }));
    const title = screen.field('Tên khóa học') as HTMLInputElement;
    title.value = 'Tên do tác giả sửa';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    await advance(0);

    await press(confirmButton());

    expect(screen.url()).toContain('/admin/courses/new');
    expect(session.courseId).toBeNull();
    expect(screen.text()).toContain('Mã khóa học đã tồn tại.');
    expect(screen.field('Mã khóa học').value).toBe(TAKEN);
    expect(screen.text()).toContain(`Trợ lý đề xuất mã ${FRESH}`);
    expect(confirmButton()?.disabled).toBe(true);

    await press(screen.button(`Dùng mã ${FRESH}`));

    expect(screen.field('Mã khóa học').value).toBe(FRESH);
    expect(screen.field('Tên khóa học').value).toBe('Tên do tác giả sửa');
    expect(screen.text()).not.toContain('Mã khóa học đã tồn tại.');
    await press(confirmButton());
    expect(session.courseId).not.toBeNull();
    expect(screen.url()).toContain(`/admin/courses/${session.courseId}/edit`);
  });

  it('offers only the new code when the author filled the step, and leaves every other field as typed', async () => {
    await filled();
    handFilled = true;
    const code = screen.field('Mã khóa học') as HTMLInputElement;
    code.value = TAKEN;
    code.dispatchEvent(new Event('input', { bubbles: true }));
    const title = screen.field('Tên khóa học') as HTMLInputElement;
    title.value = 'Tên do tác giả gõ';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    await advance(0);

    await press(confirmButton());
    await press(screen.button(`Dùng mã ${FRESH}`));

    expect(screen.field('Mã khóa học').value).toBe(FRESH);
    expect(screen.field('Tên khóa học').value).toBe('Tên do tác giả gõ');
    expect(screen.text()).not.toContain('Mã khóa học đã tồn tại.');
  });

  it('says why a course for another unit is refused', async () => {
    await filled();
    const code = screen.field('Mã khóa học') as HTMLInputElement;
    code.value = OTHER_UNIT;
    code.dispatchEvent(new Event('input', { bubbles: true }));
    await advance(0);

    await press(confirmButton());

    expect(session.courseId).toBeNull();
    expect(screen.text()).toContain(OWNER_LINE);
  });

  it("resumes the draft at the session's current step after a reload, and a confirmed step is saved without confirming again", async () => {
    await openDraftAtStepTwo();

    expect(screen.callsTo(draftingSessionEndpoints.forCourse)).toBe(1);
    expect(legend()).toContain('Nội dung khóa học');

    // Back on step 1, confirmed: no bar, nothing locked, "Lưu nháp" saves the draft.
    await press(screen.button('Thông tin cơ bản'));
    expect(legend()).toContain('Thông tin cơ bản');
    expect(confirmButton()).toBeUndefined();
    expect(
      screen.el.querySelector<HTMLFieldSetElement>(
        'fieldset.course-editor__body',
      )?.disabled,
    ).toBe(false);
    const title = screen.field('Tên khóa học') as HTMLInputElement;
    title.value = 'Tên sửa sau khi chốt';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    await advance(0);
    await press(screen.button('Lưu nháp'));

    expect(screen.callsTo(courseEndpoints.saveDraft)).toBe(1);
    expect(
      (
        screen.lastCall(courseEndpoints.saveDraft) as {
          body: { title: string };
        }
      ).body.title,
    ).toBe('Tên sửa sau khi chốt');
    expect(screen.callsTo(draftingSessionEndpoints.confirm)).toBe(0);
  });

  it('follows no session on the edit page of a course the assistant did not draft', async () => {
    await open('/admin/courses/1/edit', draftingSessionEndpoints.forCourse);

    expect(screen.callsTo(draftingSessionEndpoints.get)).toBe(0);
    expect(screen.text()).not.toContain('Trợ lý đang soạn…');
    expect(confirmButton()).toBeUndefined();
  });

  describe('step 2, the outline', () => {
    /** Each chapter, then each of its lessons. */
    const OUTLINE_PATCHES = outlineProposalFixture.chapters.reduce(
      (count, chapter) => count + 1 + chapter.lessons.length,
      0,
    );
    const fieldset = () =>
      screen.el.querySelector<HTMLFieldSetElement>(
        'fieldset.course-editor__body',
      ) as HTMLFieldSetElement;
    const lessonTitles = () =>
      Array.from(
        screen.el.querySelectorAll('.course-outline__lesson-title'),
      ).map((title) => title.textContent?.trim());

    /** The server finishes the outline; the page sees it at its next look. */
    const proposeOutline = async () => {
      session = {
        ...session,
        steps: [session.steps[0], draftingStepFixture(2, 'proposed')],
      };
      await advance(DRAFTING_POLL_INTERVAL_MS);
    };

    it("writes the chapters and lessons one at a time, locked, with each lesson's line and source", async () => {
      await openDraftAtStepTwo();
      expect(legend()).toContain('Nội dung khóa học');
      expect(screen.text()).toContain('Trợ lý đang soạn…');

      await proposeOutline();
      expect(fieldset().disabled).toBe(true);
      expect(lessonTitles()).toEqual([]);

      await advance(DRAFTING_FIELD_DELAY_MS);
      expect(lessonTitles()).toEqual([
        outlineProposalFixture.chapters[0].lessons[0].title,
      ]);
      expect(fieldset().disabled).toBe(true);

      await advance(DRAFTING_FIELD_DELAY_MS * OUTLINE_PATCHES);
      const proposed = outlineProposalFixture.chapters.flatMap(
        (chapter) => chapter.lessons,
      );
      expect(lessonTitles()).toEqual(proposed.map((lesson) => lesson.title));
      expect(fieldset().disabled).toBe(false);
      expect(screen.text()).toContain(
        `${proposed[0].description} · Nguồn: ${proposed[0].sourceSection}`,
      );
      expect(screen.text()).toContain('AI đề xuất');
      // Lessons are empty: publishing will ask for content, confirming does not.
      expect(screen.text()).toContain('Thiếu nội dung');
      expect(screen.text()).toContain(
        'bài chưa có nội dung không chặn bước này',
      );
      expect(confirmButton()?.disabled).toBe(false);
    });

    it('confirms the outline with empty lessons, saves the draft and moves on to step 3', async () => {
      const courseId = await openDraftAtStepTwo();
      await proposeOutline();
      await advance(DRAFTING_FIELD_DELAY_MS * OUTLINE_PATCHES);

      await press(confirmButton());

      expect(screen.callsTo(draftingSessionEndpoints.confirm)).toBe(1);
      const sent = screen.lastCall(draftingSessionEndpoints.confirm) as {
        params: Record<string, unknown>;
        body: ConfirmOutlineCommand;
      };
      expect(sent.params).toMatchObject({ step: '2' });
      expect(
        sent.body.draft.chapters.map((chapter) => ({
          title: chapter.title,
          lessons: chapter.lessons.map((lesson) => [
            lesson.title,
            lesson.blocks.length,
          ]),
        })),
      ).toEqual(
        outlineProposalFixture.chapters.map((chapter) => ({
          title: chapter.title,
          lessons: chapter.lessons.map((lesson) => [lesson.title, 0]),
        })),
      );
      expect(legend()).toContain('Bài kiểm tra & điều kiện');
      expect(screen.url()).toContain(`/admin/courses/${courseId}/edit`);
      expect(screen.page<CourseEditor>().hasUnsavedChanges()).toBe(false);

      // Back on the outline: saved, no longer a proposal, the lines still shown.
      await press(screen.button('Nội dung khóa học'));
      expect(lessonTitles()).toHaveLength(4);
      expect(screen.text()).not.toContain('AI đề xuất');
      expect(screen.text()).toContain(
        outlineProposalFixture.chapters[0].lessons[0].description,
      );
      expect(confirmButton()).toBeUndefined();
    });
  });

  describe('step 3, the rules and draft questions', () => {
    const rules = { ...rulesProposalFixture, competencyId: 1 };
    /** The points, the competency, then each question. */
    const RULES_PATCHES = 2 + rules.questions.length;
    const questions = () =>
      Array.from(
        screen.el.querySelectorAll<HTMLElement>(
          '.drafting-questions__question',
        ),
      );
    const rewardPoints = () =>
      screen.el.querySelector<HTMLInputElement>(
        'app-course-rules input[type=number]',
      )?.value;

    /** The server finishes the rules; the page sees them at its next look. */
    const proposeRules = async () => {
      session = {
        ...session,
        steps: [
          ...session.steps.slice(0, 2),
          {
            ...draftingStepFixture(3, 'proposed'),
            proposal: rules,
          } as DraftingStep,
        ],
      };
      await advance(DRAFTING_POLL_INTERVAL_MS);
    };

    it('writes the points, the competency and the questions one at a time, each naming its source', async () => {
      await openDraftAtStepTwo(atStepThree);
      expect(legend()).toContain('Bài kiểm tra & điều kiện');

      await proposeRules();
      expect(questions()).toHaveLength(0);
      await advance(DRAFTING_FIELD_DELAY_MS * 2);
      expect(rewardPoints()).toBe(String(rules.rewardPoints));
      expect(questions()).toHaveLength(1);

      await advance(DRAFTING_FIELD_DELAY_MS * RULES_PATCHES);
      expect(questions()).toHaveLength(rules.questions.length);
      expect(screen.text()).toContain(
        `Nguồn: ${rules.questions[1].sourceSection}`,
      );
      expect(screen.text()).toContain('AI đề xuất');
      expect(
        screen.el.querySelector<HTMLSelectElement>('.drafting-questions select')
          ?.value,
      ).toBe('1');
      // Nothing reaches the question bank before the step is confirmed.
      expect(screen.callsTo(assessmentV1Endpoints.createQuestion)).toBe(0);
      expect(screen.callsTo(assessmentV1Endpoints.saveCourseExam)).toBe(0);
      expect(confirmButton()?.disabled).toBe(false);
    });

    it('keeps "Đã chốt" disabled while kept questions have no competency', async () => {
      await openDraftAtStepTwo(atStepThree);
      await proposeRules();
      await advance(DRAFTING_FIELD_DELAY_MS * RULES_PATCHES);

      const select = screen.el.querySelector<HTMLSelectElement>(
        '.drafting-questions select',
      ) as HTMLSelectElement;
      select.value = '';
      // The card's form field reads the select as the author picks.
      select.dispatchEvent(new Event('input'));
      select.dispatchEvent(new Event('change'));
      await advance(0);

      expect(confirmButton()?.disabled).toBe(true);
      expect(screen.text()).toContain(
        'Chọn năng lực cho các câu hỏi trước khi chốt.',
      );
    });

    it('confirms with the kept and edited questions only, then moves on to step 4', async () => {
      await openDraftAtStepTwo(atStepThree);
      await proposeRules();
      await advance(DRAFTING_FIELD_DELAY_MS * RULES_PATCHES);

      // The author rewrites the first question and removes the second.
      const content = questions()[0].querySelector(
        'textarea',
      ) as HTMLTextAreaElement;
      content.value = 'Đối soát cuối ngày làm khi nào?';
      content.dispatchEvent(new Event('input'));
      await advance(0);
      const remove = Array.from(questions()[1].querySelectorAll('button')).find(
        (button) => button.textContent?.includes('Bỏ câu hỏi'),
      );
      await press(remove);
      expect(questions()).toHaveLength(1);

      await press(confirmButton());

      const sent = screen.lastCall(draftingSessionEndpoints.confirm) as {
        params: Record<string, unknown>;
        body: ConfirmRulesCommand;
      };
      expect(sent.params).toMatchObject({ step: '3' });
      expect(sent.body.competencyId).toBe(1);
      expect(sent.body.draft.rewardPoints).toBe(rules.rewardPoints);
      expect(sent.body.questions).toEqual([
        {
          ...rules.questions[0],
          content: 'Đối soát cuối ngày làm khi nào?',
        },
      ]);
      expect(screen.callsTo(assessmentV1Endpoints.createQuestion)).toBe(0);
      expect(legend()).toContain('Đối tượng');
      expect(questions()).toHaveLength(0);
    });
  });

  describe('step 4, the audience and the publish check', () => {
    const audience = audienceProposalFixture;
    /** One empty lesson from the outline, as steps 2 and 3 left the draft. */
    const outline = [
      {
        title: 'Đối soát cuối ngày',
        lessons: [
          {
            title: 'Các bước đối soát',
            lessonType: 'content',
            estimatedDurationSeconds: 600,
            isRequired: true,
            blocks: [],
          },
        ],
      },
    ];

    /** Steps 1 to 3 confirmed: the audience is being proposed. */
    const atStepFour = (
      courseId: number,
      revisionId: number,
    ): DraftingSession => ({
      ...session,
      courseId,
      revisionId,
      currentStep: 4,
      steps: [
        { ...session.steps[0], state: 'confirmed' } as DraftingStep,
        draftingStepFixture(2, 'confirmed'),
        draftingStepFixture(3, 'confirmed'),
        draftingStepFixture(4, 'proposing'),
      ],
    });

    let courseId = 0;

    beforeEach(() => {
      const base = screen.calls.getMockImplementation();
      screen.calls.mockImplementation((endpoint, request) => {
        // The server's step 4 confirm stores nothing on the course: it only ends the session.
        if (
          endpoint === draftingSessionEndpoints.confirm &&
          (request as { params: Record<string, string> }).params['step'] === '4'
        ) {
          session = {
            ...session,
            status: 'finished',
            steps: session.steps.map((step) =>
              step.step === 4
                ? ({ ...step, state: 'confirmed' } as DraftingStep)
                : step,
            ),
          };
          return ok(session);
        }
        const reply = base?.(endpoint, request) as FakeReply;
        // Steps 2 and 3 held proposals, so the server marked the draft as AI made.
        if (
          endpoint === courseEndpoints.getCourse &&
          (request as { params: Record<string, string> }).params['courseId'] ===
            String(courseId) &&
          reply.body.status === 'SUCCESS'
        ) {
          const body = structuredClone(reply.body) as {
            data: { revision: Record<string, unknown> };
          };
          body.data.revision['aiGenerated'] = true;
          return { ...reply, body } as FakeReply;
        }
        return reply;
      });
    });

    /** The server finishes the audience; the page sees it at its next look. */
    const proposeAudience = async () => {
      session = {
        ...session,
        steps: [
          ...session.steps.slice(0, 3),
          draftingStepFixture(4, 'proposed'),
        ],
      };
      await advance(DRAFTING_POLL_INTERVAL_MS);
      await advance(DRAFTING_FIELD_DELAY_MS * (audience.targets.length + 1));
    };

    const atStepFourFilled = async () => {
      courseId = await openDraftAtStepTwo(atStepFour, outline);
      expect(legend()).toContain('Đối tượng');
      await proposeAudience();
    };

    it('fills the assign form with the proposed targets and saves nothing', async () => {
      await atStepFourFilled();

      expect(screen.text()).toContain(audience.targets[0].label);
      expect(screen.text()).toContain('Xuất bản và giao khóa học');
      // The page's own pre-publish check says what the chat lists: the empty lesson.
      expect(screen.text()).toContain(
        'Mọi bài học có nội dung, đủ tệp hoặc đã chọn bài kiểm tra',
      );
      expect(screen.callsTo(courseEndpoints.publish)).toBe(0);
      expect(confirmButton()?.disabled).toBe(false);
    });

    it('marks each assign row the assistant wrote "AI đề xuất" until the step is confirmed', async () => {
      await atStepFourFilled();
      const marks = () =>
        screen.el.querySelectorAll('.assign-rows__row app-suggested-mark')
          .length;

      expect(marks()).toBe(audience.targets.length);
      await press(confirmButton());
      expect(marks()).toBe(0);
    });

    it('keeps the bar "Đã chốt" the one primary action and the footer publish secondary', async () => {
      await atStepFourFilled();
      const publish = screen.button('Xuất bản và giao khóa học');

      expect(confirmButton()?.classList).toContain('btn--primary');
      expect(publish?.classList).not.toContain('btn--primary');
      expect(
        screen.el.querySelectorAll('.drafting-bar .btn--primary'),
      ).toHaveLength(1);

      await press(confirmButton());
      expect(screen.button('Xuất bản và giao khóa học')?.classList).toContain(
        'btn--primary',
      );
    });

    it('lists in the chat what the page pre-publish check fails on', async () => {
      await atStepFourFilled();
      const template = screen.calls.mock.calls
        .map(([, request]) => request as { token?: string | null })
        .find((request) => request?.token) as object;
      const saved = (
        original(courseEndpoints.getCourse, {
          ...template,
          body: null,
          params: { courseId: String(courseId) },
          query: {},
        }).body as { data: CourseDetail }
      ).data;

      const page = draftChecks(toDraftValue(saved))
        .filter((check) => !check.optional && !check.ok)
        .map((check) => check.label);
      expect(publishBlockersOf(saved)).toEqual([
        ...page,
        '1 bài chưa có nội dung',
      ]);
    });

    it('"Đã chốt" on the chat card opens the step first when the page shows another, then confirms it', async () => {
      await atStepFourFilled();
      const drafting = TestBed.inject(CourseDraftingStore);
      const card = {
        sessionId: session.id,
        step: 4 as const,
        state: 'proposed' as const,
        courseId,
      };
      await press(screen.button('Thông tin cơ bản'));
      expect(legend()).toContain('Thông tin cơ bản');
      // A step confirmed before: edited and saved with "Lưu nháp", not proposed again.
      expect(screen.button('Đề xuất lại')).toBeUndefined();

      drafting.confirmFromChat(card);
      await advance(0);
      await advance(0);

      expect(legend()).toContain('Đối tượng');
      expect(screen.callsTo(draftingSessionEndpoints.confirm)).toBe(0);

      drafting.confirmFromChat(card);
      await advance(0);
      await advance(0);
      expect(screen.lastCall(draftingSessionEndpoints.confirm)).toMatchObject({
        params: { step: '4' },
      });
    });

    it('"Đã chốt" ends the flow without assigning, sharing or publishing', async () => {
      await atStepFourFilled();
      const saves = screen.callsTo(courseEndpoints.saveDraft);

      await press(confirmButton());

      const sent = screen.lastCall(draftingSessionEndpoints.confirm) as {
        params: Record<string, unknown>;
        body: unknown;
      };
      expect(sent.params).toMatchObject({ step: '4' });
      expect(sent.body).toEqual({});
      expect(screen.callsTo(courseEndpoints.publish)).toBe(0);
      expect(screen.callsTo(courseEndpoints.saveDraft)).toBe(saves);
      expect(confirmButton()).toBeUndefined();
      // The rows stay on the page for the author's own "Xuất bản".
      expect(screen.text()).toContain(audience.targets[0].label);
      expect(legend()).toContain('Đối tượng');
    });

    it('publishing the drafted course stays manual and asks "Tôi đã rà soát nội dung"', async () => {
      await atStepFourFilled();
      await press(confirmButton());

      await press(screen.button('Xuất bản và giao khóa học'));

      const dialog = screen.alertDialog();
      expect(dialog?.textContent).toContain('Tôi đã rà soát nội dung');
      expect(screen.button('Xuất bản', dialog ?? undefined)?.disabled).toBe(
        true,
      );
      expect(screen.callsTo(courseEndpoints.publish)).toBe(0);
    });
  });
});

describe('CourseEditor proposing a step again, stopping and failed steps', () => {
  const screen = setUpAdminScreen([
    { provide: Sha256Hasher, useValue: new FakeHasher() },
  ]);
  const FAILURE = 'Không đọc được tài liệu nguồn. Hãy thử lại hoặc tự điền.';

  let session: DraftingSession;
  let polls = 0;

  const original = (endpoint: unknown, request: unknown): FakeReply =>
    MockBackend.prototype.handle.call(
      TestBed.inject(MockBackend),
      endpoint as never,
      request as never,
    ) as FakeReply;

  /** The session's step 1 as the server has it now. */
  const stepOne = (change: Partial<DraftingStep>): DraftingStep =>
    ({ ...session.steps[0], ...change }) as DraftingStep;

  beforeEach(() => {
    session = proposing();
    polls = 0;
    screen.calls.mockImplementation((endpoint, request) => {
      if (endpoint === draftingSessionEndpoints.get) {
        polls++;
        return ok(session);
      }
      if (endpoint === draftingSessionEndpoints.proposeAgain) {
        session = {
          ...session,
          status: 'active',
          error: null,
          steps: [stepOne({ state: 'proposing', proposal: null, error: null })],
        };
        return ok(session);
      }
      if (endpoint === draftingSessionEndpoints.manual) {
        session = {
          ...session,
          status: 'manual',
          error: null,
          steps: [stepOne({ state: 'manual', error: null })],
        };
        return ok(session);
      }
      if (endpoint === draftingSessionEndpoints.stop) {
        session = {
          ...session,
          steps: session.steps.map((step) =>
            step.state === 'proposing' ? { ...step, state: 'manual' } : step,
          ),
        };
        return ok(session);
      }
      return original(endpoint, request);
    });
  });

  afterEach(() => vi.useRealTimers());

  const advance = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
  };

  async function open() {
    const reply = TestBed.inject(ReplyGate).hold(draftingSessionEndpoints.get);
    await screen.open('/admin/courses/new?session=1');
    vi.useFakeTimers();
    reply.release();
    await advance(0);
  }

  const tap = async (target: HTMLElement | null | undefined) => {
    if (!target) throw new Error('Nothing to click');
    target.click();
    await advance(0);
    await advance(0);
  };

  /** The server has `proposal` for step 1 and every field of it is written. */
  const proposed = async (title = basicsProposalFixture.title, time = '') => {
    session = {
      ...draftingSessionFixture(1),
      steps: [
        {
          ...draftingStepFixture(1, 'proposed'),
          proposal: { ...basicsProposalFixture, title },
          updateTime: time || draftingStepFixture(1).updateTime,
        } as DraftingStep,
      ],
    };
    await advance(DRAFTING_POLL_INTERVAL_MS);
    await advance(DRAFTING_FIELD_DELAY_MS * PATCHES);
  };

  const failed = (): DraftingSession => ({
    ...draftingSessionFixture(1),
    status: 'failed',
    error: FAILURE,
    steps: [
      { ...draftingStepFixture(1, 'failed'), proposal: null, error: FAILURE },
    ],
  });

  const fieldset = () =>
    screen.el.querySelector<HTMLFieldSetElement>(
      'fieldset.course-editor__body',
    )!;
  const typeTitle = async (text: string) => {
    const title = screen.field('Tên khóa học') as HTMLInputElement;
    title.value = text;
    title.dispatchEvent(new Event('input', { bubbles: true }));
    await advance(0);
  };

  it('"Đề xuất lại" asks first, then proposes only that step and writes its new proposal over its fields', async () => {
    await open();
    await proposed();
    await typeTitle('Tên do tác giả sửa');

    await tap(screen.button('Đề xuất lại'));
    expect(screen.text(screen.alertDialog()!)).toContain(
      'Các bước khác giữ nguyên',
    );
    await tap(screen.button('Hủy', screen.alertDialog()!));
    expect(screen.callsTo(draftingSessionEndpoints.proposeAgain)).toBe(0);
    expect(screen.field('Tên khóa học').value).toBe('Tên do tác giả sửa');

    await tap(screen.button('Đề xuất lại'));
    await tap(screen.button('Đề xuất lại', screen.alertDialog()!));
    expect(screen.callsTo(draftingSessionEndpoints.proposeAgain)).toBe(1);
    expect(
      screen.lastCall(draftingSessionEndpoints.proposeAgain),
    ).toMatchObject({ params: { sessionId: '1', step: '1' } });
    expect(screen.text()).toContain('Trợ lý đang soạn…');
    expect(fieldset().disabled).toBe(true);
    expect(screen.field('Tên khóa học').value).toBe('Tên do tác giả sửa');

    await proposed('Tên trợ lý đề xuất lại', '2026-11-18T09:00:00+07:00');

    expect(screen.field('Tên khóa học').value).toBe('Tên trợ lý đề xuất lại');
    expect(fieldset().disabled).toBe(false);
    expect(screen.button('Đã chốt')).toBeDefined();
  });

  it('a failed step shows its error with "Thử lại", which proposes only that step again', async () => {
    session = failed();
    await open();

    expect(screen.text()).toContain('Trợ lý không soạn được bước này');
    expect(screen.text()).toContain(FAILURE);
    expect(screen.button('Tự điền')).toBeDefined();
    expect(screen.button('Đã chốt')).toBeUndefined();

    await tap(screen.button('Thử lại'));

    expect(screen.alertDialog()).toBeNull();
    expect(
      screen.lastCall(draftingSessionEndpoints.proposeAgain),
    ).toMatchObject({ params: { sessionId: '1', step: '1' } });
    expect(screen.text()).toContain('Trợ lý đang soạn…');
    expect(screen.text()).not.toContain(FAILURE);

    await proposed();
    expect(screen.field('Tên khóa học').value).toBe(
      basicsProposalFixture.title,
    );
  });

  it('"Tự điền" ends the assistant\'s part: the step is the author\'s and nothing more is asked or written', async () => {
    session = failed();
    await open();

    await tap(screen.button('Tự điền'));

    expect(screen.lastCall(draftingSessionEndpoints.manual)).toMatchObject({
      params: { sessionId: '1', step: '1' },
    });
    expect(screen.text()).not.toContain('Trợ lý không soạn được bước này');
    expect(screen.button('Đã chốt')).toBeUndefined();
    expect(screen.button('Đề xuất lại')).toBeUndefined();
    expect(fieldset().disabled).toBe(false);
    const asked = polls;
    await advance(DRAFTING_POLL_INTERVAL_MS * 3);
    expect(polls).toBe(asked);
    expect(screen.field('Tên khóa học').value).toBe('');
  });

  it('"Dừng" after "Đề xuất lại" stops the server and keeps what the step already held', async () => {
    await open();
    await proposed();
    await tap(screen.button('Đề xuất lại'));
    await tap(screen.button('Đề xuất lại', screen.alertDialog()!));

    await tap(screen.button('Dừng'));

    expect(screen.lastCall(draftingSessionEndpoints.stop)).toMatchObject({
      params: { sessionId: '1' },
    });
    expect(screen.text()).not.toContain('Trợ lý đang soạn…');
    expect(fieldset().disabled).toBe(false);
    expect(screen.field('Tên khóa học').value).toBe(
      basicsProposalFixture.title,
    );
    // Stopped, the step is the author's: confirmed as usual, not proposed again from here.
    expect(screen.button('Đã chốt')).toBeDefined();
    expect(screen.button('Đề xuất lại')).toBeUndefined();
  });
});
