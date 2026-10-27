import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  assetEndpoints,
  courseEndpoints,
  MEDIA_PROCESSING_UNAVAILABLE_CODE,
  type AnyEndpoint,
  type SaveDraftCommand,
} from '@lms/contracts';
import { envelopeError, type FakeReply, type FakeRequest } from '@lms/mocks';
import { NEVER } from 'rxjs';
import { setUpAdminScreen } from '../../../core/dev/mock-api/admin-screen.testing';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import { CourseEditor } from './course-editor';
import { POLL_MS } from './data-access/chunked-upload';
import { digestOf, FakeHasher } from './data-access/fake-hasher.testing';
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

  it('saves then publishes after confirming, and goes back to the list', async () => {
    await screen.open('/admin/courses/6/edit');
    await step('Hoàn thành & xuất bản');
    expect(screen.text()).toContain('Sẵn sàng xuất bản.');

    await screen.click(screen.button('Xuất bản khóa học'));
    await screen.click(screen.button('Xuất bản', screen.alertDialog()!));

    expect(screen.lastCall(courseEndpoints.publish)?.body).toEqual({
      expectedVersion: 1,
    });
    await vi.waitFor(() => expect(screen.url()).toBe('/admin/courses'));
    expect(screen.text(document.body)).toContain('Đã xuất bản khóa học');
  });
});
