import { RouterTestingHarness } from '@angular/router/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { createAppRoutes } from '../../../app.routes';
import {
  APP_CONFIG,
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../core/dev/mock-api/mock-backend.testing';
import { SessionStore } from '../../../core/session/session.store';
import { TokenStore } from '../../../core/session/token-store';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import { computed, Injectable } from '@angular/core';
import { AssessmentScreen } from './assessment-screen';
import { AssessmentScreenStore } from './data-access/assessment-screen.store';

/** The store as it is while the backend lacks the program question bank, with the seeded data. */
@Injectable()
class PendingStore extends AssessmentScreenStore {
  override readonly integrationPending$ = computed(() => true);
}
import {
  programAssessmentEndpoints as api,
  type ProgramQuestionRequest,
} from '@lms/contracts';
import { envelopeError } from '@lms/mocks';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';

/** The admin question bank and quiz settings, which stay on this screen after the learner routes left. */
describe('AssessmentScreen (admin)', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
  });

  async function open(url: string) {
    signInToMockBackend('quantri');
    fakeSession().user.set(seedProfile('000002'));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    for (let i = 0; i < 6; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  async function settle() {
    for (let i = 0; i < 6; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  function store() {
    const value = harness.routeDebugElement?.injector.get(
      AssessmentScreenStore,
    );
    if (!value) throw new Error('Assessment route missing');
    return value;
  }

  it('lists the question bank', async () => {
    await open('/admin/questions?programId=2');
    expect(text()).toContain('CH-CIF-01');
    expect(el.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
  });

  it('lists the quizzes with a link to their settings', async () => {
    await open('/admin/quizzes');
    expect(text()).toContain('Luyện tập: Tổng quan hệ thống Core Banking');
    expect(el.querySelector('a[href^="/admin/quizzes/1"]')).toBeTruthy();
  });

  it('opens the settings of a quiz with its form', async () => {
    await open('/admin/quizzes/1');
    expect(el.querySelector('form')).toBeTruthy();
    expect(text()).toContain('Lưu cấu hình');
  });

  it('filters/pages on the server and only fetches answer options on opening a detail', async () => {
    await open('/admin/questions?programId=2');
    const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
    store().setQuestionFilter('questionType', 'MULTIPLE');
    await settle();
    expect(
      spy.mock.calls.find(([e]) => e === api.questions)?.[1].query,
    ).toMatchObject({
      programId: '2',
      questionType: 'MULTIPLE',
      page: '0',
      size: '20',
    });
    expect(store().questionRows$()).toHaveLength(2);
    expect(spy.mock.calls.some(([e]) => e === api.question)).toBe(false);
    store().editQuestion(2);
    await settle();
    expect(store().questionDraft$()?.options).toHaveLength(3);
  });

  it('keeps the editor and form values when a version conflict refuses a save', async () => {
    await open('/admin/questions?programId=2');
    store().editQuestion(1);
    await settle();
    const backend = TestBed.inject(MockBackend),
      handle = backend.handle.bind(backend);
    const spy = vi.spyOn(backend, 'handle').mockImplementation((e, r) =>
      e === api.updateQuestion
        ? {
            status: 200,
            body: envelopeError(
              'ASSESSMENT-CONFLICT',
              'Dữ liệu đã thay đổi',
              'Tải lại trước khi sửa.',
            ),
          }
        : handle(e, r),
    );
    const draft = store().questionDraft$();
    if (!draft) throw new Error('Question missing');
    const textarea = document.querySelector<HTMLTextAreaElement>(
      '#question-form textarea',
    );
    if (!textarea) throw new Error('Question editor missing');
    textarea.value = 'Nội dung cần giữ';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    const command: ProgramQuestionRequest = {
      programId: draft.programId,
      competencyId: draft.competencyId,
      code: draft.code,
      questionType: draft.questionType,
      content: 'Nội dung cần giữ',
      explanation: draft.explanation,
      difficulty: draft.difficulty,
      points: draft.points,
      status: draft.status,
      options: draft.options.map((o) => ({
        id: o.id,
        content: o.content,
        correct: o.correct,
      })),
    };
    store().saveQuestion(command);
    await settle();
    expect(store().editorOpen$()).toBe(true);
    expect(textarea.value).toBe('Nội dung cần giữ');
    expect(store().questionSaveError$()?.message).toContain('Tải lại');
    const request = spy.mock.calls.find(([e]) => e === api.updateQuestion)?.[1];
    expect(request?.query).toEqual({ expectedVersion: '0' });
    expect(request?.body).toMatchObject({
      content: 'Nội dung cần giữ',
      questionType: 'SINGLE',
    });
    expect(request?.body).not.toHaveProperty('expectedVersion');
  });

  it('retries a partial new-quiz save without creating another draft', async () => {
    await open('/admin/quizzes/new?courseId=1');
    const backend = TestBed.inject(MockBackend),
      handle = backend.handle.bind(backend);
    let refusePool = true;
    const spy = vi.spyOn(backend, 'handle').mockImplementation((e, r) => {
      if (e === api.replacePool && refusePool) {
        refusePool = false;
        return {
          status: 200,
          body: envelopeError(
            'ASSESSMENT-CONFLICT',
            'Chưa lưu bộ câu hỏi',
            'Thử lại bước lưu bộ câu hỏi.',
          ),
        };
      }
      return handle(e, r);
    });
    const detail = api.quiz.response.parse(
      handle(api.quiz, {
        token: TestBed.inject(TokenStore).read(),
        params: { id: '1' },
        query: {},
        body: undefined,
      })?.body.data,
    );
    const {
      id,
      status,
      rowVersion,
      publishedAt,
      createTime,
      updateTime,
      ...command
    } = detail.quiz;
    void id;
    void status;
    void rowVersion;
    void publishedAt;
    void createTime;
    void updateTime;
    const pool = { items: [{ questionId: 1, sortNo: 0, points: null }] };
    store().saveQuiz({ ...command, title: 'Bản nháp mới' }, pool);
    await settle();
    expect(store().partialSave$()).toBe(true);
    store().saveQuiz({ ...command, title: 'Bản nháp mới' }, pool);
    await settle();
    expect(spy.mock.calls.filter(([e]) => e === api.createQuiz)).toHaveLength(
      1,
    );
    expect(spy.mock.calls.filter(([e]) => e === api.replacePool)).toHaveLength(
      2,
    );
    expect(store().quizSaveError$()).toBeUndefined();
  });

  it('rejects an invalid quiz URL instead of treating it as a new draft', async () => {
    await open('/admin/quizzes/not-a-number');
    expect(text()).toContain('ID bài kiểm tra không hợp lệ');
    expect(el.querySelector('form')).toBeNull();
  });

  it('uses a program bank without requiring a course or lesson when adding a question', async () => {
    await open('/admin/questions?programId=2');
    const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
    store().editQuestion(null);
    await settle();
    expect(document.querySelector('#question-form')?.textContent).toContain(
      'Chương trình:',
    );
    expect(document.querySelector('#question-form')?.textContent).not.toContain(
      'Bài học liên quan',
    );
    store().saveQuestion({
      programId: 2,
      code: 'PROGRAM-ONLY',
      competencyId: 1,
      questionType: 'SINGLE',
      content: 'Câu hỏi dùng chung',
      explanation: null,
      difficulty: 'EASY',
      points: 1,
      status: 'ACTIVE',
      options: [
        { content: 'Đúng', correct: true },
        { content: 'Sai', correct: false },
      ],
    });
    await settle();
    expect(store().editorOpen$()).toBe(false);
    const body = spy.mock.calls.find(([e]) => e === api.createQuestion)?.[1]
      .body;
    expect(body).toMatchObject({ programId: 2 });
    expect(body).not.toHaveProperty('courseId');
    expect(body).not.toHaveProperty('lessonId');
  });

  it('includes questions from another course of the same program and excludes other programs', async () => {
    await open('/admin/quizzes/1');
    expect(store().selectedProgramId$()).toBe(2);
    expect(
      store()
        .poolRows$()
        .some((q) => q.id === 9),
    ).toBe(true);
    expect(
      store()
        .poolRows$()
        .some((q) => q.id === 3),
    ).toBe(false);
    const backend = TestBed.inject(MockBackend);
    const token = TestBed.inject(TokenStore).read();
    const version = store().config$()?.rowVersion ?? 0;
    const request = (questionId: number) =>
      backend.handle(api.replacePool, {
        token,
        params: { id: '1' },
        query: { expectedVersion: String(version) },
        body: { items: [{ questionId, sortNo: 0, points: null }] },
      });
    expect(request(3)?.body.status).toBe('ERROR');
    expect(request(9)?.body.status).toBe('SUCCESS');
  });

  it('clears bulk selections when switching programs and renders the primary action in the header', async () => {
    await open('/admin/questions?programId=2');
    store().toggleQuestion(1, true);
    store().selectProgram('3');
    await settle();
    expect(store().selectedIds$()).toEqual([]);
    expect(
      store()
        .questionRows$()
        .every((q) => q.programId === 3),
    ).toBe(true);
    expect(el.querySelector('ui-page-header button')?.textContent).toContain(
      'Thêm câu hỏi',
    );
  });
  it('does not send proposed program requests or log out a real-backend session before integration', async () => {
    TestBed.overrideProvider(APP_CONFIG, {
      useValue: parseAppConfig(
        testAppConfig({ mockApi: true, mockBackend: false }),
      ),
    });
    await open('/admin/questions');
    const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
    store().editQuestion(null);
    store().retry();
    await settle();
    expect(store().integrationPending$()).toBe(true);
    expect(store().editorOpen$()).toBe(false);
    expect(text()).toContain(
      'Ngân hàng câu hỏi theo chương trình chưa sẵn sàng',
    );
    expect(text()).toContain(
      'Bài kiểm tra hiện có vẫn dùng bộ câu hỏi đã gán.',
    );
    expect(text()).not.toMatch(/API|Thêm câu hỏi/);
    expect(
      spy.mock.calls.some(([e]) =>
        e.path.startsWith('/api/assessment-program/'),
      ),
    ).toBe(false);
    expect(TestBed.inject(TokenStore).read()).toBeTruthy();
  });

  describe('while the program question bank is missing', () => {
    const REASON =
      'Cần ngân hàng câu hỏi theo chương trình để tạo bài kiểm tra mới.';

    beforeEach(() => {
      TestBed.overrideProvider(APP_CONFIG, {
        useValue: parseAppConfig(
          testAppConfig({ mockApi: true, mockBackend: false }),
        ),
      });
    });

    it('offers no "Thêm câu hỏi" on the question bank', async () => {
      await open('/admin/questions');
      expect(el.querySelector('ui-page-header button')).toBeNull();
    });

    it('disables "Tạo bài kiểm tra" and says why', async () => {
      await open('/admin/quizzes');
      const create = el.querySelector<HTMLElement>(
        'ui-page-header a[uiButton]',
      );
      expect(create?.textContent).toContain('Tạo bài kiểm tra');
      expect(create?.getAttribute('aria-disabled')).toBe('true');
      const reason = el.querySelector(
        `#${create?.getAttribute('aria-describedby')}`,
      );
      expect(reason?.textContent?.trim()).toBe(REASON);
    });

    it('explains the empty builder and keeps its save disabled', async () => {
      // The builder needs the course loaded, which the seeded backend serves only with mockBackend.
      TestBed.overrideProvider(APP_CONFIG, {
        useValue: parseAppConfig(
          testAppConfig({ mockApi: true, mockBackend: true }),
        ),
      });
      TestBed.overrideComponent(AssessmentScreen, {
        set: {
          providers: [
            { provide: AssessmentScreenStore, useClass: PendingStore },
          ],
        },
      });
      await open('/admin/quizzes/new?courseId=3');
      expect(el.querySelector('ui-alert')?.textContent).toContain(REASON);
      const save = [...el.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Lưu cấu hình'),
      );
      expect(save?.disabled).toBe(true);
      expect(text()).not.toContain('khi hệ thống cập nhật hỗ trợ');
    });
  });

  it('keeps "Tạo bài kiểm tra" with the mock backend', async () => {
    await open('/admin/quizzes?courseId=3');
    expect(
      el
        .querySelector('ui-page-header a[uiButton]')
        ?.getAttribute('aria-disabled'),
    ).toBeNull();
  });

  it('keeps "Thêm câu hỏi" with the mock backend', async () => {
    await open('/admin/questions?programId=2');
    expect(
      el.querySelector<HTMLButtonElement>('ui-page-header button')?.disabled,
    ).toBe(false);
  });
});
