import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  scormEndpoints,
  assessmentV1Endpoints,
  assetEndpoints,
  courseEndpoints,
  courseJobEndpoints,
  knowledgeEndpoints,
  programAssessmentEndpoints,
  trainingCatalogEndpoints,
  MEDIA_PROCESSING_UNAVAILABLE_CODE,
  type AnyEndpoint,
  type CreateCourseCommand,
  type SaveDraftCommand,
} from '@lms/contracts';
import {
  ARCHITECTURE_VIDEO,
  backendRefusal,
  envelopeError,
  envelopeOk,
  type FakeReply,
  type FakeRequest,
} from '@lms/mocks';
import { NEVER, of } from 'rxjs';
import { LeavePrompt } from '../../../core/routing/unsaved-changes.guard';
import { BackgroundUploads } from '../../../core/uploads/background-uploads';
import {
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';
import { setUpAdminScreen } from '../../../core/dev/mock-api/admin-screen.testing';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import { DEFAULT_COURSE_COVER } from '../../../shared/course/course-card';
import { CourseFormPrefillStore } from '../../../core/assistant/course-form-prefill.store';
import { Toaster } from '@lms/ui';
import { KeptDrafts } from '../../../core/session/kept-drafts';
import { CourseEditor, KEPT_DRAFT_TITLE, RESTORE_LABEL } from './course-editor';
import { POLL_MS, SERVER_RETRY_MS } from './data-access/chunked-upload';
import { digestOf, FakeHasher } from './data-access/fake-hasher.testing';
import { KeptUploads } from './data-access/kept-uploads.storage';
import { Sha256Hasher } from './data-access/sha256-hasher';

const KEPT_KEY = 'lms.asset-uploads.v1.000002.6';

describe('CourseEditor', () => {
  const hasher = new FakeHasher();
  const screen = setUpAdminScreen([
    { provide: Sha256Hasher, useValue: hasher },
  ]);
  const step = (label: string) =>
    screen.click(
      Array.from(
        screen.el.querySelectorAll<HTMLElement>('.stepper__step'),
      ).find((s) => s.textContent?.includes(label)),
    );
  async function addTextLesson() {
    await screen.click(screen.button('Thêm chương'));
    await screen.click(screen.button('Thêm bài học'));
    const drawer = screen.drawer()!;
    await screen.type(
      screen.field('Tên bài học', drawer) as HTMLInputElement,
      'Bài đầu tiên',
    );
    await screen.click(screen.button('Văn bản', drawer));
    const editor = drawer.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    )!;
    editor.textContent = 'Nội dung bài đầu tiên.';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await screen.click(screen.button('Lưu', drawer));
  }
  /** The edit button of the outline row whose lesson is called `title`. */
  const editLessonButton = (title: string) =>
    Array.from(screen.el.querySelectorAll<HTMLElement>('ui-sortable-item'))
      .find((row) => row.textContent?.includes(title))
      ?.querySelector<HTMLButtonElement>('button[aria-label="Sửa bài học"]') ??
    undefined;
  const currentStep = () =>
    screen.el.querySelector('.stepper__step[aria-current="step"]')
      ?.textContent ?? '';
  /** The labels of the steps that show ✓. */
  const doneSteps = () =>
    Array.from(
      screen.el.querySelectorAll('.stepper__step.is-done .stepper__title'),
    ).map((title) => title.textContent?.trim());

  describe('the pinned footer', () => {
    /** Records what the bottom-bar directive observes. */
    const observed: Element[] = [];
    class RecordingObserver {
      observe = (el: Element) => void observed.push(el);
      disconnect = vi.fn();
    }
    beforeEach(() => {
      observed.length = 0;
      vi.stubGlobal('ResizeObserver', RecordingObserver);
    });
    afterEach(() => vi.unstubAllGlobals());

    it.each([
      ['create', '/admin/courses/new'],
      ['edit', '/admin/courses/6/edit'],
    ])('reports its height as the bottom inset in %s mode', async (_, url) => {
      await screen.open(url);
      const foot = screen.el.querySelector('footer.course-editor__foot');
      expect(foot).not.toBeNull();
      expect(observed).toContain(foot);
    });
  });

  it('shows a published course read-only until the author opens a draft', async () => {
    await screen.open('/admin/courses/1/edit');

    expect(screen.text()).toContain('Đây là bản đang xuất bản');
    expect(
      screen.el.querySelector<HTMLFieldSetElement>(
        'fieldset.course-editor__body',
      )?.disabled,
    ).toBe(true);
    expect(screen.button('Lưu nháp')).toBeUndefined();

    await screen.click(screen.button('Mở bản nháp để sửa'));

    expect(screen.lastCall(courseEndpoints.openDraft)?.params).toEqual({
      courseId: '1',
    });
    expect(screen.text()).not.toContain('Đây là bản đang xuất bản');
    expect(screen.button('Lưu nháp')).toBeTruthy();
  });

  describe('a published revision', () => {
    /** Every edit control by its text or `aria-label`. */
    const editControls =
      /Sửa\b|Thêm bài học|Thêm chương|Thêm mục tiêu|Xóa|Chuyển lên|Chuyển xuống|Kéo|Thay ảnh|Chọn từ thư viện|Gỡ ảnh/;
    const controls = () =>
      Array.from(
        screen.el.querySelectorAll<HTMLElement>(
          '.course-editor__body button, .course-editor__body [role="button"], .course-editor__body [cdkDragHandle]',
        ),
      ).map(
        (b) => `${b.textContent?.trim()} ${b.getAttribute('aria-label') ?? ''}`,
      );

    it('renders no edit control in its steps, and keeps its values in sight', async () => {
      await screen.open('/admin/courses/1/edit');
      expect(controls().filter((name) => editControls.test(name))).toEqual([]);
      expect(screen.field('Tên khóa học')).toBeTruthy();
      expect(screen.el.querySelector('input[type="file"]')).toBeNull();
      expect(screen.el.querySelector('[uiDropzone]')).toBeNull();
      expect(screen.el.querySelector('app-course-card')).toBeTruthy();

      await step('Nội dung khóa học');
      expect(controls().filter((name) => editControls.test(name))).toEqual([]);
      expect(
        screen.el.querySelector('[uiSortableList], ui-sortable-item'),
      ).toBeNull();
      expect(
        screen.el.querySelectorAll('.course-outline__lesson-title').length,
      ).toBeGreaterThan(0);
      expect(
        screen.el.querySelector('.course-outline__chapter-name')?.textContent,
      ).toBeTruthy();

      await step('Bài kiểm tra & điều kiện');
      expect(controls().filter((name) => editControls.test(name))).toEqual([]);
    });

    it('keeps only "Quay lại" and "Tiếp theo" in the footer', async () => {
      await screen.open('/admin/courses/1/edit');
      await step('Nội dung khóa học');
      const footer = screen.el.querySelector('footer.course-editor__foot')!;
      expect(
        Array.from(footer.querySelectorAll('button, a')).map((b) =>
          b.textContent?.trim(),
        ),
      ).toEqual(['Quay lại', 'Tiếp theo']);
    });

    it('shows the edit controls again once the draft is open', async () => {
      await screen.open('/admin/courses/1/edit');
      await screen.click(screen.button('Mở bản nháp để sửa'));
      await step('Nội dung khóa học');
      expect(screen.button('Thêm chương')).toBeTruthy();
      expect(screen.button('Thêm bài học')).toBeTruthy();
    });
  });

  it('offers SCORM alongside manual content without replacing manual authoring', async () => {
    const backend = TestBed.inject(MockBackend);
    screen.calls.mockImplementation((endpoint, request) =>
      endpoint === scormEndpoints.list
        ? {
            status: 200,
            body: envelopeOk({
              items: [],
              page: 0,
              size: 100,
              totalElements: 0,
              totalPages: 0,
            }),
          }
        : MockBackend.prototype.handle.call(backend, endpoint, request),
    );
    await screen.open('/admin/courses/6/edit');
    await step('Nội dung khóa học');
    await screen.click(screen.button('Thêm bài học'));
    const drawer = screen.drawer()!;
    const kind = screen.field('Loại bài', drawer) as HTMLSelectElement;
    expect(Array.from(kind.options).map((option) => option.value)).toEqual([
      'content',
      'quiz',
      'scorm',
    ]);
    expect(screen.button('Văn bản', drawer)).toBeTruthy();
    await screen.choose(kind, 'scorm');
    expect(screen.callsTo(scormEndpoints.list)).toBe(0);
    expect(drawer.textContent).toContain('Kéo thả hoặc chọn tệp ZIP SCORM');
    expect(drawer.textContent).not.toContain('Tìm gói SCORM');
    await screen.click(screen.button('Chọn từ thư viện bài giảng', drawer));
    expect(
      drawer.querySelector(
        'ui-search-select button[aria-label="Bài giảng trong thư viện"]',
      ),
    ).toBeTruthy();
    expect(screen.button('Tải lại thư viện', drawer)).toBeUndefined();
    expect(drawer.querySelector('input[type="search"]')).toBeNull();
    expect(screen.callsTo(scormEndpoints.list)).toBe(1);
    expect(screen.button('Văn bản', drawer)).toBeUndefined();
    await screen.choose(kind, 'content');
    expect(screen.button('Văn bản', drawer)).toBeTruthy();
  });

  it('loads every SCORM library page and searches within its dropdown', async () => {
    const backend = TestBed.inject(MockBackend);
    const lecture = (id: number) => ({
      id,
      ownerOrgId: 1,
      title: id === 101 ? 'Bài trang cuối' : `Bài ${id}`,
      originalName: 'bai-hoc.zip',
      sizeBytes: 1024,
      fileCount: 3,
      scormVersion: '1.2',
      published: true,
      canManage: true,
      rowVersion: 0,
      createTime: '2026-11-13T10:00:00Z',
      warnings: [],
      progress: {
        lessonStatus: 'not attempted',
        scoreRaw: null,
        scoreMin: null,
        scoreMax: null,
        lessonLocation: '',
        resumable: false,
        updateTime: null,
      },
    });
    screen.calls.mockImplementation((endpoint, request) =>
      endpoint === scormEndpoints.list
        ? {
            status: 200,
            body: envelopeOk({
              page: Number(request.query?.['page'] ?? 0),
              size: 100,
              totalPages: 2,
              totalElements: 101,
              items:
                Number(request.query?.['page'] ?? 0) === 0
                  ? Array.from({ length: 100 }, (_, i) => lecture(i + 1))
                  : [lecture(101)],
            }),
          }
        : MockBackend.prototype.handle.call(backend, endpoint, request),
    );
    await screen.open('/admin/courses/6/edit');
    await step('Nội dung khóa học');
    await screen.click(screen.button('Thêm bài học'));
    const drawer = screen.drawer()!;
    await screen.choose(
      screen.field('Loại bài', drawer) as HTMLSelectElement,
      'scorm',
    );
    await screen.click(screen.button('Chọn từ thư viện bài giảng', drawer));
    await vi.waitFor(() => expect(screen.callsTo(scormEndpoints.list)).toBe(2));
    const trigger = drawer.querySelector<HTMLButtonElement>(
      'ui-search-select button',
    )!;
    await screen.click(trigger);
    const search = document.querySelector<HTMLInputElement>(
      '.search-select__panel input',
    )!;
    await screen.type(search, 'trang cuoi');
    const options = document.querySelectorAll<HTMLElement>(
      '.search-select__option',
    );
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain('Bài trang cuối');
    await screen.click(options[0]);
    expect(trigger.textContent).toContain('Bài trang cuối');
    expect(screen.button('Tải lại thư viện', drawer)).toBeUndefined();
    expect(screen.button('Trang sau', drawer)).toBeUndefined();
  });

  it('imports a SCORM ZIP directly into the lesson without leaving the course editor', async () => {
    const backend = TestBed.inject(MockBackend);
    const lecture = {
      id: 42,
      ownerOrgId: 1,
      title: 'Bài tương tác nhập trực tiếp',
      originalName: 'bai-hoc.zip',
      sizeBytes: 1024,
      fileCount: 3,
      scormVersion: '1.2',
      published: false,
      canManage: true,
      rowVersion: 0,
      createTime: '2026-11-13T10:00:00Z',
      warnings: [],
      progress: {
        lessonStatus: 'not attempted',
        scoreRaw: null,
        scoreMin: null,
        scoreMax: null,
        lessonLocation: '',
        resumable: false,
        updateTime: null,
      },
    };
    screen.calls.mockImplementation((endpoint, request) =>
      endpoint === scormEndpoints.upload
        ? { status: 200, body: envelopeOk(lecture) }
        : MockBackend.prototype.handle.call(backend, endpoint, request),
    );
    await screen.open('/admin/courses/6/edit');
    await step('Nội dung khóa học');
    await screen.click(screen.button('Thêm bài học'));
    const drawer = screen.drawer();
    if (!drawer) throw new Error('Lesson drawer missing');
    await screen.choose(
      screen.field('Loại bài', drawer) as HTMLSelectElement,
      'scorm',
    );
    const input = drawer.querySelector<HTMLInputElement>(
      'input[type="file"][accept=".zip,application/zip"]',
    );
    if (!input) throw new Error('SCORM ZIP input missing');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['sample'], 'bai-hoc.zip', { type: 'application/zip' })],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await screen.settle();
    expect(screen.callsTo(scormEndpoints.upload)).toBe(1);
    expect(screen.callsTo(scormEndpoints.list)).toBe(0);
    expect(drawer.textContent).toContain(
      'Đã gắn: Bài tương tác nhập trực tiếp',
    );
    expect(
      drawer.querySelector<HTMLInputElement>('input[type="hidden"]')?.value,
    ).toBe('42');
    expect(TestBed.inject(Router).url).toBe('/admin/courses/6/edit');
  });

  it('saves the whole draft with the revision version, then reads it again', async () => {
    await screen.open('/admin/courses/6/edit');
    const title = screen.field('Tên khóa học') as HTMLInputElement;
    expect(title.value).toBe('An toàn thông tin cho cán bộ CNTT');

    await screen.type(title, 'An toàn thông tin 2026');
    expect(screen.text()).toContain('Có thay đổi chưa lưu');
    await screen.click(screen.button('Lưu nháp'));

    const call = screen.lastCall(courseEndpoints.saveDraft);
    expect(call?.params).toEqual({ courseId: '6', revisionId: '600' });
    expect(call?.body).toMatchObject({
      expectedVersion: 0,
      title: 'An toàn thông tin 2026',
      programId: 4,
      defaultRequirement: 'optional',
      chapters: [
        {
          title: 'Nguyên tắc cơ bản',
          lessons: [
            expect.objectContaining({ title: 'Nguyên tắc quyền tối thiểu' }),
          ],
        },
      ],
    });
    expect(screen.text()).toContain('Đã lưu nháp lúc');
    expect(screen.text()).not.toContain('Có thay đổi chưa lưu');
    expect((screen.field('Tên khóa học') as HTMLInputElement).value).toBe(
      'An toàn thông tin 2026',
    );
  });

  it('reports unsaved changes until they are saved', async () => {
    await screen.open('/admin/courses/6/edit');
    const page = screen.page<CourseEditor>();
    expect(page.hasUnsavedChanges()).toBe(false);

    await screen.type(screen.field('Tên khóa học') as HTMLInputElement, 'Mới');
    expect(page.hasUnsavedChanges()).toBe(true);

    await screen.click(screen.button('Lưu nháp'));
    expect(page.hasUnsavedChanges()).toBe(false);
  });

  it('keeps unsaved edits when the session ends and offers them back after sign-in', async () => {
    sessionStorage.clear();
    await screen.open('/admin/courses/6/edit');
    await screen.type(screen.field('Tên khóa học') as HTMLInputElement, 'Mới');

    // What SessionExpiry does on a 401: keep the draft, forget the user, go to sign-in.
    TestBed.inject(KeptDrafts).keepAll();
    fakeSession().user.set(null);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/login');
    await screen.settle();
    fakeSession().user.set(seedProfile('000002'));
    await router.navigateByUrl('/admin/courses/6/edit');
    await screen.settle();
    const page = screen.page<CourseEditor>();
    expect(page.hasUnsavedChanges()).toBe(false);
    const offer = TestBed.inject(Toaster)
      .toasts()
      .find((toast) => toast.title === KEPT_DRAFT_TITLE);
    expect(offer?.action?.label).toBe(RESTORE_LABEL);

    TestBed.inject(Toaster).act(offer?.id ?? 0);
    await screen.settle();
    expect((screen.field('Tên khóa học') as HTMLInputElement).value).toBe(
      'Mới',
    );
    expect(page.hasUnsavedChanges()).toBe(true);
  });

  it('does not save without a title, and says which step to fix', async () => {
    await screen.open('/admin/courses/6/edit');
    await screen.type(screen.field('Tên khóa học') as HTMLInputElement, '');
    await step('Nội dung khóa học');
    await screen.click(screen.button('Lưu nháp'));

    expect(screen.callsTo(courseEndpoints.saveDraft)).toBe(0);
    expect(screen.text()).toContain(
      'Còn thông tin chưa hợp lệ ở: Thông tin cơ bản',
    );
  });

  it('saves a loaded video block with its chapters and transcript unchanged', async () => {
    await screen.open('/admin/courses/1/edit');
    await screen.click(screen.button('Mở bản nháp để sửa'));
    await step('Nội dung khóa học');
    await screen.click(
      editLessonButton('Kiến trúc tổng thể hệ thống Core Banking'),
    );
    await screen.click(screen.button('Lưu', screen.drawer()!));
    await screen.click(screen.button('Lưu nháp'));

    const { chapters } = screen.lastCall(courseEndpoints.saveDraft)
      ?.body as SaveDraftCommand;
    const video = chapters
      .flatMap((c) => c.lessons)
      .flatMap((l) => l.blocks)
      .find((b) => b.blockType === 'video');
    expect(video?.videoChapters).toEqual(ARCHITECTURE_VIDEO.videoChapters);
    expect(video?.transcript).toEqual(ARCHITECTURE_VIDEO.transcript);
  });

  describe('"Cho phép tua video"', () => {
    const VIDEO_LESSON = 'Kiến trúc tổng thể hệ thống Core Banking';
    const seekingSwitch = () =>
      screen
        .drawer()
        ?.querySelector<HTMLInputElement>('input[role="switch"]') ?? null;
    const sentVideo = () => {
      const { chapters } = screen.lastCall(courseEndpoints.saveDraft)
        ?.body as SaveDraftCommand;
      return chapters
        .flatMap((c) => c.lessons)
        .flatMap((l) => l.blocks)
        .find((b) => b.blockType === 'video');
    };

    it('is off on a loaded video block and is sent as off', async () => {
      await screen.open('/admin/courses/1/edit');
      await screen.click(screen.button('Mở bản nháp để sửa'));
      await step('Nội dung khóa học');
      await screen.click(editLessonButton(VIDEO_LESSON));
      expect(screen.drawer()?.textContent).toContain('Cho phép tua video');
      expect(seekingSwitch()?.checked).toBe(false);
      await screen.click(screen.button('Lưu', screen.drawer()!));
      await screen.click(screen.button('Lưu nháp'));
      expect(sentVideo()?.allowSeeking).toBe(false);
    });

    it('is saved when switched on and still on when the lesson is reopened', async () => {
      await screen.open('/admin/courses/1/edit');
      await screen.click(screen.button('Mở bản nháp để sửa'));
      await step('Nội dung khóa học');
      await screen.click(editLessonButton(VIDEO_LESSON));
      await screen.click(seekingSwitch()!);
      expect(seekingSwitch()?.checked).toBe(true);
      await screen.click(screen.button('Lưu', screen.drawer()!));
      await screen.click(screen.button('Lưu nháp'));
      expect(sentVideo()?.allowSeeking).toBe(true);

      await screen.click(editLessonButton(VIDEO_LESSON));
      expect(seekingSwitch()?.checked).toBe(true);
    });

    it('is not offered on a block that is not a video, and a new video block starts off', async () => {
      await screen.open('/admin/courses/6/edit');
      await step('Nội dung khóa học');
      await screen.click(screen.button('Thêm chương'));
      await screen.click(screen.button('Thêm bài học'));
      const drawer = screen.drawer()!;
      await screen.click(screen.button('Văn bản', drawer));
      expect(seekingSwitch()).toBeNull();
      await screen.click(screen.button('Video', drawer));
      expect(seekingSwitch()?.checked).toBe(false);
    });
  });

  it('focuses the new chapter’s title, labelled with its number, after "Thêm chương"', async () => {
    await screen.open('/admin/courses/6/edit');
    await step('Nội dung khóa học');
    await screen.click(screen.button('Thêm chương'));

    const titles = Array.from(
      screen.el.querySelectorAll<HTMLInputElement>(
        'input.course-outline__chapter-title',
      ),
    );
    expect(titles.map((t) => t.getAttribute('aria-label'))).toEqual([
      'Tên chương 1',
      'Tên chương 2',
    ]);
    expect(document.activeElement).toBe(titles[1]);
    expect(titles[1].disabled).toBe(false);
  });

  it('removes the selected block immediately and retains other blocks through reordering and saving', async () => {
    await screen.open('/admin/courses/6/edit');
    await step('Nội dung khóa học');
    await screen.click(screen.button('Thêm bài học'));
    const drawer = screen.drawer()!;
    const blocks = () =>
      Array.from(drawer.querySelectorAll<HTMLElement>('.lesson-form__block'));
    for (const title of ['Văn bản A', 'Văn bản B', 'Văn bản C']) {
      await screen.click(screen.button(/^\s*Văn bản\s*$/, drawer));
      const block = blocks().at(-1)!;
      await screen.type(
        screen.field('Tiêu đề khối', block) as HTMLInputElement,
        title,
      );
      const editor = block.querySelector<HTMLElement>(
        '[contenteditable="true"]',
      )!;
      editor.innerHTML = `<p>Nội dung ${title}</p>`;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      await screen.settle();
    }
    await screen.click(screen.button('Xóa khối Văn bản B', drawer));
    expect(blocks()).toHaveLength(2);
    expect(
      blocks().map(
        (block) =>
          (screen.field('Tiêu đề khối', block) as HTMLInputElement).value,
      ),
    ).toEqual(['Văn bản A', 'Văn bản C']);
    expect(
      blocks()[1].querySelector('[contenteditable="true"]')?.textContent,
    ).toBe('Nội dung Văn bản C');
    await screen.click(screen.button('Chuyển khối lên', blocks()[1]));
    expect(
      (screen.field('Tiêu đề khối', blocks()[0]) as HTMLInputElement).value,
    ).toBe('Văn bản C');
    await screen.click(screen.button('Xóa khối Văn bản C', drawer));
    expect(blocks()).toHaveLength(1);
    expect(
      blocks()[0].querySelector('[contenteditable="true"]')?.textContent,
    ).toBe('Nội dung Văn bản A');
    await screen.click(screen.button('Lưu', drawer));
    await screen.click(screen.button('Lưu nháp'));
    const saved = screen.lastCall(courseEndpoints.saveDraft)
      ?.body as SaveDraftCommand;
    const added = saved.chapters[0].lessons.at(-1)!;
    expect(added.blocks).toHaveLength(1);
    expect(added.blocks[0]).toMatchObject({
      title: 'Văn bản A',
      body: '<p>Nội dung Văn bản A</p>',
      bodyFormat: 'html',
    });
  });

  it('links the program select to the catalogue in a new tab and reloads the list', async () => {
    await screen.open('/admin/courses/new');
    const manage = Array.from(
      screen.el.querySelectorAll<HTMLAnchorElement>('a'),
    ).find((a) => a.textContent?.trim() === 'Quản lý chương trình');
    expect(manage?.getAttribute('href')).toBe('/admin/catalog');
    expect(manage?.target).toBe('_blank');

    const before = screen.callsTo(trainingCatalogEndpoints.listPrograms);
    await screen.click(screen.button('Tải lại danh sách'));
    expect(screen.callsTo(trainingCatalogEndpoints.listPrograms)).toBe(
      before + 1,
    );
  });

  it('explains the step-by-step block with a hint and two sample lines', async () => {
    await screen.open('/admin/courses/6/edit');
    await step('Nội dung khóa học');
    await screen.click(screen.button('Thêm chương'));
    const addLesson = Array.from(
      screen.el.querySelectorAll<HTMLButtonElement>('button'),
    ).filter((b) => b.textContent?.includes('Thêm bài học'));
    await screen.click(addLesson[1]);
    const drawer = screen.drawer()!;
    await screen.click(screen.button('Quy trình từng bước', drawer));

    const steps = screen.field(
      'Các bước (mỗi dòng: Tiêu đề | Mô tả)',
      drawer,
    ) as HTMLTextAreaElement;
    expect(screen.text(drawer)).toContain(
      'học viên thấy các bước đánh số theo thứ tự',
    );
    expect(steps.placeholder.split('\n')).toHaveLength(2);
  });

  it('adds a chapter and a lesson with a text block, then saves them', async () => {
    await screen.open('/admin/courses/6/edit');
    await step('Nội dung khóa học');
    await screen.click(screen.button('Thêm chương'));
    expect(screen.text()).toContain('2 chương');

    const addLesson = Array.from(
      screen.el.querySelectorAll<HTMLButtonElement>('button'),
    ).filter((b) => b.textContent?.includes('Thêm bài học'));
    await screen.click(addLesson[1]);

    const drawer = screen.drawer()!;
    expect(screen.text(drawer)).toContain('Soạn bài học');
    await screen.type(
      screen.field('Tên bài học', drawer) as HTMLInputElement,
      'Phân quyền theo vai trò',
    );
    await screen.click(screen.button('Văn bản', drawer));
    const editor = drawer.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    )!;
    editor.innerHTML = '<h2>Vai trò</h2><p><strong>Phân quyền</strong></p>';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await screen.click(screen.button('Lưu', drawer));

    expect(screen.drawer()).toBeNull();
    expect(screen.text()).toContain('Phân quyền theo vai trò');
    await screen.click(screen.button('Lưu nháp'));

    const { chapters } = screen.lastCall(courseEndpoints.saveDraft)
      ?.body as SaveDraftCommand;
    expect(chapters[1]).toEqual({
      title: 'Chương 2',
      lessons: [
        {
          title: 'Phân quyền theo vai trò',
          lessonType: 'content',
          estimatedDurationSeconds: 600,
          isRequired: true,
          blocks: [
            {
              blockType: 'text',
              title: 'Văn bản',
              body: '<h2>Vai trò</h2><p><strong>Phân quyền</strong></p>',
              bodyFormat: 'html',
              completionMode: 'manual',
              isRequired: true,
              assets: [],
              steps: [],
            },
          ],
        },
      ],
    });
  });

  describe('files', () => {
    const pdf = (name = 'quyen.pdf') =>
      new File(['%PDF-1.4 /Type /Page'], name, { type: 'application/pdf' });
    const original = (endpoint: AnyEndpoint, request: FakeRequest): FakeReply =>
      MockBackend.prototype.handle.call(
        TestBed.inject(MockBackend),
        endpoint,
        request,
      ) as FakeReply;
    const offline = (): FakeReply => ({
      status: 0,
      body: envelopeError('CORE-OFFLINE', 'Offline', 'offline'),
    });
    const kept = () => JSON.parse(localStorage.getItem(KEPT_KEY) ?? '[]');
    const uploaded = () => screen.text(screen.drawer()!);

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
      localStorage.clear();
    });

    /** The file inputs of the dropzones in the open lesson, one per file block. */
    const dropzones = () =>
      Array.from(
        screen
          .drawer()!
          .querySelectorAll<HTMLInputElement>(
            'label.dropzone input[type=file]',
          ),
      );
    const pick = (input: HTMLInputElement, file: File) => {
      Object.defineProperty(input, 'files', {
        value: [file],
        configurable: true,
      });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    /** Runs the upload's own timers (the polls) on fake time. */
    const advance = async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms);
      TestBed.tick();
    };
    const openLesson = async () => {
      await step('Nội dung khóa học');
      await screen.click(screen.button('Sửa bài học'));
      return screen.drawer()!;
    };
    const failParts = () =>
      screen.calls.mockImplementation((e, r) =>
        e === assetEndpoints.uploadPart ? offline() : original(e, r),
      );

    /** A saved attachment block whose upload the network cut short, then the editor opened again. */
    async function interruptedAttachment() {
      await screen.open('/admin/courses/6/edit');
      const drawer = await openLesson();
      await screen.click(screen.button('Tệp đính kèm', drawer));
      await screen.click(screen.button('Lưu', drawer));
      await screen.click(screen.button('Lưu nháp'));
      await screen.click(screen.button('Sửa bài học'));

      failParts();
      vi.useFakeTimers();
      pick(dropzones().at(-1)!, pdf());
      await advance(100);
      vi.useRealTimers();
      expect(uploaded()).toContain('Mất kết nối, sẽ tiếp tục khi có mạng.');
      expect(kept()).toHaveLength(1);

      const router = TestBed.inject(Router);
      await router.navigateByUrl('/admin/courses');
      await screen.settle();
      await router.navigateByUrl('/admin/courses/6/edit');
      await screen.settle();
      screen.calls.mockImplementation(original);
      await openLesson();
    }

    it('needs the file of a PDF block, uploads it in parts and attaches it to the block', async () => {
      await screen.open('/admin/courses/6/edit');
      const drawer = await openLesson();
      await screen.click(screen.button('Tài liệu PDF', drawer));
      await screen.click(screen.button('Lưu', drawer));

      expect(screen.drawer()).not.toBeNull();
      expect(screen.text(drawer)).toContain('chưa có tệp');

      const file = pdf();
      vi.useFakeTimers();
      pick(dropzones().at(-1)!, file);
      await advance(POLL_MS * 3);
      vi.useRealTimers();
      await screen.settle();

      expect(screen.lastCall(assetEndpoints.startUpload)?.body).toMatchObject({
        ownerOrgId: 1,
        originalName: 'quyen.pdf',
        mimeType: 'application/pdf',
        sizeBytes: file.size,
        checksumSha256: digestOf(file.size),
      });
      expect(screen.callsTo(assetEndpoints.uploadPart)).toBe(1);
      expect(screen.lastCall(assetEndpoints.uploadPart)?.headers).toEqual({
        'X-Part-SHA256': digestOf(file.size),
      });
      expect(screen.callsTo(assetEndpoints.completeUpload)).toBe(1);
      expect(screen.text(drawer)).toContain('quyen.pdf');
      expect(screen.text(drawer)).not.toContain('Đang xử lý tệp');
      expect(screen.text(document.body)).toContain('Tải lên thành công');
      expect(kept()).toEqual([]);

      await screen.click(screen.button('Lưu', drawer));
      await screen.click(screen.button('Lưu nháp'));

      const saved = screen.lastCall(courseEndpoints.saveDraft)
        ?.body as SaveDraftCommand;
      expect(saved.chapters[0].lessons[0].blocks[1]).toMatchObject({
        blockType: 'pdf',
        completionMode: 'pdf_end',
        assets: [{ assetId: expect.any(Number), usage: 'primary' }],
      });
    });

    it('replaces the attachment dropzone with a compact add action and retains successive uploads', async () => {
      await screen.open('/admin/courses/6/edit');
      const drawer = await openLesson();
      await screen.click(screen.button('Tệp đính kèm', drawer));
      const block = drawer
        .querySelectorAll<HTMLElement>('.lesson-form__block')
        .item(1);
      vi.useFakeTimers();
      pick(dropzones().at(-1)!, pdf('dinh-kem-mot.pdf'));
      await advance(POLL_MS * 3);
      vi.useRealTimers();
      await screen.settle();
      expect(block.querySelector('[uiDropzone]')).toBeNull();
      expect(screen.button('Thêm tệp đính kèm', block)).toBeTruthy();
      expect(screen.text(block)).toContain('dinh-kem-mot.pdf');
      const second = new File(
        ['%PDF-1.4 /Type /Page\nsecond attachment'],
        'dinh-kem-hai.pdf',
        { type: 'application/pdf' },
      );
      vi.useFakeTimers();
      pick(block.querySelector<HTMLInputElement>('input[type=file]')!, second);
      await advance(POLL_MS * 3);
      vi.useRealTimers();
      await screen.settle();
      expect(block.querySelector('[uiDropzone]')).toBeNull();
      expect(screen.text(block)).toContain('dinh-kem-mot.pdf');
      expect(screen.text(block)).toContain('dinh-kem-hai.pdf');
      await screen.click(screen.button('Lưu', drawer));
      await screen.click(screen.button('Lưu nháp'));
      const saved = screen.lastCall(courseEndpoints.saveDraft)
        ?.body as SaveDraftCommand;
      expect(saved.chapters[0].lessons[0].blocks[1].assets).toHaveLength(2);
    });

    it('refuses a file of the wrong type before uploading', async () => {
      await screen.open('/admin/courses/6/edit');
      const drawer = await openLesson();
      await screen.click(screen.button('Video', drawer));
      pick(
        dropzones().at(-1)!,
        new File(['x'], 'bai.exe', { type: 'application/octet-stream' }),
      );
      await screen.settle();

      expect(screen.text(drawer)).toContain(
        'Sai định dạng: chỉ chấp nhận MP4, WEBM.',
      );
      expect(screen.button('Chọn tệp khác', drawer)).toBeTruthy();
      expect(screen.callsTo(assetEndpoints.startUpload)).toBe(0);
    });

    describe('the cover image', () => {
      const cover = () =>
        screen.el.querySelector<HTMLInputElement>(
          '.course-info__cover label.dropzone input[type=file]',
        )!;
      const cardImage = () =>
        screen.el.querySelector<HTMLImageElement>('.course-card__cover');

      const original = {
        create: URL.createObjectURL,
        revoke: URL.revokeObjectURL,
      };
      const revoked: string[] = [];
      beforeEach(() => {
        let next = 0;
        revoked.length = 0;
        URL.createObjectURL = vi.fn(() => `blob:cover-${++next}`);
        URL.revokeObjectURL = vi.fn((url: string) => void revoked.push(url));
      });
      afterEach(() => {
        URL.createObjectURL = original.create;
        URL.revokeObjectURL = original.revoke;
      });

      it('uploads an image, shows it on the card and saves it with the draft, until it is removed', async () => {
        await screen.open('/admin/courses/6/edit');
        expect(cardImage()?.getAttribute('src')).toBe(DEFAULT_COURSE_COVER);

        const file = new File(['png'], 'bia.png', { type: 'image/png' });
        vi.useFakeTimers();
        pick(cover(), file);
        await advance(POLL_MS * 3);
        vi.useRealTimers();
        await screen.settle();

        expect(screen.lastCall(assetEndpoints.startUpload)?.body).toMatchObject(
          { originalName: 'bia.png', mimeType: 'image/png' },
        );
        expect(kept()).toEqual([]);
        // Read with the token, not by the `<img>`: an author holds no media cookie.
        const read = screen.lastCall(courseEndpoints.getAssetContent);
        expect(read?.query).toEqual({});
        expect(cardImage()?.getAttribute('src')).toBe('blob:cover-1');
        expect(cardImage()?.alt).toBe('');
        expect(screen.text()).toContain('Có thay đổi chưa lưu');

        await screen.click(screen.button('Lưu nháp'));
        const assetId = Number(read?.params['assetId']);
        expect(
          (screen.lastCall(courseEndpoints.saveDraft)?.body as SaveDraftCommand)
            .coverAssetId,
        ).toBe(assetId);
        expect(screen.text()).not.toContain('Có thay đổi chưa lưu');

        expect(screen.button('Thay ảnh')).toBeTruthy();
        expect(cover()).toBeNull();

        await screen.click(screen.button('Gỡ ảnh'));
        expect(cardImage()?.getAttribute('src')).toBe(DEFAULT_COURSE_COVER);
        expect(revoked).toContain('blob:cover-1');
        await screen.click(screen.button('Lưu nháp'));
        expect(
          screen.lastCall(courseEndpoints.saveDraft)?.body,
        ).not.toHaveProperty('coverAssetId');
      });

      it('refuses a file that is not an image before uploading', async () => {
        await screen.open('/admin/courses/6/edit');
        pick(cover(), pdf());
        await screen.settle();

        expect(screen.text()).toContain(
          'Sai định dạng: chỉ chấp nhận PNG, JPG, JPEG, WEBP.',
        );
        expect(screen.callsTo(assetEndpoints.startUpload)).toBe(0);
        expect(cardImage()?.getAttribute('src')).toBe(DEFAULT_COURSE_COVER);
      });
    });

    it('cancels a file while it is being checked, without touching the server', async () => {
      vi.spyOn(hasher, 'hash').mockReturnValue(NEVER);
      await screen.open('/admin/courses/6/edit');
      const drawer = await openLesson();
      await screen.click(screen.button('Tài liệu PDF', drawer));
      pick(dropzones().at(-1)!, pdf());
      await screen.settle();

      expect(screen.text(drawer)).toContain('Đang kiểm tra tệp… 0%');

      await screen.click(screen.button('Hủy', drawer));
      expect(screen.text(drawer)).not.toContain('quyen.pdf');
      expect(screen.callsTo(assetEndpoints.startUpload)).toBe(0);
      expect(screen.callsTo(assetEndpoints.cancelUpload)).toBe(0);
    });

    it('pauses without a network and cancels the upload on the server', async () => {
      await screen.open('/admin/courses/6/edit');
      const drawer = await openLesson();
      await screen.click(screen.button('Tài liệu PDF', drawer));
      failParts();
      vi.useFakeTimers();
      pick(dropzones().at(-1)!, pdf());
      await advance(100);
      vi.useRealTimers();

      expect(screen.text(drawer)).toContain(
        'Mất kết nối, sẽ tiếp tục khi có mạng.',
      );
      expect(kept()).toMatchObject([
        { position: '0.0.1', blockType: 'pdf', name: 'quyen.pdf' },
      ]);
      const uploadId = kept()[0].uploadId;

      await screen.click(screen.button('Hủy', drawer));
      expect(screen.lastCall(assetEndpoints.cancelUpload)?.params).toEqual({
        uploadId,
      });
      expect(screen.text(drawer)).not.toContain('quyen.pdf');
      expect(kept()).toEqual([]);
    });

    it('sends nothing more when "Hủy" is pressed offline and the network comes back', async () => {
      await screen.open('/admin/courses/6/edit');
      const drawer = await openLesson();
      await screen.click(screen.button('Tài liệu PDF', drawer));
      failParts();
      vi.useFakeTimers();
      pick(dropzones().at(-1)!, pdf());
      await advance(100);
      expect(screen.text(drawer)).toContain(
        'Mất kết nối, sẽ tiếp tục khi có mạng.',
      );
      const sent = screen.callsTo(assetEndpoints.uploadPart);

      screen.button('Hủy', drawer)!.click();
      TestBed.tick();
      screen.calls.mockImplementation(original);
      await advance(SERVER_RETRY_MS * 4);
      vi.useRealTimers();

      expect(screen.callsTo(assetEndpoints.uploadPart)).toBe(sent);
      expect(screen.callsTo(assetEndpoints.uploadStatus)).toBe(0);
      expect(screen.callsTo(assetEndpoints.completeUpload)).toBe(0);
      expect(screen.text(drawer)).not.toContain('quyen.pdf');
    });

    it('shows an upload a reload stopped, refuses another file and continues with the same one', async () => {
      await interruptedAttachment();
      const drawer = screen.drawer()!;
      const { uploadId } = kept()[0];
      expect(screen.text(drawer)).toContain('Tải lên bị gián đoạn');
      expect(screen.text(drawer)).toContain('quyen.pdf');
      const resume = Array.from(
        drawer.querySelectorAll<HTMLInputElement>('input[type=file][hidden]'),
      ).at(-1)!;
      const starts = screen.callsTo(assetEndpoints.startUpload);

      pick(resume, pdf('khac.pdf'));
      await screen.settle();
      expect(screen.text(drawer)).toContain('Tệp không khớp tệp đang tải lên.');
      expect(screen.callsTo(assetEndpoints.startUpload)).toBe(starts);

      vi.useFakeTimers();
      pick(resume, pdf());
      await advance(POLL_MS * 3);
      vi.useRealTimers();
      await screen.settle();

      expect(screen.lastCall(assetEndpoints.startUpload)?.body).toMatchObject({
        requestId: uploadId,
        originalName: 'quyen.pdf',
      });
      expect(screen.text(drawer)).not.toContain('Tải lên bị gián đoạn');
      expect(screen.text(drawer)).toContain('quyen.pdf');
      expect(kept()).toEqual([]);
    });

    it('forgets an interrupted upload when another file is picked for its block', async () => {
      await interruptedAttachment();
      const drawer = screen.drawer()!;
      const { uploadId } = kept()[0];
      const again = Array.from(
        drawer.querySelectorAll<HTMLInputElement>('input[type=file][hidden]'),
      ).at(-2)!;

      vi.useFakeTimers();
      pick(again, pdf('khac.pdf'));
      await advance(POLL_MS * 3);
      vi.useRealTimers();
      await screen.settle();

      expect(screen.lastCall(assetEndpoints.cancelUpload)?.params).toEqual({
        uploadId,
      });
      expect(kept()).toEqual([]);
      expect(screen.text(drawer)).not.toContain('Tải lên bị gián đoạn');
    });

    it('forgets an interrupted upload on "Hủy"', async () => {
      await interruptedAttachment();
      const drawer = screen.drawer()!;
      const { uploadId } = kept()[0];

      await screen.click(screen.button('Hủy', drawer));

      expect(screen.lastCall(assetEndpoints.cancelUpload)?.params).toEqual({
        uploadId,
      });
      expect(screen.text(drawer)).not.toContain('Tải lên bị gián đoạn');
      expect(kept()).toEqual([]);
    });

    it('asks the server to check a file again when it could not run its checks', async () => {
      await screen.open('/admin/courses/6/edit');
      const drawer = await openLesson();
      await screen.click(screen.button('Tài liệu PDF', drawer));
      screen.calls.mockImplementation((e, r): FakeReply => {
        const reply = original(e, r);
        if (e !== assetEndpoints.completeUpload) return reply;
        const body = reply.body as { data: object };
        return {
          ...reply,
          body: {
            ...body,
            data: {
              ...body.data,
              status: 'failed',
              errorCode: MEDIA_PROCESSING_UNAVAILABLE_CODE,
              errorMessage: 'Máy chủ chưa xử lý được tệp.',
            },
          },
        } as FakeReply;
      });
      vi.useFakeTimers();
      pick(dropzones().at(-1)!, pdf());
      await advance(100);
      vi.useRealTimers();
      await screen.settle();
      expect(screen.text(drawer)).toContain('Máy chủ chưa xử lý được tệp.');

      screen.calls.mockImplementation(original);
      vi.useFakeTimers();
      screen.button('Xử lý lại', drawer)!.click();
      await advance(POLL_MS * 3);
      vi.useRealTimers();
      await screen.settle();

      expect(screen.callsTo(assetEndpoints.completeUpload)).toBe(2);
      expect(screen.text(drawer)).not.toContain('Xử lý lại');
      expect(screen.text(document.body)).toContain('Tải lên thành công');
    });
  });

  describe('a quiz lesson', () => {
    const original = (endpoint: AnyEndpoint, request: FakeRequest): FakeReply =>
      MockBackend.prototype.handle.call(
        TestBed.inject(MockBackend),
        endpoint,
        request,
      ) as FakeReply;

    /** The quizzes of course 1 stand in for the ones of the edited course; the first is still a draft. */
    const listQuizzes = () =>
      screen.calls.mockImplementation((endpoint, request) => {
        if (endpoint !== assessmentV1Endpoints.courseQuizList)
          return original(endpoint, request);
        const reply = original(endpoint, {
          ...request,
          query: { ...request.query, courseId: '1' },
        });
        const { items } = reply.body.data as { items: { status: string }[] };
        items[0].status = 'DRAFT';
        return reply;
      });

    /** Adds a lesson to the first chapter and makes it a quiz lesson; the drawer stays open. */
    async function addQuizLesson() {
      await screen.open('/admin/courses/6/edit');
      await step('Nội dung khóa học');
      await screen.click(screen.button('Thêm bài học'));
      const drawer = screen.drawer()!;
      await screen.choose(
        screen.field('Loại bài', drawer) as HTMLSelectElement,
        'quiz',
      );
      return drawer;
    }

    it('lists the quizzes of the course in a select, saying which cannot be published', async () => {
      listQuizzes();
      const drawer = await addQuizLesson();

      expect(
        screen.lastCall(assessmentV1Endpoints.courseQuizList)?.query,
      ).toMatchObject({
        courseId: '6',
      });
      const select = screen.field('Bài kiểm tra', drawer) as HTMLSelectElement;
      expect(
        Array.from(select.options).map((o) => o.textContent?.trim()),
      ).toEqual([
        '— Chưa chọn —',
        'Luyện tập: Tổng quan hệ thống Core Banking · Luyện tập · Nháp, chưa thể xuất bản',
        'Thi cuối khóa: Tổng quan hệ thống Core Banking · Thi cuối khóa',
      ]);
      expect(screen.text(drawer)).not.toContain('chưa có bài kiểm tra');
    });

    it('saves the chosen quiz with the lesson and no blocks, and shows it again after a save', async () => {
      listQuizzes();
      const drawer = await addQuizLesson();
      await screen.type(
        screen.field('Tên bài học', drawer) as HTMLInputElement,
        'Thi cuối khóa',
      );
      await screen.choose(
        screen.field('Bài kiểm tra', drawer) as HTMLSelectElement,
        '2',
      );
      await screen.click(screen.button('Lưu', drawer));
      await screen.click(screen.button('Lưu nháp'));

      const { chapters } = screen.lastCall(courseEndpoints.saveDraft)
        ?.body as SaveDraftCommand;
      expect(chapters[0].lessons.at(-1)).toEqual({
        title: 'Thi cuối khóa',
        lessonType: 'quiz',
        quizId: 2,
        estimatedDurationSeconds: 600,
        isRequired: true,
        blocks: [],
      });

      await screen.click(editLessonButton('Thi cuối khóa'));
      expect(
        (screen.field('Bài kiểm tra', screen.drawer()!) as HTMLSelectElement)
          .value,
      ).toBe('2');
    });

    it('sends no quizId for a lesson that has none yet, and says so in the outline', async () => {
      listQuizzes();
      const drawer = await addQuizLesson();
      await screen.click(screen.button('Lưu', drawer));
      expect(screen.text()).toContain('Chưa chọn bài kiểm tra');
      await screen.click(screen.button('Lưu nháp'));

      const { chapters } = screen.lastCall(courseEndpoints.saveDraft)
        ?.body as SaveDraftCommand;
      expect(chapters[0].lessons.at(-1)).not.toHaveProperty('quizId');
    });

    it('says to create a quiz first when the course has none', async () => {
      const drawer = await addQuizLesson();
      expect(screen.text(drawer)).toContain('Khóa học chưa có bài kiểm tra');
    });

    it('says so when the quizzes cannot be listed, and leaves the lesson as it is', async () => {
      screen.calls.mockImplementation((endpoint, request) =>
        endpoint === assessmentV1Endpoints.courseQuizList
          ? backendRefusal('internalError')
          : original(endpoint, request),
      );
      const drawer = await addQuizLesson();
      expect(screen.text(drawer)).toContain(
        'Không tải được danh sách bài kiểm tra',
      );
      expect(screen.text(drawer)).not.toContain(
        'Khóa học chưa có bài kiểm tra',
      );
    });

    it('shows the server’s refusal of the quiz when saving', async () => {
      listQuizzes();
      const drawer = await addQuizLesson();
      await screen.choose(
        screen.field('Bài kiểm tra', drawer) as HTMLSelectElement,
        '2',
      );
      await screen.click(screen.button('Lưu', drawer));
      screen.calls.mockImplementation((endpoint, request) =>
        endpoint === courseEndpoints.saveDraft
          ? backendRefusal('quizInvalid')
          : original(endpoint, request),
      );
      await screen.click(screen.button('Lưu nháp'));

      expect(screen.text()).toContain(
        'Bài kiểm tra chưa hợp lệ: Bài kiểm tra không tồn tại, đã bị xóa hoặc không thuộc khóa học này.',
      );
    });

    it('shows the server’s refusal to publish a course whose quiz lesson is unlinked', async () => {
      await screen.open('/admin/courses/6/edit');
      await step('Đối tượng & xuất bản');
      screen.calls.mockImplementation((endpoint, request) =>
        endpoint === courseEndpoints.publish
          ? backendRefusal('quizLessonUnlinked')
          : original(endpoint, request),
      );
      await screen.click(screen.button('Xuất bản khóa học'));
      await screen.click(screen.button('Xuất bản', screen.alertDialog()!));

      expect(screen.text()).toContain(
        'Chưa thể xuất bản: Có bài học loại kiểm tra chưa chọn bài kiểm tra đã xuất bản của khóa học.',
      );
      expect(screen.url()).toBe('/admin/courses/6/edit');
    });

    it('publishes with the version the server holds when tried again after a refusal', async () => {
      await screen.open('/admin/courses/6/edit');
      await step('Đối tượng & xuất bản');
      screen.calls.mockImplementation((endpoint, request) =>
        endpoint === courseEndpoints.publish
          ? backendRefusal('quizLessonUnlinked')
          : original(endpoint, request),
      );
      await screen.click(screen.button('Xuất bản khóa học'));
      await screen.click(screen.button('Xuất bản', screen.alertDialog()!));
      expect(screen.lastCall(courseEndpoints.publish)?.body).toEqual({
        expectedVersion: 1,
      });

      screen.calls.mockImplementation(original);
      await screen.click(screen.button('Xuất bản khóa học'));
      await screen.click(screen.button('Xuất bản', screen.alertDialog()!));
      expect(screen.lastCall(courseEndpoints.saveDraft)?.body).toMatchObject({
        expectedVersion: 1,
      });
      expect(screen.lastCall(courseEndpoints.publish)?.body).toEqual({
        expectedVersion: 2,
      });
      await vi.waitFor(() => expect(screen.url()).toBe('/admin/courses'));
    });
  });

  describe('a draft with AI-generated content', () => {
    const original = (endpoint: AnyEndpoint, request: FakeRequest): FakeReply =>
      MockBackend.prototype.handle.call(
        TestBed.inject(MockBackend),
        endpoint,
        request,
      ) as FakeReply;

    /** Course 6 as the server would send it when its draft was written by the AI generation. */
    const aiGenerated = () =>
      screen.calls.mockImplementation((endpoint, request) => {
        const reply = original(endpoint, request);
        if (endpoint !== courseEndpoints.getCourse) return reply;
        const body = reply.body as {
          data: { revision: Record<string, unknown> };
        };
        body.data.revision['aiGenerated'] = true;
        return reply;
      });

    const tick = () =>
      screen
        .alertDialog()!
        .querySelector<HTMLInputElement>('input[type="checkbox"]')!;

    it('says so in the editor', async () => {
      aiGenerated();
      await screen.open('/admin/courses/6/edit');

      expect(screen.text()).toContain('Có nội dung do AI tạo');
    });

    it('says nothing for a course the AI did not write', async () => {
      await screen.open('/admin/courses/6/edit');

      expect(screen.text()).not.toContain('Có nội dung do AI tạo');
    });

    it('cannot be published until the review is ticked, and then sends the confirmation', async () => {
      aiGenerated();
      await screen.open('/admin/courses/6/edit');
      await step('Đối tượng & xuất bản');

      await screen.click(screen.button('Xuất bản khóa học'));
      const dialog = screen.alertDialog()!;
      expect(dialog.textContent).toContain('Tôi đã rà soát nội dung');
      expect(screen.button('Xuất bản', dialog)!.disabled).toBe(true);

      await screen.click(tick());
      expect(screen.button('Xuất bản', dialog)!.disabled).toBe(false);
      await screen.click(screen.button('Xuất bản', dialog));

      expect(screen.lastCall(courseEndpoints.publish)?.body).toEqual({
        expectedVersion: 1,
        reviewConfirmed: true,
      });
    });

    it('is not asked for a course the AI did not write', async () => {
      await screen.open('/admin/courses/6/edit');
      await step('Đối tượng & xuất bản');

      await screen.click(screen.button('Xuất bản khóa học'));

      expect(
        screen.alertDialog()!.querySelector('input[type="checkbox"]'),
      ).toBeNull();
      expect(screen.button('Xuất bản', screen.alertDialog()!)!.disabled).toBe(
        false,
      );
    });
  });

  it('saves then publishes after confirming, and goes back to the list', async () => {
    await screen.open('/admin/courses/6/edit');
    await step('Đối tượng & xuất bản');
    expect(screen.text()).toContain('Sẵn sàng xuất bản.');

    await screen.click(screen.button('Xuất bản khóa học'));
    await screen.click(screen.button('Xuất bản', screen.alertDialog()!));

    expect(screen.lastCall(courseEndpoints.publish)?.body).toEqual({
      expectedVersion: 1,
    });
    await vi.waitFor(() => expect(screen.url()).toBe('/admin/courses'));
    expect(screen.text(document.body)).toContain('Đã xuất bản khóa học');
  });

  describe('the four steps', () => {
    const primaries = () =>
      Array.from(
        screen.el.querySelectorAll<HTMLElement>(
          '.course-editor__foot .btn--primary',
        ),
      ).map((b) => b.textContent?.trim());

    it('lists the steps with the mockup labels and subtitles', async () => {
      await screen.open('/admin/courses/6/edit');

      const steps = Array.from(
        screen.el.querySelectorAll<HTMLElement>('.stepper__step'),
      ).map((s) => s.textContent?.replace(/\s+/g, ' ').trim());
      expect(steps).toHaveLength(4);
      expect(steps[0]).toContain('Thông tin cơ bản');
      expect(steps[0]).toContain('Tên, mã, chương trình');
      expect(steps[1]).toContain('Nội dung khóa học');
      expect(steps[2]).toContain('Bài kiểm tra & điều kiện');
      expect(steps[2]).toContain('Điều kiện hoàn thành, điểm thưởng');
      expect(steps[3]).toContain('Đối tượng & xuất bản');
      expect(steps[3]).toContain('Kiểm tra trước khi xuất bản');
    });

    it('puts the completion rules and the reward on step 3', async () => {
      await screen.open('/admin/courses/6/edit');
      await step('Bài kiểm tra & điều kiện');

      expect(screen.text()).toContain('Điều kiện hoàn thành');
      expect(screen.field('Điểm thưởng khi hoàn thành')).toBeTruthy();
      expect(screen.text()).not.toContain('Kiểm tra trước khi xuất bản Có');
    });

    it('blocks the review while required fields are missing, then shows the checklist and summary', async () => {
      await screen.open('/admin/courses/6/edit');
      await screen.type(screen.field('Tên khóa học') as HTMLInputElement, '');
      await step('Đối tượng & xuất bản');
      expect(currentStep()).toContain('Thông tin cơ bản');
      expect(screen.text()).toContain('Nhập tên khóa học.');
      await screen.type(
        screen.field('Tên khóa học') as HTMLInputElement,
        'Khóa đã hoàn thiện',
      );
      await step('Đối tượng & xuất bản');
      expect(
        screen.el.querySelector('app-course-rules')?.hasAttribute('hidden'),
      ).toBe(true);
      expect(screen.text()).toContain('Tóm tắt khóa học');
      expect(screen.text()).toContain('Số bài học');
      expect(screen.text()).toContain('Sẵn sàng xuất bản.');

      await screen.click(screen.button('Bổ sung'));
      expect(currentStep()).toContain('Bài kiểm tra & điều kiện');
    });

    describe('the final exam', () => {
      const original = (
        endpoint: AnyEndpoint,
        request: FakeRequest,
      ): FakeReply =>
        MockBackend.prototype.handle.call(
          TestBed.inject(MockBackend),
          endpoint,
          request,
        ) as FakeReply;

      /** The quizzes of course 1 stand in for the edited course's; `status` is the final exam's. */
      const listQuizzes = (status = 'PUBLISHED', selectionMode = 'FIXED') =>
        screen.calls.mockImplementation((endpoint, request) => {
          if (endpoint !== assessmentV1Endpoints.courseQuizList)
            return original(endpoint, request);
          const reply = original(endpoint, {
            ...request,
            query: { ...request.query, courseId: '1' },
          });
          const { items } = reply.body.data as {
            items: {
              quizType: string;
              status: string;
              selectionMode: string;
            }[];
          };
          for (const item of items)
            if (item.quizType === 'FINAL_EXAM') {
              item.status = status;
              item.selectionMode = selectionMode;
            }
          return reply;
        });

      const exam = () =>
        screen.field(
          'Bài kiểm tra dùng để xét hoàn thành',
        ) as HTMLSelectElement;
      const labels = () =>
        Array.from(exam().options).map((o) => o.textContent?.trim());

      it('offers only the final exam of the course, besides "no exam"', async () => {
        listQuizzes();
        await screen.open('/admin/courses/6/edit');
        await step('Bài kiểm tra & điều kiện');

        expect(screen.text()).toContain('Bài kiểm tra cuối khóa');
        expect(screen.text()).toContain(
          'Học viên phải đạt điểm yêu cầu của bài đã chọn.',
        );
        expect(labels()).toEqual([
          'Không yêu cầu bài kiểm tra cuối khóa',
          'Tạo mới bài kiểm tra cuối khóa',
          'Thi cuối khóa: Tổng quan hệ thống Core Banking',
        ]);
        expect(screen.text()).toContain(
          'Đạt bài kiểm tra cuối khóa (chưa chọn)',
        );
      });

      it('says when a final exam is a draft or closed', async () => {
        listQuizzes('DRAFT');
        await screen.open('/admin/courses/6/edit');
        await step('Bài kiểm tra & điều kiện');
        expect(labels()[2]).toMatch(/ · Nháp$/);
      });

      it('saves the choice, shows it again, and lists it as a completion rule', async () => {
        listQuizzes();
        await screen.open('/admin/courses/6/edit');
        await step('Bài kiểm tra & điều kiện');
        await screen.choose(exam(), '2');
        expect(screen.text()).not.toContain('(chưa chọn)');
        await screen.click(screen.button('Lưu nháp'));

        expect(screen.lastCall(courseEndpoints.saveDraft)?.body).toMatchObject({
          finalQuizId: 2,
        });
        await step('Bài kiểm tra & điều kiện');
        expect(exam().value).toBe('2');
      });

      it('sends no final quiz once "no exam" is chosen again', async () => {
        listQuizzes();
        await screen.open('/admin/courses/6/edit');
        await step('Bài kiểm tra & điều kiện');
        await screen.choose(exam(), '2');
        await screen.choose(exam(), '');
        await screen.click(screen.button('Lưu nháp'));

        expect(
          screen.lastCall(courseEndpoints.saveDraft)?.body,
        ).not.toHaveProperty('finalQuizId');
      });

      it('locks the program on step 1 while a final exam is attached', async () => {
        listQuizzes();
        await screen.open('/admin/courses/6/edit');
        const program = () => screen.field('Chương trình') as HTMLSelectElement;
        expect(program().disabled).toBe(false);
        expect(screen.text()).not.toContain(
          'Gỡ bài kiểm tra cuối khóa ở bước 3 để đổi chương trình.',
        );

        await step('Bài kiểm tra & điều kiện');
        await screen.choose(exam(), '2');
        await step('Thông tin cơ bản');
        expect(program().disabled).toBe(true);
        expect(screen.text()).toContain(
          'Gỡ bài kiểm tra cuối khóa ở bước 3 để đổi chương trình.',
        );

        await step('Bài kiểm tra & điều kiện');
        await screen.choose(exam(), '');
        await step('Thông tin cơ bản');
        expect(program().disabled).toBe(false);
      });

      it('says to create one when the course has no final exam', async () => {
        await screen.open('/admin/courses/6/edit');
        await step('Bài kiểm tra & điều kiện');

        expect(labels()).toEqual([
          'Không yêu cầu bài kiểm tra cuối khóa',
          'Tạo mới bài kiểm tra cuối khóa',
        ]);
        expect(screen.text()).not.toContain(
          'Khóa học chưa có bài kiểm tra cuối khóa.',
        );
      });

      /** The program bank of the edited course holds this many active questions. */
      const bankOf = (count: number) =>
        screen.calls.mockImplementation((endpoint, request) => {
          const reply = original(endpoint, request);
          if (endpoint === programAssessmentEndpoints.questions)
            (reply.body.data as { totalElements: number }).totalElements =
              count;
          return reply;
        });

      const button = (label: string) =>
        screen.button(label, screen.el.querySelector('app-course-rules')!);

      it('says how many questions the bank holds and offers to create the exam when there is none', async () => {
        bankOf(24);
        await screen.open('/admin/courses/6/edit');
        await step('Bài kiểm tra & điều kiện');

        expect(screen.text()).not.toContain(
          'Khóa học chưa có bài kiểm tra cuối khóa.',
        );
        expect(button('Nhập câu hỏi từ Excel')).toBeUndefined();
        await screen.choose(exam(), 'create');
        expect(screen.text()).toMatch(
          /Ngân hàng chương trình .+ có 24 câu đang dùng\./,
        );
        expect(button('Tạo bài kiểm tra cuối khóa')).toBeUndefined();
        expect(button('Hủy cấu hình bài kiểm tra')).toBeTruthy();
        expect(button('Nhập câu hỏi từ Excel')).toBeTruthy();
        expect(exam().value).toBe('create');
        expect(
          screen.lastCall(programAssessmentEndpoints.questions)?.query,
        ).toMatchObject({
          programId: '4',
          courseId: '6',
          status: 'ACTIVE',
        });
      });

      it('summarises a published exam and offers a separate new version', async () => {
        listQuizzes('PUBLISHED', 'RANDOM_POOL');
        await screen.open('/admin/courses/6/edit');
        await step('Bài kiểm tra & điều kiện');
        await screen.choose(exam(), '2');

        const card = screen.text(screen.el.querySelector('app-course-rules')!);
        expect(card).toContain(
          'Thi cuối khóa: Tổng quan hệ thống Core Banking',
        );
        expect(card).toContain('15 phút');
        expect(card).toContain('2 câu');
        expect(card).toContain('80%');
        expect(card).toContain('Đã xuất bản');
        expect(button('Tạo bản bài kiểm tra mới')).toBeTruthy();
        const advanced = Array.from(screen.el.querySelectorAll('a')).find((a) =>
          a.textContent?.includes('Cấu hình nâng cao'),
        );
        expect(advanced).toBeUndefined();
      });

      it('allows editing fixed exams in the course instead of requiring another screen', async () => {
        listQuizzes('PUBLISHED', 'FIXED');
        await screen.open('/admin/courses/6/edit');
        await step('Bài kiểm tra & điều kiện');
        await screen.choose(exam(), '2');

        expect(button('Tạo bản bài kiểm tra mới')).toBeTruthy();
        expect(screen.text()).not.toContain('chỉnh được ở màn Bài kiểm tra');
      });

      it('removes the exam from the course, keeps it to attach again, and saves without it', async () => {
        listQuizzes('PUBLISHED', 'RANDOM_POOL');
        await screen.open('/admin/courses/6/edit');
        await step('Bài kiểm tra & điều kiện');
        await screen.choose(exam(), '2');
        expect(button('Tạo bản bài kiểm tra mới')).toBeTruthy();

        await screen.click(button('Gỡ khỏi khóa học'));
        expect(exam().value).toBe('');
        expect(button('Tạo bản bài kiểm tra mới')).toBeUndefined();
        expect(screen.text()).toContain(
          'Thi cuối khóa: Tổng quan hệ thống Core Banking',
        );
        expect(screen.text()).toContain(
          'Đạt bài kiểm tra cuối khóa (chưa chọn)',
        );
        await step('Thông tin cơ bản');
        expect(
          (screen.field('Chương trình') as HTMLSelectElement).disabled,
        ).toBe(false);

        await step('Bài kiểm tra & điều kiện');
        await screen.click(screen.button('Lưu nháp'));
        expect(
          screen.lastCall(courseEndpoints.saveDraft)?.body,
        ).not.toHaveProperty('finalQuizId');

        await step('Bài kiểm tra & điều kiện');
        await screen.choose(exam(), '2');
        expect(exam().value).toBe('2');
        expect(button('Gỡ khỏi khóa học')).toBeTruthy();
      });

      it('offers a retry when the quizzes cannot be read, and keeps "no exam" selectable', async () => {
        screen.calls.mockImplementation((endpoint, request) =>
          endpoint === assessmentV1Endpoints.courseQuizList
            ? backendRefusal('internalError')
            : original(endpoint, request),
        );
        await screen.open('/admin/courses/6/edit');
        await step('Bài kiểm tra & điều kiện');

        expect(screen.text()).toContain(
          'Không tải được danh sách bài kiểm tra',
        );
        expect(button('Thử lại')).toBeTruthy();
        expect(labels()).toEqual([
          'Không yêu cầu bài kiểm tra cuối khóa',
          'Tạo mới bài kiểm tra cuối khóa',
        ]);
      });

      describe('atomic inline exam authoring', () => {
        async function openForm() {
          await screen.open('/admin/courses/6/edit');
          await screen.choose(
            screen.field('Chương trình') as HTMLSelectElement,
            '2',
          );
          await screen.click(screen.button('Lưu nháp'));
          await step('Bài kiểm tra & điều kiện');
          await screen.choose(exam(), 'create');
        }
        const quizFields = () =>
          screen.el.querySelector<HTMLElement>('app-course-exam-form')!;
        const questionBoxes = () =>
          Array.from(
            quizFields().querySelectorAll<HTMLInputElement>(
              '.course-exam-form__question input',
            ),
          );
        async function chooseFixedTwo() {
          await screen.choose(
            screen.field('Cách lấy câu hỏi') as HTMLSelectElement,
            'FIXED',
          );
          await screen.click(button('Bỏ chọn tất cả'));
          await screen.click(questionBoxes()[0]);
          await screen.click(questionBoxes()[1]);
        }
        async function saveExam() {
          await screen.click(screen.button('Tiếp theo'));
          await vi.waitFor(() =>
            expect(button('Sửa bài kiểm tra')).toBeTruthy(),
          );
        }

        it('shows the bank and full settings, without links to another quiz page', async () => {
          await openForm();
          expect(questionBoxes().length).toBeGreaterThan(1);
          expect(screen.field('Cách lấy câu hỏi')).toBeTruthy();
          expect(screen.field('Quyền xem đáp án và giải thích')).toBeTruthy();
          expect(screen.field('Chấm câu nhiều đáp án')).toBeTruthy();
          expect(
            screen.el.querySelector('a[href*="/admin/quizzes/new"]'),
          ).toBeNull();
          expect(screen.button('Lưu nháp')?.disabled).toBe(false);
          expect(
            button('Tạo bài kiểm tra và liên kết khóa học'),
          ).toBeUndefined();
          await screen.click(button('Hủy cấu hình bài kiểm tra'));
          expect(screen.button('Lưu nháp')?.disabled).toBe(false);
        });

        it('saves the course, fixed questions and advanced settings in one command', async () => {
          await openForm();
          await chooseFixedTwo();
          await screen.choose(
            screen.field('Điểm cuối của bài kiểm tra') as HTMLSelectElement,
            'LAST',
          );
          await screen.choose(
            screen.field('Chấm câu nhiều đáp án') as HTMLSelectElement,
            'PARTIAL',
          );
          const selected = questionBoxes().filter((q) => q.checked).length;
          expect(selected).toBe(2);
          await saveExam();
          const command = screen.lastCall(assessmentV1Endpoints.saveCourseExam)
            ?.body as {
            courseId: number;
            draft: SaveDraftCommand;
            quiz: Record<string, unknown>;
            pool: { items: unknown[] };
          };
          expect(command.courseId).toBe(6);
          expect(command.draft.programId).toBe(2);
          expect(command.quiz).toMatchObject({
            selectionMode: 'FIXED',
            questionCount: 2,
            requireLessonsCompleted: true,
            scoringMode: 'PARTIAL',
            scoreMethod: 'LAST',
          });
          expect(command.pool.items).toHaveLength(2);
          expect(screen.callsTo(assessmentV1Endpoints.saveCourseExam)).toBe(1);
          expect(exam().value).not.toBe('');
        });

        it('creates the basic draft once and links its exam on Continue without another tab', async () => {
          await screen.open('/admin/courses/new');
          await screen.type(
            screen.field('Tên khóa học') as HTMLInputElement,
            'Khóa và đề cùng lúc',
          );
          await screen.type(
            screen.field('Mã khóa học') as HTMLInputElement,
            'ATOMIC-NEW',
          );
          await screen.choose(
            screen.field('Chương trình') as HTMLSelectElement,
            '2',
          );
          await screen.choose(
            screen.field('Mức độ') as HTMLSelectElement,
            'basic',
          );
          await step('Bài kiểm tra & điều kiện');
          expect(screen.callsTo(courseEndpoints.createCourse)).toBe(1);
          await addTextLesson();
          await step('Bài kiểm tra & điều kiện');
          await screen.choose(exam(), 'create');
          await chooseFixedTwo();
          await saveExam();
          const command = screen.lastCall(assessmentV1Endpoints.saveCourseExam)
            ?.body as {
            courseId: number;
            quiz: { courseId?: number };
          };
          expect(command.courseId).toBeGreaterThan(0);
          expect(command.quiz.courseId).toBe(command.courseId);
          expect(screen.url()).toMatch(/\/admin\/courses\/\d+\/edit\?step=1/);
          expect(exam().value).not.toBe('');
        });

        it('creates a separate quiz when changing a published exam', async () => {
          listQuizzes('PUBLISHED', 'FIXED');
          await screen.open('/admin/courses/6/edit');
          await step('Bài kiểm tra & điều kiện');
          await screen.choose(exam(), '2');
          await screen.click(button('Tạo bản bài kiểm tra mới'));
          await screen.click(screen.button('Tiếp theo'));
          const command = screen.lastCall(
            assessmentV1Endpoints.saveCourseExam,
          )?.body;
          expect(command).toBeDefined();
          expect(command).not.toHaveProperty('quizId');
          expect(command).not.toHaveProperty('expectedQuizVersion');
          expect(command).toMatchObject({
            courseId: 6,
            quiz: { selectionMode: 'FIXED' },
          });
        });

        it('creates a new draft from the dropdown even when another draft exam is selected, and cancel restores that choice', async () => {
          listQuizzes('DRAFT', 'FIXED');
          await openForm();
          await screen.click(button('Hủy cấu hình bài kiểm tra'));
          await screen.choose(exam(), '2');
          await screen.choose(exam(), 'create');
          expect(
            (screen.field('Tên bài kiểm tra') as HTMLInputElement).value,
          ).not.toBe('Thi cuối khóa: Tổng quan hệ thống Core Banking');
          await screen.click(button('Hủy cấu hình bài kiểm tra'));
          expect(exam().value).toBe('2');
          expect(screen.callsTo(assessmentV1Endpoints.saveCourseExam)).toBe(0);
          await screen.choose(exam(), 'create');
          await chooseFixedTwo();
          await screen.click(screen.button('Tiếp theo'));
          const command = screen.lastCall(assessmentV1Endpoints.saveCourseExam)
            ?.body as { draft: SaveDraftCommand };
          expect(command).toBeDefined();
          expect(command).not.toHaveProperty('quizId');
          expect(command.draft.finalQuizId).toBe(2);
          expect(JSON.stringify(command)).not.toContain(
            '"finalQuizId":"create"',
          );
          expect(screen.callsTo(assessmentV1Endpoints.saveCourseExam)).toBe(1);
        });

        it('keeps exam fields and selected questions while going back, then saves once on Continue', async () => {
          await openForm();
          await chooseFixedTwo();
          await screen.type(
            screen.field('Tên bài kiểm tra') as HTMLInputElement,
            'Giữ cấu hình khi quay lại',
          );
          await screen.click(screen.button('Quay lại'));
          expect(
            screen.el.querySelector('app-course-rules')?.hasAttribute('hidden'),
          ).toBe(true);
          expect(screen.callsTo(assessmentV1Endpoints.saveCourseExam)).toBe(0);
          await step('Bài kiểm tra & điều kiện');
          expect(
            (screen.field('Tên bài kiểm tra') as HTMLInputElement).value,
          ).toBe('Giữ cấu hình khi quay lại');
          expect(questionBoxes().filter((box) => box.checked)).toHaveLength(2);
          await saveExam();
          expect(screen.callsTo(assessmentV1Endpoints.saveCourseExam)).toBe(1);
          expect(
            screen.el.querySelector('[aria-current="step"]')?.textContent,
          ).toContain('Đối tượng & xuất bản');
        });

        it('retains the form on a refused atomic save and never retries a partial pool write', async () => {
          await openForm();
          await chooseFixedTwo();
          await screen.type(
            screen.field('Tên bài kiểm tra') as HTMLInputElement,
            'Giữ nguyên dữ liệu khi lỗi',
          );
          screen.calls.mockImplementation((endpoint, request) =>
            endpoint === assessmentV1Endpoints.saveCourseExam
              ? backendRefusal('internalError')
              : original(endpoint, request),
          );
          await screen.click(screen.button('Tiếp theo'));
          expect(
            (screen.field('Tên bài kiểm tra') as HTMLInputElement).value,
          ).toBe('Giữ nguyên dữ liệu khi lỗi');
          expect(
            quizFields().querySelector('ui-alert[tone="danger"]'),
          ).toBeTruthy();
          expect(screen.callsTo(assessmentV1Endpoints.saveCourseExam)).toBe(1);
          expect(screen.callsTo(assessmentV1Endpoints.createQuiz)).toBe(0);
        });

        it('blocks an empty selection and an invalid time before sending a command', async () => {
          await openForm();
          await screen.click(button('Bỏ chọn tất cả'));
          await screen.type(
            screen.field('Thời gian (phút)') as HTMLInputElement,
            '0',
          );
          await screen.click(screen.button('Tiếp theo'));
          expect(screen.text()).toContain('Thời gian tối thiểu 1.');
          expect(screen.text()).toContain('Chọn đủ câu hỏi');
          expect(screen.callsTo(assessmentV1Endpoints.saveCourseExam)).toBe(0);
        });

        it('publishes a fixed draft exam with the course without replacing the selected questions', async () => {
          await openForm();
          await chooseFixedTwo();
          await saveExam();
          const poolsBefore = screen.callsTo(assessmentV1Endpoints.replacePool);
          await step('Đối tượng & xuất bản');
          expect(screen.text()).toContain(
            'Bài kiểm tra cuối khóa sẽ được xuất bản cùng khóa học',
          );
          await screen.click(screen.button('Xuất bản khóa học'));
          await screen.click(screen.button('Xuất bản', screen.alertDialog()!));
          await vi.waitFor(() => expect(screen.url()).toBe('/admin/courses'));
          expect(screen.callsTo(assessmentV1Endpoints.publishQuiz)).toBe(1);
          expect(screen.callsTo(assessmentV1Endpoints.replacePool)).toBe(
            poolsBefore,
          );
        });
      });
      it('advises configuring one without blocking the publish', async () => {
        await screen.open('/admin/courses/6/edit');
        await step('Đối tượng & xuất bản');

        expect(screen.text()).toContain(
          'Đã cấu hình bài kiểm tra cuối khóa (khuyến nghị)',
        );
        expect(screen.text()).not.toContain(
          'Bài kiểm tra cuối khóa đã xuất bản',
        );
      });

      it('no longer asks to save the draft first in create mode', async () => {
        await screen.open('/admin/courses/new');
        await step('Bài kiểm tra & điều kiện');

        expect(screen.text()).not.toContain(
          'Lưu nháp trước để chọn bài kiểm tra',
        );
        expect(screen.callsTo(assessmentV1Endpoints.courseQuizList)).toBe(0);
        expect(screen.text()).toContain(
          'Đạt bài kiểm tra cuối khóa (chưa chọn)',
        );
      });
    });

    it('offers "Hủy" on step 1 and "Quay lại" after it, always with one primary button', async () => {
      await screen.open('/admin/courses/6/edit');
      expect(screen.button('Hủy')).toBeTruthy();
      expect(screen.button('Quay lại')).toBeUndefined();
      expect(screen.button('Lưu nháp')).toBeTruthy();
      expect(primaries()).toEqual(['Tiếp theo']);

      await screen.click(screen.button('Tiếp theo'));
      await screen.click(screen.button('Tiếp theo'));
      expect(screen.button('Hủy')).toBeUndefined();
      expect(screen.button('Quay lại')).toBeTruthy();
      expect(primaries()).toEqual(['Tiếp theo']);

      await screen.click(screen.button('Tiếp theo'));
      expect(primaries()).toEqual(['Xuất bản khóa học']);
      expect(screen.button('Lưu nháp')).toBeTruthy();
    });
  });

  describe('create mode', () => {
    it.each(['Lưu nháp', 'Tiếp theo'])(
      'requires an initially empty level only after %s',
      async (action) => {
        await screen.open('/admin/courses/new');
        const level = screen.field('Mức độ') as HTMLSelectElement;
        expect(level.value).toBe('');
        await screen.type(
          screen.field('Tên khóa học') as HTMLInputElement,
          'Kiểm tra mức độ',
        );
        screen.field('Tên khóa học').dispatchEvent(new Event('blur'));
        await screen.settle();
        expect(screen.el.querySelector('.field__error')).toBeNull();
        expect(screen.text()).not.toContain('Còn thông tin chưa hợp lệ');
        await screen.choose(
          screen.field('Chương trình') as HTMLSelectElement,
          '1',
        );
        await screen.type(
          screen.field('Mã khóa học') as HTMLInputElement,
          'LEVEL-REQUIRED',
        );
        await screen.click(screen.button(action));
        expect(level.getAttribute('aria-invalid')).toBe('true');
        expect(level.getAttribute('aria-required')).toBe('true');
        expect(screen.text()).toContain('Chọn mức độ khóa học.');
        expect(screen.callsTo(courseEndpoints.createCourse)).toBe(0);
      },
    );
    /** Fills the first step far enough for the form to be valid. */
    async function fillBasics(code = 'WIZ-NEW-1') {
      await screen.type(screen.field('Mã khóa học') as HTMLInputElement, code);
      await screen.type(
        screen.field('Tên khóa học') as HTMLInputElement,
        'Khóa thử',
      );
      await screen.choose(
        screen.field('Chương trình') as HTMLSelectElement,
        '1',
      );
      await screen.choose(screen.field('Mức độ') as HTMLSelectElement, 'basic');
    }

    async function addChapterWithLesson() {
      await step('Nội dung khóa học');
      await screen.click(screen.button('Thêm chương'));
      await screen.click(screen.button('Thêm bài học'));
      const drawer = screen.drawer()!;
      await screen.type(
        screen.field('Tên bài học', drawer) as HTMLInputElement,
        'Bài đầu tiên',
      );
      await screen.click(screen.button('Văn bản', drawer));
      const editor = drawer.querySelector<HTMLElement>(
        '[contenteditable="true"]',
      )!;
      editor.textContent = 'Nội dung bài đầu tiên.';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      await screen.click(screen.button('Lưu', drawer));
    }

    it('opens an empty wizard without reading any course, quiz or kept upload', async () => {
      const kept = vi.spyOn(TestBed.inject(KeptUploads), 'read');
      await screen.open('/admin/courses/new');

      expect(screen.text()).toContain('Tạo khóa học mới');
      expect(screen.text()).toContain('Chưa lưu');
      expect(screen.text()).toContain('Đơn vị sở hữu:');
      expect(screen.text()).toContain(
        'Duy nhất trong hệ thống, không đổi sau khi tạo.',
      );
      expect((screen.field('Mã khóa học') as HTMLInputElement).readOnly).toBe(
        false,
      );
      expect(screen.button('Lưu nháp')).toBeTruthy();
      expect(screen.callsTo(courseEndpoints.getCourse)).toBe(0);
      expect(screen.callsTo(courseEndpoints.createCourse)).toBe(0);
      expect(screen.callsTo(assessmentV1Endpoints.courseQuizList)).toBe(0);
      expect(kept).not.toHaveBeenCalled();
    });

    describe('"Tạo bằng AI" on step 1', () => {
      const aiButton = () => screen.button('Tạo bằng AI') as HTMLButtonElement;
      const aiProblem = () =>
        screen.el.querySelector('#ai-problem')?.textContent?.trim();
      const aiSwitch = () =>
        screen.el.querySelector<HTMLInputElement>(
          '.course-editor__ai-toggle input[type="checkbox"]',
        )!;
      const openWithAi = async () => {
        await screen.open('/admin/courses/new');
        await screen.click(aiSwitch());
      };

      it('is off by default and can be switched on and off', async () => {
        await screen.open('/admin/courses/new');

        expect(aiSwitch().checked).toBe(false);
        expect(screen.button('Tạo bằng AI')).toBeFalsy();
        expect(screen.el.querySelector('.ai-section')).toBeNull();

        await screen.click(aiSwitch());
        expect(aiSwitch().checked).toBe(true);
        expect(aiButton()).toBeTruthy();
        expect(screen.el.querySelector('.ai-section')).not.toBeNull();

        await screen.click(aiSwitch());
        expect(aiSwitch().checked).toBe(false);
        expect(screen.button('Tạo bằng AI')).toBeFalsy();
        expect(screen.el.querySelector('.ai-section')).toBeNull();
      });

      const pickSource = async (name = 'quy-trinh.md') => {
        const input = screen.el.querySelector<HTMLInputElement>(
          '.ai-section__file input[type="file"]',
        )!;
        Object.defineProperty(input, 'files', {
          value: {
            item: () =>
              new File(['# Quy trình'], name, { type: 'text/markdown' }),
            length: 1,
          },
          configurable: true,
        });
        input.dispatchEvent(new Event('change'));
        await screen.settle();
      };

      const fillAi = async () => {
        await screen.type(
          screen.field('Đối tượng học viên') as HTMLTextAreaElement,
          'Giao dịch viên mới',
        );
        await screen.type(screen.field('Số chương') as HTMLInputElement, '3');
        const competency = screen.field(
          'Năng lực của câu hỏi',
        ) as HTMLSelectElement;
        await vi.waitFor(() =>
          expect(competency.options.length).toBeGreaterThan(1),
        );
        const unit = screen.field(
          'Đơn vị sở hữu khóa học',
        ) as HTMLSelectElement | null;
        if (unit) {
          await vi.waitFor(() =>
            expect(unit.options.length).toBeGreaterThan(1),
          );
          unit.value = unit.options[1].value;
          unit.dispatchEvent(new Event('input'));
          unit.dispatchEvent(new Event('change'));
          await screen.settle();
        }
        competency.value = competency.options[1].value;
        competency.dispatchEvent(new Event('input'));
        competency.dispatchEvent(new Event('change'));
        await screen.settle();
      };

      it('stays disabled and says why, until step 1 and the AI fields are valid', async () => {
        await openWithAi();

        expect(aiButton().disabled).toBe(true);
        expect(aiProblem()).toContain('thông tin cơ bản');

        await fillBasics();
        expect(aiButton().disabled).toBe(true);
        expect(aiProblem()).toBe('Chọn tệp nguồn');

        await pickSource();
        expect(aiProblem()).toBe('Nhập đối tượng học viên');

        await fillAi();
        expect(aiProblem()).toBe('');
        expect(aiButton().disabled).toBe(false);
      });

      it('creates the job and moves to step 2 of the course it made', async () => {
        const navigate = vi
          .spyOn(TestBed.inject(Router), 'navigate')
          .mockResolvedValue(true);
        await openWithAi();
        await fillBasics();
        await pickSource();
        await fillAi();

        await screen.click(aiButton());

        await vi.waitFor(() =>
          expect(screen.callsTo(courseJobEndpoints.start)).toBe(1),
        );
        await vi.waitFor(() =>
          expect(navigate).toHaveBeenCalledWith(
            ['/admin/courses', expect.any(Number), 'edit'],
            { replaceUrl: true, queryParams: { step: 1 } },
          ),
        );
        expect(screen.callsTo(courseEndpoints.createCourse)).toBe(0);
      });

      it('opens filled in from the chat: title, what was said and the kept file, with nothing uploaded', async () => {
        TestBed.inject(CourseFormPrefillStore).set({
          file: new File(['# Quy trình'], 'quy-trinh.md', {
            type: 'text/markdown',
          }),
          fields: {
            title: '[TEST-AI] Khóa thử',
            targetLearners: 'Giao dịch viên mới',
            chapters: 3,
          },
        });
        await screen.open('/admin/courses/new');

        expect((screen.field('Tên khóa học') as HTMLInputElement).value).toBe(
          '[TEST-AI] Khóa thử',
        );
        expect(
          (screen.field('Đối tượng học viên') as HTMLTextAreaElement).value,
        ).toBe('Giao dịch viên mới');
        expect((screen.field('Số chương') as HTMLInputElement).value).toBe('3');
        expect(aiSwitch().checked).toBe(true);
        expect(aiProblem()).not.toBe('Chọn tệp nguồn');
        expect(screen.text()).toContain('quy-trinh.md');
        expect(screen.callsTo(courseJobEndpoints.start)).toBe(0);
        expect(screen.callsTo(knowledgeEndpoints.uploadDocument)).toBe(0);
      });

      it('shows an empty form when it is opened directly', async () => {
        await openWithAi();

        expect((screen.field('Tên khóa học') as HTMLInputElement).value).toBe(
          '',
        );
        expect(
          (screen.field('Đối tượng học viên') as HTMLTextAreaElement).value,
        ).toBe('');
        expect(aiProblem()).toContain('thông tin cơ bản');
      });

      it('offers no free text for the programme or the competency', async () => {
        await openWithAi();

        expect(screen.field('Năng lực của câu hỏi')?.tagName).toBe('SELECT');
        expect(screen.field('Chương trình')?.tagName).toBe('SELECT');
      });
    });

    it('stays on an empty first step on "Tiếp theo", lists it and focuses its first error', async () => {
      await screen.open('/admin/courses/new');
      await screen.click(screen.button('Tiếp theo'));

      expect(currentStep()).toContain('Thông tin cơ bản');
      expect(screen.text()).toContain(
        'Còn thông tin chưa hợp lệ ở: Thông tin cơ bản.',
      );
      expect(screen.text()).toContain('Nhập tên khóa học.');
      expect(screen.text()).toContain('Nhập mã khóa học.');
      expect(document.activeElement).toBe(screen.field('Tên khóa học'));
      expect(screen.callsTo(courseEndpoints.createCourse)).toBe(0);
    });

    it('creates the course on "Tiếp theo" once the first step is valid, and opens step 2 on its edit URL', async () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
      await screen.open('/admin/courses/new');
      const page = screen.page<CourseEditor>();
      await fillBasics();
      await screen.click(screen.button('Tiếp theo'));

      expect(screen.callsTo(courseEndpoints.createCourse)).toBe(1);
      expect(navigate).toHaveBeenCalledWith(
        ['/admin/courses', expect.any(Number), 'edit'],
        { replaceUrl: true, queryParams: { step: 1 } },
      );
      expect(page.hasUnsavedChanges()).toBe(false);
      await vi.waitFor(() =>
        expect(screen.url()).toMatch(/^\/admin\/courses\/\d+\/edit\?step=1$/),
      );
      expect(currentStep()).toContain('Nội dung khóa học');
      expect(screen.text(document.body)).toContain('Đã lưu nháp');
      expect(screen.text()).not.toContain('Còn thông tin chưa hợp lệ');
    });

    it('clears a module from another field before submitting the new program', async () => {
      await screen.open('/admin/courses/new');
      await fillBasics();
      await screen.choose(
        screen.field('Phân hệ nghiệp vụ') as HTMLSelectElement,
        '7',
      );
      expect(
        (screen.field('Phân hệ nghiệp vụ') as HTMLSelectElement).value,
      ).toBe('7');

      await screen.choose(
        screen.field('Chương trình') as HTMLSelectElement,
        '2',
      );
      expect(
        (screen.field('Phân hệ nghiệp vụ') as HTMLSelectElement).value,
      ).toBe('');
      await screen.click(screen.button('Tiếp theo'));

      expect(screen.lastCall(courseEndpoints.createCourse)?.body).toMatchObject(
        {
          draft: { programId: 2 },
        },
      );
      const body = screen.lastCall(courseEndpoints.createCourse)
        ?.body as CreateCourseCommand;
      expect(body.draft).not.toHaveProperty('moduleId');
    });

    it('stays on the first step with the code error when "Tiếp theo" meets a taken code', async () => {
      await screen.open('/admin/courses/new');
      await fillBasics('VH-301');
      await screen.click(screen.button('Tiếp theo'));

      expect(screen.callsTo(courseEndpoints.createCourse)).toBe(1);
      expect(screen.url()).toBe('/admin/courses/new');
      expect(currentStep()).toContain('Thông tin cơ bản');
      expect(screen.text()).toContain('Mã khóa học đã tồn tại.');
    });

    it('stays on the first step with an alert when "Tiếp theo" is refused for another reason', async () => {
      await screen.open('/admin/courses/new');
      await fillBasics();
      screen.calls.mockImplementation((endpoint, request) =>
        endpoint === courseEndpoints.createCourse
          ? backendRefusal('internalError')
          : (MockBackend.prototype.handle.call(
              TestBed.inject(MockBackend),
              endpoint,
              request,
            ) as FakeReply),
      );
      await screen.click(screen.button('Tiếp theo'));

      expect(screen.url()).toBe('/admin/courses/new');
      expect(currentStep()).toContain('Thông tin cơ bản');
      expect(screen.el.querySelector('ui-alert[tone="danger"]')).toBeTruthy();
    });

    it('marks a step done only while it is visited, valid and not open', async () => {
      await screen.open('/admin/courses/new');
      expect(doneSteps()).toEqual([]);

      await step('Nội dung khóa học');
      expect(doneSteps()).toEqual([]);

      await step('Thông tin cơ bản');
      await fillBasics();
      await step('Nội dung khóa học');
      expect(doneSteps()).toEqual(['Thông tin cơ bản']);
      expect(screen.text()).toContain('Đã hoàn thành');

      await step('Thông tin cơ bản');
      await screen.type(screen.field('Tên khóa học') as HTMLInputElement, '');
      await step('Bài kiểm tra & điều kiện');
      expect(doneSteps()).not.toContain('Thông tin cơ bản');
    });

    it('does not create without a code, and says so on the field', async () => {
      await screen.open('/admin/courses/new');
      await screen.type(
        screen.field('Tên khóa học') as HTMLInputElement,
        'Khóa thử',
      );
      await screen.click(screen.button('Lưu nháp'));

      expect(screen.callsTo(courseEndpoints.createCourse)).toBe(0);
      expect(screen.text()).toContain('Nhập mã khóa học.');
    });

    it('creates the basic draft once, then saves its tree on the edit URL', async () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
      await screen.open('/admin/courses/new');
      await fillBasics();
      await addChapterWithLesson();
      await screen.click(screen.button('Lưu nháp'));

      expect(screen.callsTo(courseEndpoints.createCourse)).toBe(1);
      expect(screen.callsTo(courseEndpoints.saveDraft)).toBe(1);
      const body = screen.lastCall(courseEndpoints.createCourse)
        ?.body as CreateCourseCommand;
      expect(body).toMatchObject({
        code: 'WIZ-NEW-1',
        draft: {
          title: 'Khóa thử',
          programId: 1,
          chapters: [],
        },
      });
      expect(body.ownerOrgId).toBeGreaterThan(0);
      expect(screen.lastCall(courseEndpoints.saveDraft)?.body).toMatchObject({
        chapters: [{ title: 'Chương 1', lessons: [{ title: 'Bài đầu tiên' }] }],
      });
      expect(navigate).toHaveBeenCalledWith(
        ['/admin/courses', expect.any(Number), 'edit'],
        { replaceUrl: true, queryParams: { step: 1 } },
      );
      await vi.waitFor(() =>
        expect(screen.url()).toMatch(/^\/admin\/courses\/\d+\/edit\?step=1$/),
      );
      expect(screen.text()).toContain('Sửa khóa học');
      expect(screen.text()).toContain('Bài đầu tiên');
      expect(screen.text(document.body)).toContain('Đã lưu nháp');
    });

    it('opens the edit screen on the step named in the URL, and only once', async () => {
      await screen.open('/admin/courses/6/edit?step=2');
      expect(screen.text()).toContain('Điểm thưởng khi hoàn thành');

      await step('Thông tin cơ bản');
      expect(screen.field('Tên khóa học')).toBeTruthy();
    });

    it('asks before leaving with input, and not once the course is created', async () => {
      await screen.open('/admin/courses/new');
      const page = screen.page<CourseEditor>();
      expect(page.hasUnsavedChanges()).toBe(false);

      await fillBasics();
      expect(page.hasUnsavedChanges()).toBe(true);

      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      await screen.click(screen.button('Lưu nháp'));
      expect(screen.callsTo(courseEndpoints.createCourse)).toBe(1);
      expect(page.hasUnsavedChanges()).toBe(false);
    });

    it('shows a taken code on the code field and goes back to the first step', async () => {
      await screen.open('/admin/courses/new');
      await fillBasics('VH-301');
      await step('Nội dung khóa học');
      await screen.click(screen.button('Lưu nháp'));

      expect(screen.callsTo(courseEndpoints.createCourse)).toBe(1);
      expect(screen.url()).toBe('/admin/courses/new');
      expect(screen.field('Mã khóa học')).toBeTruthy();
      expect(screen.text()).toContain('Mã khóa học đã tồn tại.');
      expect(screen.text()).not.toContain('Dữ liệu đã tồn tại');

      await screen.type(
        screen.field('Mã khóa học') as HTMLInputElement,
        'WIZ-NEW-2',
      );
      expect(screen.text()).not.toContain('Mã khóa học đã tồn tại.');
    });

    it('creates, then publishes the new revision with the version it came back with', async () => {
      await screen.open('/admin/courses/new');
      await fillBasics();
      await addChapterWithLesson();
      await step('Đối tượng & xuất bản');
      await screen.click(screen.button('Xuất bản khóa học'));
      await screen.click(screen.button('Xuất bản', screen.alertDialog()!));

      expect(screen.callsTo(courseEndpoints.createCourse)).toBe(1);
      expect(screen.lastCall(courseEndpoints.publish)?.body).toEqual({
        expectedVersion: 2,
      });
      await vi.waitFor(() => expect(screen.url()).toBe('/admin/courses'));
      expect(screen.text(document.body)).toContain('Đã xuất bản khóa học');
    });

    it('keeps the created course when publishing is refused, and moves on to its edit screen', async () => {
      await screen.open('/admin/courses/new');
      await fillBasics();
      await addChapterWithLesson();
      screen.calls.mockImplementation((endpoint, request) =>
        endpoint === courseEndpoints.publish
          ? backendRefusal('quizLessonUnlinked')
          : (MockBackend.prototype.handle.call(
              TestBed.inject(MockBackend),
              endpoint,
              request,
            ) as FakeReply),
      );
      await step('Đối tượng & xuất bản');
      await screen.click(screen.button('Xuất bản khóa học'));
      await screen.click(screen.button('Xuất bản', screen.alertDialog()!));

      await vi.waitFor(() =>
        expect(screen.url()).toMatch(/^\/admin\/courses\/\d+\/edit\?step=1$/),
      );
      expect(screen.text(document.body)).toContain(
        'Có bài học loại kiểm tra chưa chọn bài kiểm tra đã xuất bản của khóa học.',
      );
    });

    it('blocks the content step until basic information is valid', async () => {
      await screen.open('/admin/courses/new');
      await step('Nội dung khóa học');
      expect(screen.button('Thêm chương')).toBeUndefined();
      expect(
        screen.el.querySelector('[aria-current="step"]')?.textContent,
      ).toContain('Thông tin cơ bản');
      expect(screen.text()).toContain('Chọn mức độ khóa học.');
      expect(screen.callsTo(assessmentV1Endpoints.courseQuizList)).toBe(0);
    });
  });
  describe('background uploads', () => {
    const pdf = (name = 'quyen.pdf') =>
      new File(['%PDF-1.4 /Type /Page'], name, { type: 'application/pdf' });
    const original = (endpoint: AnyEndpoint, request: FakeRequest): FakeReply =>
      MockBackend.prototype.handle.call(
        TestBed.inject(MockBackend),
        endpoint,
        request,
      ) as FakeReply;
    const offline = (): FakeReply => ({
      status: 0,
      body: envelopeError('CORE-OFFLINE', 'Offline', 'offline'),
    });
    /** Parts fail as if the network was cut: uploads wait, and go on once `online()` is called. */
    const cutNetwork = () =>
      screen.calls.mockImplementation((e, r) =>
        e === assetEndpoints.uploadPart ? offline() : original(e, r),
      );
    const online = () => screen.calls.mockImplementation(original);
    const dropzones = () =>
      Array.from(
        screen
          .drawer()!
          .querySelectorAll<HTMLInputElement>(
            'label.dropzone input[type=file]',
          ),
      );
    const pick = (input: HTMLInputElement, file: File) => {
      Object.defineProperty(input, 'files', {
        value: [file],
        configurable: true,
      });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const advance = async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms);
      TestBed.tick();
    };
    /** A click on fake time: `screen.click` settles on real timers, which a waiting upload needs off. */
    const tap = async (target: HTMLElement | null | undefined) => {
      target!.click();
      await advance(10);
    };
    /**
     * Opens the first lesson of course 6, adds a PDF block and starts uploading its file offline.
     * Fake time stays on, because the waiting upload holds timers that real time would drop.
     */
    async function startPdfUpload() {
      await screen.open('/admin/courses/6/edit');
      await step('Nội dung khóa học');
      await screen.click(screen.button('Sửa bài học'));
      const drawer = screen.drawer()!;
      await screen.click(screen.button('Tài liệu PDF', drawer));
      cutNetwork();
      vi.useFakeTimers();
      pick(dropzones().at(-1)!, pdf());
      await advance(100);
      return drawer;
    }
    /** The network is back: the waiting uploads finish. */
    async function finishUploads() {
      online();
      await advance(SERVER_RETRY_MS * 4 + POLL_MS * 3);
      vi.useRealTimers();
      await screen.settle();
    }
    const footerText = () =>
      screen.text(screen.el.querySelector('footer.course-editor__foot')!);

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
      localStorage.clear();
    });

    describe('saving a lesson while its file uploads', () => {
      it('saves the lesson as "Lưu", keeps uploading, and attaches the asset when it is done', async () => {
        const drawer = await startPdfUpload();
        expect(screen.text(drawer)).toContain('Mất kết nối');

        await tap(screen.button('Lưu', drawer));
        expect(screen.drawer()).toBeNull();
        expect(footerText()).toContain('Còn 1 tệp đang tải');
        expect(screen.button('Lưu nháp')!.disabled).toBe(true);

        await finishUploads();
        expect(footerText()).not.toContain('tệp đang tải');
        expect(screen.button('Lưu nháp')!.disabled).toBe(false);

        await screen.click(screen.button('Lưu nháp'));
        const saved = screen.lastCall(courseEndpoints.saveDraft)
          ?.body as SaveDraftCommand;
        expect(saved.chapters[0].lessons[0].blocks[1]).toMatchObject({
          blockType: 'pdf',
          assets: [{ assetId: expect.any(Number), usage: 'primary' }],
        });
      });

      it('shows the live upload when the lesson is opened again', async () => {
        const drawer = await startPdfUpload();
        await tap(screen.button('Lưu', drawer));

        await tap(screen.button('Sửa bài học'));
        expect(screen.text(screen.drawer()!)).toContain('Mất kết nối');
        expect(screen.text(screen.drawer()!)).toContain('quyen.pdf');
      });

      it('still refuses a file block that has neither a file nor an upload', async () => {
        await screen.open('/admin/courses/6/edit');
        await step('Nội dung khóa học');
        await screen.click(screen.button('Sửa bài học'));
        const drawer = screen.drawer()!;
        await screen.click(screen.button('Tài liệu PDF', drawer));
        await screen.click(screen.button('Lưu', drawer));

        expect(screen.drawer()).not.toBeNull();
        expect(screen.text(drawer)).toContain('chưa có tệp');
      });

      it('lets several lessons upload at once, counting each in the lock on saving', async () => {
        const drawer = await startPdfUpload();
        await tap(screen.button(/^\s*Tài liệu PDF/, drawer));
        pick(dropzones().at(-1)!, pdf('hai.pdf'));
        await advance(100);
        await tap(screen.button('Lưu', drawer));

        expect(footerText()).toContain('Còn 2 tệp đang tải');
        expect(screen.callsTo(assetEndpoints.startUpload)).toBe(2);
      });

      it('blocks "Xuất bản" while a file uploads', async () => {
        const drawer = await startPdfUpload();
        await tap(screen.button('Lưu', drawer));
        await tap(
          Array.from(
            screen.el.querySelectorAll<HTMLElement>('.stepper__step'),
          ).find((s) => s.textContent?.includes('Đối tượng & xuất bản')),
        );

        expect(screen.button('Xuất bản khóa học')).toBeUndefined();
        expect(currentStep()).toContain('Nội dung khóa học');
        expect(footerText()).toContain('Còn 1 tệp đang tải');
      });
    });

    describe('closing the lesson drawer while a file uploads', () => {
      const ask = () => screen.alertDialog();
      const answer = (label: string) =>
        tap(
          Array.from(ask()!.querySelectorAll<HTMLButtonElement>('button')).find(
            (b) => b.textContent?.trim() === label,
          ),
        );
      const closeDrawer = (drawer: HTMLElement) =>
        tap(
          drawer.querySelector<HTMLButtonElement>('button[aria-label="Đóng"]'),
        );

      it('closes at once when nothing begun in the drawer is uploading', async () => {
        await screen.open('/admin/courses/6/edit');
        await step('Nội dung khóa học');
        await screen.click(screen.button('Sửa bài học'));
        vi.useFakeTimers();
        await closeDrawer(screen.drawer()!);

        expect(ask()).toBeNull();
        expect(screen.drawer()).toBeNull();
      });

      it('asks with only "Lưu" and "Hủy", and "Lưu" saves the lesson and keeps uploading', async () => {
        const drawer = await startPdfUpload();
        await closeDrawer(drawer);

        expect(ask()).not.toBeNull();
        expect(
          Array.from(ask()!.querySelectorAll('button')).map(
            (b) => b.getAttribute('aria-label') || b.textContent?.trim(),
          ),
        ).toEqual(['Đóng hộp thoại', 'Hủy', 'Lưu']);

        await answer('Lưu');
        expect(ask()).toBeNull();
        expect(screen.drawer()).toBeNull();
        expect(footerText()).toContain('Còn 1 tệp đang tải');

        await finishUploads();
        await screen.click(screen.button('Lưu nháp'));
        const saved = screen.lastCall(courseEndpoints.saveDraft)
          ?.body as SaveDraftCommand;
        expect(saved.chapters[0].lessons[0].blocks[1].assets).toHaveLength(1);
      });

      it('"Hủy" drops the lesson changes and cancels the upload on the server', async () => {
        const drawer = await startPdfUpload();
        const uploadId = (
          screen.lastCall(assetEndpoints.startUpload)?.body as {
            requestId: string;
          }
        ).requestId;
        await closeDrawer(drawer);
        await answer('Hủy');

        expect(ask()).toBeNull();
        expect(screen.drawer()).toBeNull();
        expect(screen.lastCall(assetEndpoints.cancelUpload)?.params).toEqual({
          uploadId,
        });
        expect(footerText()).not.toContain('tệp đang tải');
        expect(screen.text()).not.toContain('Có thay đổi chưa lưu');
      });

      it('closing the question returns to the drawer unchanged', async () => {
        const drawer = await startPdfUpload();
        await closeDrawer(drawer);
        await tap(
          ask()!.querySelector<HTMLButtonElement>(
            'button[aria-label="Đóng hộp thoại"]',
          ),
        );

        expect(ask()).toBeNull();
        expect(screen.drawer()).toBe(drawer);
        expect(screen.text(drawer)).toContain('quyen.pdf');
      });

      it('"Lưu" with an invalid form keeps the drawer open and the upload running', async () => {
        const drawer = await startPdfUpload();
        const title = screen.field('Tên bài học', drawer) as HTMLInputElement;
        title.value = '';
        title.dispatchEvent(new Event('input', { bubbles: true }));
        await advance(10);
        await closeDrawer(drawer);
        await answer('Lưu');

        expect(screen.drawer()).toBe(drawer);
        expect(screen.text(drawer)).toContain('Nhập tên bài học');
        expect(screen.text(drawer)).toContain('Mất kết nối');
      });

      it('leaves an upload that was running before the drawer opened alone', async () => {
        const drawer = await startPdfUpload();
        await tap(screen.button('Lưu', drawer));
        await tap(screen.button('Sửa bài học'));
        await closeDrawer(screen.drawer()!);

        expect(ask()).toBeNull();
        expect(screen.drawer()).toBeNull();
        expect(footerText()).toContain('Còn 1 tệp đang tải');
        expect(screen.callsTo(assetEndpoints.cancelUpload)).toBe(0);
      });
    });

    describe('the background-upload registry', () => {
      const registry = () => TestBed.inject(BackgroundUploads);
      const chooseStep = (label: string) =>
        tap(
          Array.from(
            screen.el.querySelectorAll<HTMLElement>('.stepper__step'),
          ).find((s) => s.textContent?.includes(label)),
        );

      it('receives the file with its place and state, and the drawer flag', async () => {
        const drawer = await startPdfUpload();
        expect(registry().drawerOpen$()).toBe(true);
        await tap(screen.button('Lưu', drawer));

        expect(registry().drawerOpen$()).toBe(false);
        expect(registry().items$()).toMatchObject([
          {
            id: expect.any(String),
            name: 'quyen.pdf',
            place: 'Chương 1 · Bài 1',
            state: 'waiting',
            cancellable: true,
          },
        ]);
      });

      it('cancels the upload on the server when the shell asks', async () => {
        const drawer = await startPdfUpload();
        await tap(screen.button('Lưu', drawer));
        const uploadId = (
          screen.lastCall(assetEndpoints.startUpload)?.body as {
            requestId: string;
          }
        ).requestId;

        registry().cancel(registry().items$()[0].id);
        await advance(10);

        expect(screen.lastCall(assetEndpoints.cancelUpload)?.params).toEqual({
          uploadId,
        });
        expect(registry().items$()).toEqual([]);
      });

      it('drops the block of a cancelled upload, so no block without its file stays in the draft', async () => {
        const drawer = await startPdfUpload();
        await tap(screen.button('Lưu', drawer));
        expect(screen.text(screen.el)).not.toContain('Thiếu tệp');

        registry().cancel(registry().items$()[0].id);
        await advance(10);

        expect(screen.text(screen.el)).not.toContain('Thiếu tệp');
        await tap(screen.button('Sửa bài học'));
        const reopened = screen.drawer()!;
        expect(screen.text(reopened)).not.toContain('quyen.pdf');
        expect(screen.text(reopened)).not.toContain('Xóa khối');
      });

      it('opens the lesson’s drawer on its step when the shell asks', async () => {
        const drawer = await startPdfUpload();
        await tap(screen.button('Lưu', drawer));
        await chooseStep('Bài kiểm tra & điều kiện');
        expect(currentStep()).toContain('Nội dung khóa học');

        registry().open(registry().items$()[0].id);
        await advance(10);

        expect(currentStep()).toContain('Nội dung khóa học');
        expect(screen.text(screen.drawer()!)).toContain('quyen.pdf');
      });

      it('lists the cover as "Ảnh bìa" and opens step 1 for it', async () => {
        await screen.open('/admin/courses/6/edit');
        cutNetwork();
        vi.useFakeTimers();
        pick(
          screen.el.querySelector<HTMLInputElement>(
            '.course-info__cover label.dropzone input[type=file]',
          )!,
          new File(['png'], 'bia.png', { type: 'image/png' }),
        );
        await advance(100);
        expect(registry().items$()).toMatchObject([
          { name: 'bia.png', place: 'Ảnh bìa', cancellable: true },
        ]);

        await chooseStep('Nội dung khóa học');
        registry().open(registry().items$()[0].id);
        await advance(10);
        expect(currentStep()).toContain('Thông tin cơ bản');
      });

      it('lists a finished upload as done, and a refused file not at all', async () => {
        const drawer = await startPdfUpload();
        await tap(screen.button('Lưu', drawer));
        await finishUploads();
        expect(registry().items$()).toMatchObject([
          { name: 'quyen.pdf', state: 'done', percent: 100 },
        ]);
      });

      it('does not list a file refused for its type', async () => {
        await screen.open('/admin/courses/6/edit');
        await step('Nội dung khóa học');
        await screen.click(screen.button('Sửa bài học'));
        await screen.click(screen.button('Video', screen.drawer()!));
        pick(
          dropzones().at(-1)!,
          new File(['x'], 'bai.exe', { type: 'application/octet-stream' }),
        );
        await screen.settle();

        expect(registry().items$()).toEqual([]);
      });

      it('is empty once the editor is left', async () => {
        const drawer = await startPdfUpload();
        await tap(screen.button('Lưu', drawer));
        expect(registry().items$()).toHaveLength(1);

        await TestBed.inject(Router).navigateByUrl('/admin/courses');
        await advance(10);
        expect(registry().items$()).toEqual([]);
      });
    });

    describe('leaving the editor while a file uploads', () => {
      const LEAVE_MESSAGE =
        'Còn 1 tệp đang tải. Rời trang sẽ dừng tải; lần sau mở lại, chọn lại đúng tệp để tải tiếp.';
      const askOnLeave = (leave: boolean) => {
        const ask = vi.fn((_message?: string) => of(leave));
        TestBed.inject(LeavePrompt).use(ask);
        return ask;
      };
      const leave = async () => {
        const router = TestBed.inject(Router);
        const result = router.navigateByUrl('/admin/courses');
        await advance(10);
        return result;
      };

      it('asks once, with the number of files, and staying keeps the upload running', async () => {
        const drawer = await startPdfUpload();
        await tap(screen.button('Lưu', drawer));
        const ask = askOnLeave(false);

        expect(await leave()).toBe(false);
        expect(ask).toHaveBeenCalledTimes(1);
        expect(ask).toHaveBeenCalledWith(LEAVE_MESSAGE);
        expect(screen.url()).toBe('/admin/courses/6/edit');
        expect(footerText()).toContain('Còn 1 tệp đang tải');
      });

      it('asks once even with unsaved changes too', async () => {
        const drawer = await startPdfUpload();
        await tap(screen.button('Lưu', drawer));
        expect(screen.page<CourseEditor>().hasUnsavedChanges()).toBe(true);
        const ask = askOnLeave(false);

        await leave();
        expect(ask).toHaveBeenCalledTimes(1);
      });

      it('leaves when confirmed: the upload stops and stays resumable', async () => {
        const drawer = await startPdfUpload();
        await tap(screen.button('Lưu', drawer));
        askOnLeave(true);

        expect(await leave()).toBe(true);
        expect(screen.url()).toBe('/admin/courses');
        expect(
          JSON.parse(localStorage.getItem('lms.asset-uploads.v1.000002.6')!),
        ).toHaveLength(1);
      });

      it('warns on reload and tab close only while uploads run', async () => {
        const drawer = await startPdfUpload();
        await tap(screen.button('Lưu', drawer));
        const page = screen.page<CourseEditor>();
        expect(page.hasUnsavedChanges()).toBe(true);

        await finishUploads();
        await screen.click(screen.button('Lưu nháp'));
        expect(page.hasUnsavedChanges()).toBe(false);
      });

      it('does not ask without uploads or changes', async () => {
        await screen.open('/admin/courses/6/edit');
        const ask = askOnLeave(false);
        vi.useFakeTimers();

        expect(await leave()).toBe(true);
        expect(ask).not.toHaveBeenCalled();
      });
    });

    describe('the kept upload follows reordering', () => {
      const KEPT = 'lms.asset-uploads.v1.000002.6';
      const kept = () => JSON.parse(localStorage.getItem(KEPT) ?? '[]');
      const rows = () =>
        Array.from(screen.el.querySelectorAll<HTMLElement>('ui-sortable-item'));
      const moveFirstDown = (fake: boolean) => {
        const button = rows()[0].querySelector<HTMLButtonElement>(
          'button[aria-label="Chuyển xuống"]',
        );
        return fake ? tap(button!) : screen.click(button!);
      };
      /** A second lesson with a text block, added after the first. */
      async function addSecondLesson(fake: boolean) {
        const click = (el: HTMLElement | undefined) =>
          fake ? tap(el) : screen.click(el);
        await click(screen.button('Thêm bài học'));
        const drawer = screen.drawer()!;
        const title = screen.field('Tên bài học', drawer) as HTMLInputElement;
        title.value = 'Bài thứ hai';
        title.dispatchEvent(new Event('input', { bubbles: true }));
        await click(screen.button('Văn bản', drawer));
        await click(screen.button('Lưu', drawer));
      }

      it('moves a running upload’s position with its lesson, and the asset lands in the moved block', async () => {
        const drawer = await startPdfUpload();
        expect(kept()).toMatchObject([{ position: '0.0.1' }]);
        await tap(screen.button('Lưu', drawer));
        await addSecondLesson(true);

        await moveFirstDown(true);
        expect(kept()).toMatchObject([{ position: '0.1.1' }]);

        await finishUploads();
        await screen.click(screen.button('Lưu nháp'));
        const lessons = (
          screen.lastCall(courseEndpoints.saveDraft)?.body as SaveDraftCommand
        ).chapters[0].lessons;
        expect(lessons[0].blocks).toHaveLength(1);
        expect(lessons[1].blocks[1].assets).toHaveLength(1);
      });

      it('offers an interrupted upload on the moved lesson after a save and a reload', async () => {
        await screen.open('/admin/courses/6/edit');
        await step('Nội dung khóa học');
        await screen.click(screen.button('Sửa bài học'));
        await screen.click(screen.button('Tệp đính kèm', screen.drawer()!));
        await screen.click(screen.button('Lưu', screen.drawer()!));
        await screen.click(screen.button('Lưu nháp'));
        await screen.click(screen.button('Sửa bài học'));
        cutNetwork();
        vi.useFakeTimers();
        pick(dropzones().at(-1)!, pdf());
        await advance(100);
        vi.useRealTimers();
        expect(kept()).toMatchObject([{ position: '0.0.1' }]);

        const router = TestBed.inject(Router);
        await router.navigateByUrl('/admin/courses');
        await screen.settle();
        await router.navigateByUrl('/admin/courses/6/edit');
        await screen.settle();
        online();

        await step('Nội dung khóa học');
        await addSecondLesson(false);
        await moveFirstDown(false);
        await screen.click(screen.button('Lưu nháp'));
        expect(kept()).toMatchObject([{ position: '0.1.1' }]);

        await router.navigateByUrl('/admin/courses');
        await screen.settle();
        await router.navigateByUrl('/admin/courses/6/edit');
        await screen.settle();
        await step('Nội dung khóa học');
        await screen.click(
          rows()[0].querySelector(
            'button[aria-label="Sửa bài học"]',
          ) as HTMLElement,
        );
        expect(screen.text(screen.drawer()!)).not.toContain(
          'Tải lên bị gián đoạn',
        );
        await screen.click(screen.button('Hủy', screen.drawer()!) ?? undefined);

        await screen.click(
          rows()[1].querySelector(
            'button[aria-label="Sửa bài học"]',
          ) as HTMLElement,
        );
        expect(screen.text(screen.drawer()!)).toContain('Tải lên bị gián đoạn');
      });
    });

    describe('deleting what holds a running upload', () => {
      const WARNING = 'Tệp đang tải sẽ bị hủy';
      const answer = (label: string) =>
        tap(
          Array.from(
            screen.alertDialog()!.querySelectorAll<HTMLButtonElement>('button'),
          ).find((b) => b.textContent?.trim() === label),
        );
      const lastUploadId = () =>
        (
          screen.lastCall(assetEndpoints.startUpload)?.body as {
            requestId: string;
          }
        ).requestId;
      /** The lesson is saved while its file uploads, so the outline can delete it. */
      async function uploadingLesson() {
        const drawer = await startPdfUpload();
        const uploadId = lastUploadId();
        await tap(screen.button('Lưu', drawer));
        return uploadId;
      }

      it('warns when deleting the lesson, keeps the upload on "Hủy", cancels it on "Xóa"', async () => {
        const uploadId = await uploadingLesson();

        await tap(screen.button('Xóa bài học'));
        expect(screen.text(screen.alertDialog()!)).toContain(WARNING);
        await answer('Hủy');
        expect(screen.callsTo(assetEndpoints.cancelUpload)).toBe(0);
        expect(footerText()).toContain('Còn 1 tệp đang tải');

        await tap(screen.button('Xóa bài học'));
        await answer('Xóa');
        expect(screen.lastCall(assetEndpoints.cancelUpload)?.params).toEqual({
          uploadId,
        });
        expect(footerText()).not.toContain('tệp đang tải');
      });

      it('warns when deleting the chapter and cancels its uploads', async () => {
        const uploadId = await uploadingLesson();

        await tap(screen.button('Xóa chương 1'));
        expect(screen.text(screen.alertDialog()!)).toContain(WARNING);
        await answer('Xóa chương');

        expect(screen.lastCall(assetEndpoints.cancelUpload)?.params).toEqual({
          uploadId,
        });
        expect(footerText()).not.toContain('tệp đang tải');
      });

      it('warns when deleting the block in the drawer and cancels its upload', async () => {
        const drawer = await startPdfUpload();
        const uploadId = lastUploadId();

        await tap(screen.button('Xóa khối Tài liệu PDF', drawer));
        expect(screen.text(screen.alertDialog()!)).toContain(WARNING);
        await answer('Xóa khối');

        expect(screen.lastCall(assetEndpoints.cancelUpload)?.params).toEqual({
          uploadId,
        });
        expect(screen.button('Xóa khối Tài liệu PDF', drawer)).toBeUndefined();
      });

      it('deletes a lesson with no upload as before, with no such warning', async () => {
        await screen.open('/admin/courses/6/edit');
        await step('Nội dung khóa học');
        vi.useFakeTimers();
        await tap(screen.button('Xóa bài học'));

        expect(screen.text(screen.alertDialog()!)).not.toContain(WARNING);
      });
    });

    describe('the cover of a new course', () => {
      it('blocks "Tiếp theo" on step 1 while the cover uploads', async () => {
        await screen.open('/admin/courses/new');
        cutNetwork();
        vi.useFakeTimers();
        pick(
          screen.el.querySelector<HTMLInputElement>(
            '.course-info__cover label.dropzone input[type=file]',
          )!,
          new File(['png'], 'bia.png', { type: 'image/png' }),
        );
        await advance(100);

        expect(screen.button('Tiếp theo')!.disabled).toBe(true);
        expect(footerText()).toContain('Ảnh bìa đang tải lên');

        await finishUploads();
        expect(screen.button('Tiếp theo')!.disabled).toBe(false);
      });
    });

    describe('upload progress on a lesson row', () => {
      const row = () =>
        screen.el.querySelector<HTMLElement>('ui-sortable-item')!;
      const progress = () =>
        row().querySelector<HTMLElement>('.course-outline__upload');
      /** Saves the lesson that is uploading, so the outline shows its progress. */
      async function saveWhileUploading() {
        const drawer = await startPdfUpload();
        await tap(screen.button('Lưu', drawer));
      }

      it('shows a bar and a percentage on the row while the file uploads', async () => {
        await saveWhileUploading();

        expect(progress()).not.toBeNull();
        expect(progress()!.textContent).toMatch(/\d+%/);
        expect(
          progress()!.querySelector('[role="progressbar"]'),
        ).not.toBeNull();
        expect(row().textContent).not.toContain('Thiếu tệp');
      });

      it('names the file and its status in a tooltip', async () => {
        await saveWhileUploading();

        progress()!.dispatchEvent(new Event('mouseenter'));
        await advance(400);
        const tip = document.querySelector('[role="tooltip"]');
        expect(tip?.textContent).toContain('quyen.pdf');
        expect(tip?.textContent).toContain('Mất kết nối');
      });

      it('combines several files of one lesson into one bar', async () => {
        const drawer = await startPdfUpload();
        await tap(screen.button(/^\s*Tài liệu PDF/, drawer));
        pick(dropzones().at(-1)!, pdf('hai.pdf'));
        await advance(100);
        await tap(screen.button('Lưu', drawer));

        expect(row().querySelectorAll('.course-outline__upload')).toHaveLength(
          1,
        );
        progress()!.dispatchEvent(new Event('mouseenter'));
        await advance(400);
        const tip = document.querySelector('[role="tooltip"]')?.textContent;
        expect(tip).toContain('quyen.pdf');
        expect(tip).toContain('hai.pdf');
      });

      it('shows "Lỗi tải" when the file fails, opens the lesson on click, and clears when done', async () => {
        await saveWhileUploading();
        screen.calls.mockImplementation((e, r): FakeReply => {
          const reply = original(e, r);
          if (e !== assetEndpoints.completeUpload) return reply;
          const body = reply.body as { data: object };
          return {
            ...reply,
            body: {
              ...body,
              data: {
                ...body.data,
                status: 'failed',
                errorCode: MEDIA_PROCESSING_UNAVAILABLE_CODE,
                errorMessage: 'Máy chủ chưa xử lý được tệp.',
              },
            },
          } as FakeReply;
        });
        await advance(SERVER_RETRY_MS * 4 + POLL_MS * 3);

        expect(progress()).toBeNull();
        const failed = row().querySelector<HTMLButtonElement>(
          '.course-outline__upload-error',
        );
        expect(failed?.textContent).toContain('Lỗi tải');
        await tap(failed!);
        expect(screen.text(screen.drawer()!)).toContain(
          'Máy chủ chưa xử lý được tệp.',
        );

        online();
        await tap(screen.button('Xử lý lại', screen.drawer()!));
        await advance(POLL_MS * 3);
        vi.useRealTimers();
        await screen.settle();
        expect(row().querySelector('.course-outline__upload-error')).toBeNull();
        expect(progress()).toBeNull();
      });

      it('shows nothing on a lesson without a running upload', async () => {
        await screen.open('/admin/courses/6/edit');
        await step('Nội dung khóa học');
        expect(progress()).toBeNull();
      });
    });

    describe('the outline rows', () => {
      const lessonRow = () =>
        screen.el.querySelector<HTMLElement>('ui-sortable-item')!;
      const iconButtons = (row: HTMLElement) =>
        Array.from(row.querySelectorAll<HTMLButtonElement>('button'));

      it('shows the lesson actions as icon-only buttons named by their tooltip', async () => {
        await screen.open('/admin/courses/6/edit');
        await step('Nội dung khóa học');
        const buttons = iconButtons(lessonRow());

        expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
          'Sửa bài học',
          'Xóa bài học',
          'Chuyển lên',
          'Chuyển xuống',
        ]);
        expect(buttons.map((b) => b.textContent?.trim())).toEqual([
          '',
          '',
          '',
          '',
        ]);
        expect(buttons[2].disabled).toBe(true);
      });
    });
  });
});
