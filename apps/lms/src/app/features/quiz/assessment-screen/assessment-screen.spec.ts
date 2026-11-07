import { Dialog } from '@angular/cdk/dialog';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { provideEnvelopeHttpClient } from '../../../core/http/http.testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { createAppRoutes } from '../../../app.routes';
import {
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
import { Injectable, signal } from '@angular/core';
import { AssessmentScreen } from './assessment-screen';
import { AssessmentScreenStore } from './data-access/assessment-screen.store';
import { LeavePrompt } from '../../../core/routing/unsaved-changes.guard';

import {
  programAssessmentEndpoints as api,
  trainingCatalogEndpoints,
  courseEndpoints,
  type ProgramQuestionRequest,
} from '@lms/contracts';
import { envelopeError, envelopeOk } from '@lms/mocks';
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
    expect(
      [...el.querySelectorAll('ui-page-header button')].map((b) =>
        b.textContent?.trim(),
      ),
    ).toContain('Thêm câu hỏi');
  });
  function enterQuizTitle(value: string): void {
    const input = el.querySelector<HTMLInputElement>(
      'ui-field[label="Tên bài kiểm tra"] input',
    );
    if (!input) throw Error('Quiz title field missing');
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function chooseQuestion(code: string): void {
    const label = [...el.querySelectorAll('.assessment__pool label')].find(
      (x) => x.textContent?.includes(code + ' ·'),
    );
    const input = label?.querySelector<HTMLInputElement>('input');
    if (!input) throw Error('Pool question missing: ' + code);
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  it('creates a quiz from programId using another course of the same program', async () => {
    const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
    await open('/admin/quizzes/new?programId=2');
    const leavePrompt = vi.fn(() => of(true));
    TestBed.inject(LeavePrompt).use(leavePrompt);
    expect(store().selectedProgramId$()).toBe(2);
    expect(
      store()
        .courses$()
        ?.items.every((c) => c.programId === 2),
    ).toBe(true);
    expect(
      spy.mock.calls.some(
        ([e, r]) =>
          e === courseEndpoints.instructorCourses &&
          r.query['programId'] === '2',
      ),
    ).toBe(true);
    enterQuizTitle('Bài thi theo chương trình');
    chooseQuestion('CH-CIF-01');
    await settle();
    store().selectCourse('5');
    await settle();
    el = harness.routeNativeElement as HTMLElement;
    expect(
      el.querySelector<HTMLInputElement>(
        'ui-field[label="Tên bài kiểm tra"] input',
      )?.value,
    ).toBe('Bài thi theo chương trình');
    expect(store().selectedProgramId$()).toBe(2);
    el.querySelector('form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await settle();
    expect(
      spy.mock.calls.find(([e]) => e === api.createQuiz)?.[1].body,
    ).toMatchObject({ courseId: 5, title: 'Bài thi theo chương trình' });
    expect(
      spy.mock.calls.find(([e]) => e === api.replacePool)?.[1].body,
    ).toMatchObject({ items: [{ questionId: 1 }] });
    expect(store().quizSaveError$()).toBeUndefined();
    expect(leavePrompt).not.toHaveBeenCalled();
    expect(TestBed.inject(Router).url).toMatch(/^\/admin\/quizzes\/\d+/);
    el = harness.routeNativeElement as HTMLElement;
    enterQuizTitle('Thay đổi chưa lưu sau khi tạo');
    await settle();
    const screen = harness.routeDebugElement
      ?.componentInstance as AssessmentScreen;
    expect(screen.hasUnsavedChanges()).toBe(true);
  });
  it('creates a quiz from the course alone and shows the program as text', async () => {
    await open('/admin/quizzes/new?programId=2');
    expect(
      el.querySelector('select[aria-label="Chương trình của bài kiểm tra"]'),
    ).toBeNull();
    expect(
      el.querySelector('select[aria-label="Khóa học quản lý"]'),
    ).toBeTruthy();
    expect(text()).toContain('Câu hỏi lấy từ ngân hàng của chương trình');
  });
  it('keeps the program filter on the quiz list', async () => {
    await open('/admin/quizzes');
    expect(
      el.querySelector('select[aria-label="Chương trình của bài kiểm tra"]'),
    ).toBeTruthy();
  });
  it('keeps quiz settings but clears incompatible selected questions on a program change', async () => {
    await open('/admin/quizzes/new?programId=2');
    enterQuizTitle('Giữ thông tin bài thi');
    chooseQuestion('CH-CIF-01');
    await settle();
    store().selectProgram('3');
    await settle();
    expect(store().selectedProgramId$()).toBe(3);
    expect(
      store()
        .courses$()
        ?.items.every((c) => c.programId === 3),
    ).toBe(true);
    expect(
      el.querySelector<HTMLInputElement>(
        'ui-field[label="Tên bài kiểm tra"] input',
      )?.value,
    ).toBe('Giữ thông tin bài thi');
    expect(el.querySelectorAll('.assessment__pool input:checked')).toHaveLength(
      0,
    );
  });
  it('blocks a course/program mismatch from a deep link until the author selects a matching course', async () => {
    await open('/admin/quizzes/new?programId=3&courseId=1');
    expect(store().courseProgramMismatch$()).toBe(true);
    expect(text()).toContain('không thuộc chương trình đã chọn');
    expect(el.querySelector('form')).toBeNull();
    store().selectCourse('2');
    await settle();
    expect(store().courseProgramMismatch$()).toBe(false);
    expect(store().selectedProgramId$()).toBe(3);
    expect(el.querySelector('form')).toBeTruthy();
  });
  it('offers the Excel import and flashcard management, not quiz creation, on the question bank', async () => {
    await open('/admin/questions?programId=2');
    const links = [...el.querySelectorAll('ui-page-header a')].map((a) => [
      a.textContent?.trim(),
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([['Quản lý flashcard', '/admin/flashcards']]);
    const labels = [...el.querySelectorAll('ui-page-header button')].map((b) =>
      b.textContent?.trim(),
    );
    expect(labels).toEqual(['Nhập từ Excel', 'Thêm câu hỏi']);
    expect(text()).not.toContain('Tạo bài kiểm tra');
  });
  it('shows the bank counts, whatever the list filters are', async () => {
    await open('/admin/questions?programId=2');
    store().setQuestionFilter('questionType', 'MULTIPLE');
    await settle();
    const kpis = [...el.querySelectorAll('ui-kpi')].map((k) =>
      k.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(kpis).toHaveLength(4);
    expect(kpis[0]).toContain('Đang sử dụng');
    expect(kpis[1]).toContain('Một đáp án đúng');
    expect(kpis[2]).toContain('Nhiều đáp án đúng');
    expect(kpis[3]).toContain('Ngưng sử dụng');
    expect(
      Object.values(store().summary$()).every((n) => n !== undefined),
    ).toBe(true);
  });
  it('selects and clears every row of the page from the header checkbox', async () => {
    await open('/admin/questions?programId=2');
    const header = el.querySelector<HTMLInputElement>(
      'thead input[type=checkbox]',
    );
    expect(header).toBeTruthy();
    header!.checked = true;
    header!.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(store().selectedIds$()).toEqual(
      store()
        .questionRows$()
        .map((q) => q.id),
    );
    expect(store().allSelected$()).toBe(true);
    header!.checked = false;
    header!.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(store().selectedIds$()).toEqual([]);
  });

  describe('import from Excel', () => {
    const drawer = () =>
      document.querySelector<HTMLElement>('[role="dialog"]') ?? undefined;
    const press = (root: ParentNode | null | undefined, label: string) => {
      const found = [...(root?.querySelectorAll('button') ?? [])].find((b) =>
        b.textContent?.includes(label),
      );
      if (!found) throw Error('Button missing: ' + label);
      return found;
    };
    const pick = async (name: string) => {
      const input = drawer()?.querySelector<HTMLInputElement>(
        'input[type="file"]',
      ) as HTMLInputElement;
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new File([new Uint8Array(10)], name)],
      });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
    };
    const openDrawer = async () => {
      await open('/admin/questions?programId=2');
      press(el.querySelector('ui-page-header'), 'Nhập từ Excel').click();
      await settle();
    };

    it('opens a drawer for the selected program without requiring a course', async () => {
      await openDrawer();
      expect(drawer()?.textContent).toContain('Nhập câu hỏi từ Excel');
      expect(drawer()?.textContent).toContain('Tải mẫu Excel');
      expect(drawer()?.textContent).toContain(
        'Nền tảng nghiệp vụ Core Banking',
      );
      expect(drawer()?.textContent).not.toContain('Nhập vào khóa học');
      expect(drawer()?.querySelector('select')).toBeNull();
      expect(press(drawer(), 'Nhập câu hỏi').disabled).toBe(true);
      expect(press(drawer(), 'Kiểm tra').disabled).toBe(true);
    });

    it('checks a file, imports it, then closes and reloads the bank', async () => {
      const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
      const calls = () =>
        spy.mock.calls.filter(([endpoint]) => endpoint === api.importQuestions);
      await openDrawer();
      await pick('cau-hoi.xlsx');
      press(drawer(), 'Kiểm tra').click();
      await settle();
      expect(drawer()?.textContent).toContain(
        'Hợp lệ: 3 câu mới, 0 câu ghi đè',
      );
      const before = store().questions$()?.totalElements ?? 0;

      press(drawer(), 'Nhập câu hỏi').click();
      await settle();
      expect(calls()).toHaveLength(2);
      expect(calls()[0][1].query).toMatchObject({
        programId: '2',
        dryRun: 'true',
      });
      expect(calls()[1][1].query).toMatchObject({
        programId: '2',
        dryRun: 'false',
      });
      expect(calls()[0][1].query).not.toHaveProperty('courseId');
      expect(calls()[1][1].query).not.toHaveProperty('courseId');
      expect(drawer()).toBeUndefined();
      expect(document.body.textContent).toContain('Đã nhập 3 câu hỏi');
      expect(store().questions$()?.totalElements).toBe(before + 3);
    });

    it('keeps the import disabled for an invalid file', async () => {
      await openDrawer();
      await pick('du-lieu-loi.xlsx');
      press(drawer(), 'Kiểm tra').click();
      await settle();
      expect(document.body.textContent).toContain(
        'Tệp nhập chưa hợp lệ. Vui lòng kiểm tra các lỗi chi tiết.',
      );
      expect(drawer()?.textContent).toContain('Dòng 2 · Đáp án đúng');
      expect(press(drawer(), 'Nhập câu hỏi').disabled).toBe(true);
    });

    it('refuses a non-xlsx file without a request', async () => {
      const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
      await openDrawer();
      await pick('cau-hoi.csv');
      expect(drawer()?.textContent).toContain('Chỉ nhận tệp Excel .xlsx.');
      expect(press(drawer(), 'Kiểm tra').disabled).toBe(true);
      expect(
        spy.mock.calls.some(([endpoint]) => endpoint === api.importQuestions),
      ).toBe(false);
    });
  });

  describe('question picker pagination', () => {
    /** Reports a number of pages without loading them, whatever the seeded program holds. */
    function withPages(totalPages: number | undefined) {
      @Injectable()
      class PagedStore extends AssessmentScreenStore {
        override readonly questions$ = signal(
          totalPages === undefined
            ? undefined
            : ({ items: [], totalPages, page: 0 } as never),
        );
      }
      TestBed.overrideComponent(AssessmentScreen, {
        set: {
          providers: [{ provide: AssessmentScreenStore, useClass: PagedStore }],
        },
      });
    }
    const pager = () =>
      [...el.querySelectorAll('span')].find((e) =>
        /Trang \d+ \//.test(e.textContent ?? ''),
      );

    it.each([undefined, 0, 1])('is hidden with %s pages', async (pages) => {
      withPages(pages);
      await open('/admin/quizzes/new?courseId=3');
      expect(pager()).toBeUndefined();
      expect(text()).not.toContain('Trang trước');
    });

    it('shows with two pages', async () => {
      withPages(2);
      await open('/admin/quizzes/new?courseId=3');
      expect(pager()?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Trang 1 / 2',
      );
      expect(text()).toContain('Trang sau');
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

describe('Assessment program catalogue with the real backend', () => {
  let backend: HttpTestingController;
  let store: AssessmentScreenStore;
  const program = (id: number, ownerOrgId = 1) => ({
    id,
    ownerOrgId,
    code: 'P' + id,
    name: 'Chương trình ' + id,
    status: 'published',
    rowVersion: 0,
  });
  const page = (id: number, index = 0, totalPages = 1, ownerOrgId = 1) => ({
    items: [program(id, ownerOrgId)],
    page: index,
    size: 100,
    totalPages,
    totalElements: totalPages,
  });
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...provideEnvelopeHttpClient(),
        provideAppConfig(testAppConfig({ mockApi: true, mockBackend: false })),
        { provide: SessionStore, useClass: FakeSessionStore },
        {
          provide: Router,
          useValue: { url: '/admin/questions', events: EMPTY },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({})),
            queryParamMap: of(convertToParamMap({ programId: '2' })),
          },
        },
        { provide: Dialog, useValue: {} },
        AssessmentScreenStore,
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AssessmentScreenStore);
  });
  afterEach(() => {
    TestBed.tick();
    for (const req of backend.match((r) => r.url === '/api/v1/questions')) {
      if (req.cancelled) continue;
      req.flush(
        envelopeOk({
          items: [],
          page: 0,
          size: 20,
          totalPages: 0,
          totalElements: 0,
        }),
      );
    }
    backend.verify();
  });
  function request(ownerOrgId = 1, index = 0) {
    TestBed.tick();
    for (const option of backend.match((r) => r.url === '/api/v1/competencies'))
      option.flush(envelopeOk([]));
    const req = backend.expectOne(
      (r) =>
        r.url === trainingCatalogEndpoints.listPrograms.path &&
        r.params.get('page') === String(index),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('ownerOrgId')).toBe(String(ownerOrgId));
    expect(req.request.params.get('size')).toBe('100');
    expect(req.request.params.has('q')).toBe(false);
    return req;
  }
  it('loads the catalogue and real program question contract', () => {
    fakeSession().user.set(seedProfile('000002'));
    request().flush(envelopeOk(page(2)));
    TestBed.tick();
    expect(store.programs$()?.items).toMatchObject([
      { id: 2, name: 'Chương trình 2' },
    ]);
    expect(store.selectedProgramId$()).toBe(2);
    const counts = backend.match(
      (r) =>
        r.url === '/api/v1/questions' &&
        (r.params.has('status') || r.params.has('questionType')) &&
        r.params.get('size') === '1',
    );
    expect(counts).toHaveLength(4);
    for (const count of counts) {
      expect(count.request.params.get('programId')).toBe('2');
      count.flush(
        envelopeOk({
          items: [],
          page: 0,
          size: 1,
          totalPages: 0,
          totalElements: 0,
        }),
      );
    }
    const questions = backend.expectOne((r) => r.url === '/api/v1/questions');
    expect(questions.request.params.get('programId')).toBe('2');
    expect(questions.request.params.has('courseId')).toBe(false);
    questions.flush(
      envelopeOk({
        items: [
          {
            id: 11,
            code: 'P2-Q1',
            programId: 2,
            courseId: null,
            lessonId: null,
            competencyId: 1,
            competencyName: 'Năng lực',
            questionType: 'SINGLE',
            contentPreview: 'Câu hỏi',
            difficulty: 'EASY',
            points: 1,
            status: 'ACTIVE',
            contentVersion: 1,
            optionCount: 2,
            correctCount: 1,
            usedInQuizCount: 0,
            rowVersion: 0,
            updateTime: null,
          },
        ],
        page: 0,
        size: 20,
        totalPages: 1,
        totalElements: 1,
      }),
    );
    TestBed.tick();
    expect(store.questionRows$()[0]).toMatchObject({
      programId: 2,
      correctCount: 1,
    });
  });
  it('searches all catalogue pages locally without sending an unsupported q filter', () => {
    fakeSession().user.set(seedProfile('000002'));
    request().flush(envelopeOk(page(1, 0, 2)));
    request(1, 1).flush(envelopeOk(page(2, 1, 2)));
    TestBed.tick();
    store.searchPrograms('P2');
    TestBed.tick();
    expect(store.programs$()?.items.map((p) => p.id)).toEqual([2]);
    expect(store.selectedProgramId$()).toBe(2);
    backend.expectNone(
      (r) => r.url === trainingCatalogEndpoints.listPrograms.path,
    );
  });
  it('waits for the session org and reloads its catalogue when the org changes', () => {
    TestBed.tick();
    for (const req of backend.match((r) => r.url === '/api/v1/competencies'))
      req.flush(envelopeOk([]));
    backend.expectNone(() => true);
    const profile = seedProfile('000002');
    if (!profile.org) throw Error('Fixture org missing');
    fakeSession().user.set(profile);
    request().flush(envelopeOk(page(2)));
    TestBed.tick();
    fakeSession().user.set({ ...profile, org: { ...profile.org, id: 2 } });
    request(2).flush(envelopeOk(page(5, 0, 1, 2)));
    TestBed.tick();
    expect(store.programs$()?.items.map((p) => p.id)).toEqual([5]);
    expect(store.selectedProgramId$()).toBe(2);
    expect(store.bankProgramMissing$()?.id).toBe(2);
  });
});
