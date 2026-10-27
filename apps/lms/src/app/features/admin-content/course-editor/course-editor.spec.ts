import { courseEndpoints, type SaveDraftCommand } from '@lms/contracts';
import { setUpAdminScreen } from '../../../core/dev/mock-api/admin-screen.testing';
import { CourseEditor } from './course-editor';

describe('CourseEditor', () => {
  const screen = setUpAdminScreen();
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

  it('needs the file of a PDF block, uploads it and attaches it to the block', async () => {
    await screen.open('/admin/courses/6/edit');
    await step('Nội dung khóa học');
    await screen.click(screen.button('Sửa Nguyên tắc quyền tối thiểu'));
    const drawer = screen.drawer()!;
    await screen.click(screen.button('Tài liệu PDF', drawer));
    await screen.click(screen.button('Áp dụng', drawer));

    expect(screen.drawer()).not.toBeNull();
    expect(screen.text(drawer)).toContain('chưa có tệp');

    const input = Array.from(
      drawer.querySelectorAll<HTMLInputElement>('input[type=file]'),
    ).at(-1)!;
    const file = new File(['%PDF-1.4 /Type /Page'], 'quyen.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() =>
      expect(screen.callsTo(courseEndpoints.uploadAsset)).toBe(1),
    );
    await screen.settle();

    expect(screen.lastCall(courseEndpoints.uploadAsset)?.query).toMatchObject({
      ownerOrgId: '1',
    });
    expect(screen.text(drawer)).toContain('quyen.pdf');
    await screen.click(screen.button('Áp dụng', drawer));
    await screen.click(screen.button('Lưu nháp'));

    const saved = screen.lastCall(courseEndpoints.saveDraft)
      ?.body as SaveDraftCommand;
    const blocks = saved.chapters[0].lessons[0].blocks;
    expect(blocks[1]).toMatchObject({
      blockType: 'pdf',
      completionMode: 'pdf_end',
      assets: [{ assetId: expect.any(Number), usage: 'primary' }],
    });
  });

  it('refuses a file of the wrong type before uploading', async () => {
    await screen.open('/admin/courses/6/edit');
    await step('Nội dung khóa học');
    await screen.click(screen.button('Sửa Nguyên tắc quyền tối thiểu'));
    const drawer = screen.drawer()!;
    await screen.click(screen.button('Video', drawer));
    const input = drawer.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'bai.exe', { type: 'application/octet-stream' })],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() =>
      expect(screen.text(drawer)).toContain(
        'Sai định dạng: chỉ chấp nhận MP4, WEBM.',
      ),
    );
    expect(screen.callsTo(courseEndpoints.uploadAsset)).toBe(0);
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
