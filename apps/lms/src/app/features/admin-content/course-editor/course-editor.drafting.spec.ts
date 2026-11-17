import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  courseEndpoints,
  draftingSessionEndpoints,
  type ConfirmBasicsCommand,
  type ConfirmOutlineCommand,
  type DraftingSession,
  type DraftingStep,
} from '@lms/contracts';
import {
  backendRefusal,
  basicsProposalFixture,
  draftingSessionFixture,
  draftingStepFixture,
  envelopeOk,
  outlineProposalFixture,
  type FakeReply,
} from '@lms/mocks';
import { of } from 'rxjs';
import { DRAFTING_POLL_INTERVAL_MS } from '../../../core/course-drafting/course-drafting.store';
import { setUpAdminScreen } from '../../../core/dev/mock-api/admin-screen.testing';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import { ReplyGate } from '../../../core/dev/mock-api/mock-backend.testing';
import { LeavePrompt } from '../../../core/routing/unsaved-changes.guard';
import type { CourseEditor } from './course-editor';
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
      if (endpoint === draftingSessionEndpoints.confirm) {
        const { course } = (request as { body: ConfirmBasicsCommand }).body;
        if (session.courseId !== null) return ok(session);
        if (course.code === TAKEN) {
          const step = session.steps[0];
          session = {
            ...session,
            steps: [
              {
                ...step,
                proposal: { ...basicsProposalFixture, code: FRESH },
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
    session = {
      ...session,
      currentStep: 3,
      steps: [
        session.steps[0],
        { ...session.steps[1], state: 'confirmed' } as DraftingStep,
        draftingStepFixture(3, 'proposing'),
      ],
    };
    return ok(session);
  };

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
  async function openDraftAtStepTwo(): Promise<number> {
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
          chapters: [],
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
    session = atStepTwo(detail.course.id, detail.revision.id);

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
});
