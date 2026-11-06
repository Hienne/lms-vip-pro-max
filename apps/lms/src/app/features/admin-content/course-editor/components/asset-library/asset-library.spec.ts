import {
  assetEndpoints,
  courseEndpoints,
  type SaveDraftCommand,
} from '@lms/contracts';
import { envelopeError } from '@lms/mocks';
import { setUpAdminScreen } from '../../../../../core/dev/mock-api/admin-screen.testing';

describe('AssetLibrary in the lesson form', () => {
  const screen = setUpAdminScreen();

  const step = (label: string) =>
    screen.click(
      Array.from(
        screen.el.querySelectorAll<HTMLElement>('.stepper__step'),
      ).find((s) => s.textContent?.includes(label)),
    );

  /** The lesson drawer with a new block of `chip`, and the library opened for it. */
  async function openLibrary(chip: string) {
    await screen.open('/admin/courses/6/edit');
    await step('Nội dung khóa học');
    await screen.click(screen.button('Sửa bài học'));
    const lesson = screen.drawer()!;
    await screen.click(screen.button(chip, lesson));
    await screen.click(screen.button('Chọn từ thư viện', lesson));
    return { lesson, library: libraryDrawer() };
  }
  const libraryDrawer = () =>
    document.querySelectorAll<HTMLElement>('[role="dialog"]')[1];
  const names = () =>
    Array.from(
      libraryDrawer().querySelectorAll<HTMLElement>('.asset-library__pick'),
    ).map((b) => b.textContent?.trim());

  it('lists the ready files of the block kind and nothing of the others', async () => {
    const { library } = await openLibrary('Tài liệu PDF');

    expect(screen.text(library)).toContain('Thư viện tài nguyên');
    expect(screen.lastCall(assetEndpoints.listAssets)?.query).toMatchObject({
      mediaType: 'document',
      status: 'ready',
      size: '20',
      sort: 'createTime,desc',
    });
    expect(names()).toContain('quy-trinh-doi-soat.pdf');
    expect(names().some((name) => name?.endsWith('.mp4'))).toBe(false);
  });

  it('gives the file to the block when its name is picked, and closes', async () => {
    const { lesson, library } = await openLibrary('Tài liệu PDF');

    await screen.click(screen.button('Chọn quy-trinh-doi-soat.pdf', library));

    expect(libraryDrawer()).toBeUndefined();
    expect(screen.text(lesson)).toContain('quy-trinh-doi-soat.pdf');
    await screen.click(screen.button('Lưu', lesson));
    await screen.click(screen.button('Lưu nháp'));
    const saved = screen.lastCall(courseEndpoints.saveDraft)
      ?.body as SaveDraftCommand;
    expect(saved.chapters[0].lessons[0].blocks[1]).toMatchObject({
      blockType: 'pdf',
      assets: [{ assetId: 9001, usage: 'primary' }],
    });
  });

  it('searches by name on the server', async () => {
    const { library } = await openLibrary('Tài liệu PDF');
    const search =
      library.querySelector<HTMLInputElement>('input[type=search]')!;
    search.value = 'van-hanh';
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await screen.settle();

    expect(screen.lastCall(assetEndpoints.listAssets)?.query).toMatchObject({
      q: 'van-hanh',
    });
    expect(names()).toEqual(['huong-dan-van-hanh.pdf']);
  });

  it('says so when nothing matches', async () => {
    const { library } = await openLibrary('Tài liệu PDF');
    const search =
      library.querySelector<HTMLInputElement>('input[type=search]')!;
    search.value = 'khong-co-tep-nay';
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await screen.settle();

    expect(screen.text(library)).toContain('Không có tệp phù hợp');
  });

  it('asks before deleting, then removes the file from the list', async () => {
    const { library } = await openLibrary('Tài liệu PDF');
    await screen.click(
      screen.button('Thêm thao tác cho quy-trinh-doi-soat.pdf', library),
    );
    await screen.click(
      Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ).find((item) => item.textContent?.includes('Xóa khỏi thư viện')),
    );

    const dialog = screen.alertDialog()!;
    expect(screen.text(dialog)).toContain('Xóa tệp quy-trinh-doi-soat.pdf?');
    expect(screen.callsTo(assetEndpoints.deleteAsset)).toBe(0);
    await screen.click(screen.button('Xóa', dialog));

    expect(screen.lastCall(assetEndpoints.deleteAsset)?.params).toEqual({
      assetId: '9001',
    });
    expect(names()).not.toContain('quy-trinh-doi-soat.pdf');
    expect(screen.text(document.body)).toContain('Đã xóa tệp khỏi thư viện');
  });

  it('toasts the server message for a file a course uses, and keeps the file listed', async () => {
    const { library } = await openLibrary('Tài liệu PDF');
    const used = names().find(
      (n) => n !== 'quy-trinh-doi-soat.pdf' && n !== 'huong-dan-van-hanh.pdf',
    )!;
    await screen.click(screen.button(`Thêm thao tác cho ${used}`, library));
    await screen.click(
      Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ).find((item) => item.textContent?.includes('Xóa khỏi thư viện')),
    );
    await screen.click(screen.button('Xóa', screen.alertDialog()!));

    expect(screen.text(document.body)).toContain('Tài nguyên còn được sử dụng');
    expect(names()).toContain(used);
  });

  it('offers a retry when the library cannot be read', async () => {
    await screen.open('/admin/courses/6/edit');
    await step('Nội dung khóa học');
    await screen.click(screen.button('Sửa bài học'));
    const lesson = screen.drawer()!;
    await screen.click(screen.button('Tài liệu PDF', lesson));
    const original = screen.calls.getMockImplementation();
    screen.calls.mockImplementation((endpoint, request) =>
      endpoint === assetEndpoints.listAssets
        ? {
            status: 500,
            body: envelopeError('CORE-INTERNAL_ERROR', 'Lỗi', 'Lỗi hệ thống'),
          }
        : (original ?? (() => undefined))(endpoint, request),
    );
    await screen.click(screen.button('Chọn từ thư viện', lesson));

    expect(screen.text(libraryDrawer())).toContain('Không tải được thư viện');
    expect(screen.button('Thử lại', libraryDrawer())).toBeTruthy();
  });
});
