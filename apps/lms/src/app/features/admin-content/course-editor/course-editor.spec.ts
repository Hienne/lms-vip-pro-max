import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  assessmentV1Endpoints,
  assetEndpoints,
  courseEndpoints,
  MEDIA_PROCESSING_UNAVAILABLE_CODE,
  type AnyEndpoint,
  type CreateCourseCommand,
  type SaveDraftCommand,
} from '@lms/contracts';
import {
  ARCHITECTURE_VIDEO,
  backendRefusal,
  envelopeError,
  type FakeReply,
  type FakeRequest,
} from '@lms/mocks';
import { NEVER } from 'rxjs';
import { setUpAdminScreen } from '../../../core/dev/mock-api/admin-screen.testing';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import { CourseEditor } from './course-editor';
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
      screen.el.querySelector<HTMLElement>(
        '[aria-label="Sửa Kiến trúc tổng thể hệ thống Core Banking"]',
      ) ?? undefined,
    );
    await screen.click(screen.button('Áp dụng', screen.drawer()!));
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
    expect(screen.text(drawer)).toContain('Sửa bài học');
    await screen.type(
      screen.field('Tên bài học', drawer) as HTMLInputElement,
      'Phân quyền theo vai trò',
    );
    await screen.click(screen.button('Văn bản / Markdown', drawer));
    await screen.type(
      screen.field('Nội dung', drawer) as HTMLTextAreaElement,
      '## Vai trò',
    );
    await screen.click(screen.button('Áp dụng', drawer));

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
              title: 'Văn bản / Markdown',
              body: '## Vai trò',
              bodyFormat: 'markdown',
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
      await screen.click(screen.button('Sửa Nguyên tắc quyền tối thiểu'));
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
      await screen.click(screen.button('Áp dụng', drawer));
      await screen.click(screen.button('Lưu nháp'));
      await screen.click(screen.button('Sửa Nguyên tắc quyền tối thiểu'));

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
      await screen.click(screen.button('Áp dụng', drawer));

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

      await screen.click(screen.button('Áp dụng', drawer));
      await screen.click(screen.button('Lưu nháp'));

      const saved = screen.lastCall(courseEndpoints.saveDraft)
        ?.body as SaveDraftCommand;
      expect(saved.chapters[0].lessons[0].blocks[1]).toMatchObject({
        blockType: 'pdf',
        completionMode: 'pdf_end',
        assets: [{ assetId: expect.any(Number), usage: 'primary' }],
      });
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

    it('cancels a file while it is being checked, without touching the server', async () => {
      vi.spyOn(hasher, 'hash').mockReturnValue(NEVER);
      await screen.open('/admin/courses/6/edit');
      const drawer = await openLesson();
      await screen.click(screen.button('Tài liệu PDF', drawer));
      pick(dropzones().at(-1)!, pdf());
      await screen.settle();

      expect(screen.text(drawer)).toContain('Đang kiểm tra tệp… 0%');
      await screen.click(screen.button('Áp dụng', drawer));
      expect(screen.text(drawer)).toContain('chưa tải xong');

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
      await screen.click(screen.button('Áp dụng', drawer));
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

      await screen.click(screen.button('Sửa Thi cuối khóa'));
      expect(
        (screen.field('Bài kiểm tra', screen.drawer()!) as HTMLSelectElement)
          .value,
      ).toBe('2');
    });

    it('sends no quizId for a lesson that has none yet, and says so in the outline', async () => {
      listQuizzes();
      const drawer = await addQuizLesson();
      await screen.click(screen.button('Áp dụng', drawer));
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
      await screen.click(screen.button('Áp dụng', drawer));
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
      expect(steps[2]).toContain('Bài thi & điều kiện');
      expect(steps[2]).toContain('Điều kiện hoàn thành, điểm thưởng');
      expect(steps[3]).toContain('Đối tượng & xuất bản');
      expect(steps[3]).toContain('Kiểm tra trước khi xuất bản');
    });

    it('puts the completion rules and the reward on step 3', async () => {
      await screen.open('/admin/courses/6/edit');
      await step('Bài thi & điều kiện');

      expect(screen.text()).toContain('Điều kiện hoàn thành');
      expect(screen.field('Điểm thưởng khi hoàn thành')).toBeTruthy();
      expect(screen.text()).not.toContain('Kiểm tra trước khi xuất bản Có');
    });

    it('puts the checklist and the summary on step 4, linking back to what is missing', async () => {
      await screen.open('/admin/courses/6/edit');
      await screen.type(screen.field('Tên khóa học') as HTMLInputElement, '');
      await step('Đối tượng & xuất bản');

      expect(screen.field('Điểm thưởng khi hoàn thành')).toBeUndefined();
      expect(screen.text()).toContain('Tóm tắt khóa học');
      expect(screen.text()).toContain('Số bài học');
      expect(screen.text()).toContain(
        'Hoàn thiện các mục trên trước khi xuất bản.',
      );

      await screen.click(screen.button('Bổ sung'));
      expect(screen.field('Tên khóa học')).toBeTruthy();
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
      const listQuizzes = (status = 'PUBLISHED') =>
        screen.calls.mockImplementation((endpoint, request) => {
          if (endpoint !== assessmentV1Endpoints.courseQuizList)
            return original(endpoint, request);
          const reply = original(endpoint, {
            ...request,
            query: { ...request.query, courseId: '1' },
          });
          const { items } = reply.body.data as {
            items: { quizType: string; status: string }[];
          };
          for (const item of items)
            if (item.quizType === 'FINAL_EXAM') item.status = status;
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
        await step('Bài thi & điều kiện');

        expect(screen.text()).toContain('Bài kiểm tra cuối khóa');
        expect(screen.text()).toContain(
          'Cấu hình thời gian, số câu, điểm đạt, số lần thi tại màn Bài kiểm tra.',
        );
        expect(labels()).toEqual([
          'Không yêu cầu bài kiểm tra',
          'Thi cuối khóa: Tổng quan hệ thống Core Banking',
        ]);
        expect(screen.text()).toContain(
          'Đạt bài kiểm tra cuối khóa (chưa chọn)',
        );
      });

      it('says when a final exam is a draft or closed', async () => {
        listQuizzes('DRAFT');
        await screen.open('/admin/courses/6/edit');
        await step('Bài thi & điều kiện');
        expect(labels()[1]).toMatch(/ · Nháp$/);
      });

      it('saves the choice, shows it again, and lists it as a completion rule', async () => {
        listQuizzes();
        await screen.open('/admin/courses/6/edit');
        await step('Bài thi & điều kiện');
        await screen.choose(exam(), '2');
        expect(screen.text()).not.toContain('(chưa chọn)');
        await screen.click(screen.button('Lưu nháp'));

        expect(screen.lastCall(courseEndpoints.saveDraft)?.body).toMatchObject({
          finalQuizId: 2,
        });
        await step('Bài thi & điều kiện');
        expect(exam().value).toBe('2');
      });

      it('sends no final quiz once "no exam" is chosen again', async () => {
        listQuizzes();
        await screen.open('/admin/courses/6/edit');
        await step('Bài thi & điều kiện');
        await screen.choose(exam(), '2');
        await screen.choose(exam(), '');
        await screen.click(screen.button('Lưu nháp'));

        expect(
          screen.lastCall(courseEndpoints.saveDraft)?.body,
        ).not.toHaveProperty('finalQuizId');
      });

      it('says to create one when the course has no final exam', async () => {
        await screen.open('/admin/courses/6/edit');
        await step('Bài thi & điều kiện');

        expect(labels()).toEqual(['Không yêu cầu bài kiểm tra']);
        expect(screen.text()).toContain(
          'Khóa học chưa có bài thi cuối khóa. Tạo bài kiểm tra loại Thi cuối khóa ở màn Bài kiểm tra.',
        );
      });

      it('requires the chosen exam to be published on the checklist', async () => {
        listQuizzes('DRAFT');
        await screen.open('/admin/courses/6/edit');
        await step('Bài thi & điều kiện');
        await screen.choose(exam(), '2');
        await step('Đối tượng & xuất bản');

        expect(screen.text()).toContain('Bài kiểm tra cuối khóa đã xuất bản');
        expect(screen.text()).toContain(
          'Hoàn thiện các mục trên trước khi xuất bản.',
        );
        await screen.click(
          screen.button(
            'Bổ sung',
            screen.el.querySelectorAll<HTMLElement>('.course-review__check')[5],
          ),
        );
        expect(exam()).toBeTruthy();
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

      it('shows only "save first" in create mode', async () => {
        await screen.open('/admin/courses/new');
        await step('Bài thi & điều kiện');

        expect(screen.text()).toContain('Lưu nháp trước để chọn bài kiểm tra');
        expect(
          screen.field('Bài kiểm tra dùng để xét hoàn thành'),
        ).toBeUndefined();
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
      expect(primaries()).toEqual(['Tiếp tục']);

      await screen.click(screen.button('Tiếp tục'));
      await screen.click(screen.button('Tiếp tục'));
      expect(screen.button('Hủy')).toBeUndefined();
      expect(screen.button('Quay lại')).toBeTruthy();
      expect(primaries()).toEqual(['Tiếp tục']);

      await screen.click(screen.button('Tiếp tục'));
      expect(primaries()).toEqual(['Xuất bản khóa học']);
      expect(screen.button('Lưu nháp')).toBeTruthy();
    });
  });

  describe('create mode', () => {
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
      await screen.click(screen.button('Văn bản / Markdown', drawer));
      await screen.click(screen.button('Áp dụng', drawer));
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

    it('stays on an empty first step on "Tiếp tục", lists it and focuses its first error', async () => {
      await screen.open('/admin/courses/new');
      await screen.click(screen.button('Tiếp tục'));

      expect(currentStep()).toContain('Thông tin cơ bản');
      expect(screen.text()).toContain(
        'Còn thông tin chưa hợp lệ ở: Thông tin cơ bản.',
      );
      expect(screen.text()).toContain('Nhập tên khóa học.');
      expect(screen.text()).toContain('Nhập mã khóa học.');
      expect(document.activeElement).toBe(screen.field('Tên khóa học'));
      expect(screen.callsTo(courseEndpoints.createCourse)).toBe(0);
    });

    it('moves on with "Tiếp tục" once the first step is valid', async () => {
      await screen.open('/admin/courses/new');
      await fillBasics();
      await screen.click(screen.button('Tiếp tục'));

      expect(currentStep()).toContain('Nội dung khóa học');
      expect(screen.text()).not.toContain('Còn thông tin chưa hợp lệ');
    });

    it('marks a step done only while it is visited, valid and not open', async () => {
      await screen.open('/admin/courses/new');
      expect(doneSteps()).toEqual([]);

      await step('Nội dung khóa học');
      expect(doneSteps()).toEqual([]);

      await step('Thông tin cơ bản');
      await fillBasics();
      await screen.click(screen.button('Tiếp tục'));
      expect(doneSteps()).toEqual(['Thông tin cơ bản']);
      expect(screen.text()).toContain('Đã hoàn thành');

      await step('Thông tin cơ bản');
      await screen.type(screen.field('Tên khóa học') as HTMLInputElement, '');
      await step('Bài thi & điều kiện');
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

    it('creates the course with the whole tree in one call, then continues on its edit URL', async () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
      await screen.open('/admin/courses/new');
      await fillBasics();
      await addChapterWithLesson();
      await screen.click(screen.button('Lưu nháp'));

      expect(screen.callsTo(courseEndpoints.createCourse)).toBe(1);
      expect(screen.callsTo(courseEndpoints.saveDraft)).toBe(0);
      const body = screen.lastCall(courseEndpoints.createCourse)
        ?.body as CreateCourseCommand;
      expect(body).toMatchObject({
        code: 'WIZ-NEW-1',
        draft: {
          title: 'Khóa thử',
          programId: 1,
          chapters: [
            { title: 'Chương 1', lessons: [{ title: 'Bài đầu tiên' }] },
          ],
        },
      });
      expect(body.ownerOrgId).toBeGreaterThan(0);
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
        expectedVersion: 1,
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
        expect(screen.url()).toMatch(/^\/admin\/courses\/\d+\/edit\?step=3$/),
      );
      expect(screen.text(document.body)).toContain(
        'Đã lưu nháp, chưa xuất bản',
      );
    });

    it('says to save first instead of listing quizzes', async () => {
      await screen.open('/admin/courses/new');
      await step('Nội dung khóa học');
      await screen.click(screen.button('Thêm chương'));
      await screen.click(screen.button('Thêm bài học'));
      const drawer = screen.drawer()!;
      await screen.choose(
        screen.field('Loại bài', drawer) as HTMLSelectElement,
        'quiz',
      );

      expect(screen.text(drawer)).toContain(
        'Lưu nháp trước để chọn bài kiểm tra',
      );
      expect(screen.field('Bài kiểm tra', drawer)).toBeUndefined();
      expect(screen.callsTo(assessmentV1Endpoints.courseQuizList)).toBe(0);
    });
  });
});
