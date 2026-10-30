import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { communityEndpoints } from '@lms/contracts';
import { backendRefusal } from '@lms/mocks';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import {
  configureCommunityTesting,
  openCommunity,
  type CommunityPage,
} from '../community.testing';

const type = async (page: CommunityPage, selector: string, value: string) => {
  const field = page
    .el()
    .querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  field.value = value;
  field.dispatchEvent(new Event('input'));
  await page.settle();
};

describe('CommunityEditor', () => {
  beforeEach(() => configureCommunityTesting());

  it('creates an article draft and moves to its edit address', async () => {
    const page = await openCommunity('/community/articles/new', 'giangvien');

    expect(page.text()).toContain('Viết bài');
    await type(
      page,
      'input[placeholder="Một câu nói rõ bài viết về gì"]',
      'Ghi chú cấu hình pool',
    );
    await page.click('Lưu nháp');

    const [created] = page.bodies(communityEndpoints.createArticle) as {
      title: string;
      clientRequestId: string;
    }[];
    expect(created.title).toBe('Ghi chú cấu hình pool');
    // The draft now has an address of its own, and the editor shows it.
    await page.waitForText('Sửa bản nháp');
  });

  it('asks for the incident fields before publishing a lesson learned', async () => {
    const page = await openCommunity(
      '/community/articles/new?type=lesson',
      'giangvien',
    );

    expect(page.text()).toContain('Ghi bài học sự cố');
    expect(page.text()).toContain('Nguyên nhân gốc');
    await type(
      page,
      'input[placeholder="Một câu nói rõ bài viết về gì"]',
      'Sự cố chứng chỉ hết hạn',
    );
    await page.click('Đăng bài');

    expect(page.bodies(communityEndpoints.createLesson)).toEqual([]);
    expect(page.text()).toContain('Triệu chứng cần ít nhất 20 ký tự.');
  });

  it('edits a published article on a draft and publishes the new revision', async () => {
    const page = await openCommunity(
      '/community/contents/110/edit',
      'giangvien',
    );

    expect(page.text()).toContain('Sửa bài đã đăng');
    expect(page.text()).toContain('Bạn đang sửa bản nháp của bài đã đăng');
    const title = page
      .el()
      .querySelector<HTMLInputElement>(
        'input[placeholder="Một câu nói rõ bài viết về gì"]',
      )!;
    expect(title.value).toBe('Checklist trước khi release lên OpenShift');
    await type(
      page,
      'input[placeholder="Ví dụ: Sửa lại giá trị timeout"]',
      'Thêm bước kiểm tra',
    );
    await page.click('Đăng bản mới');

    expect(page.bodies(communityEndpoints.openDraft)).toHaveLength(1);
    expect(page.bodies(communityEndpoints.saveDraft).at(-1)).toMatchObject({
      changeNote: 'Thêm bước kiểm tra',
    });
    expect(page.bodies(communityEndpoints.publishContent)).toHaveLength(1);
  });

  it('publishes on the second try after a refused publish, without a conflict', async () => {
    const backend = TestBed.inject(MockBackend);
    const original: MockBackend['handle'] = (endpoint, request) =>
      MockBackend.prototype.handle.call(backend, endpoint, request);
    const page = await openCommunity(
      '/community/contents/110/edit',
      'giangvien',
    );
    page.handle.mockImplementation((endpoint, request) =>
      endpoint === communityEndpoints.publishContent
        ? backendRefusal('internalError')
        : original(endpoint, request),
    );
    await page.click('Đăng bản mới');
    expect(page.bodies(communityEndpoints.publishContent)).toHaveLength(1);

    page.handle.mockImplementation(original);
    await page.click('Đăng bản mới');

    expect(page.bodies(communityEndpoints.openDraft)).toHaveLength(1);
    expect(page.bodies(communityEndpoints.publishContent)).toHaveLength(2);
    expect(page.text()).not.toContain('Dữ liệu đã thay đổi');
    await page.waitForText('Đã đăng bản mới');
    // The content route loads lazily after the toast.
    const router = TestBed.inject(Router);
    for (let i = 0; i < 50 && router.url.endsWith('/edit'); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await page.settle();
    }
    expect(router.url).toBe('/community/contents/110');
  });

  it('edits an answer without title or tags and names its question', async () => {
    const page = await openCommunity(
      '/community/contents/102/edit',
      'giangvien',
    );

    expect(page.text()).toContain('Sửa câu trả lời');
    expect(page.text()).toContain('Oracle UCP báo timeout khi lấy connection');
    expect(page.text()).toContain('Câu trả lời này đã được chấp nhận');
    expect(page.el().querySelector('app-tag-picker')).toBeNull();
    expect(page.controls('Đăng câu trả lời')).toHaveLength(1);
  });

  it('refuses to edit someone else’s post', async () => {
    const page = await openCommunity('/community/contents/110/edit', 'hocvien');

    expect(page.text()).toContain('Bạn không sửa được bài này');
  });

  it('keeps the chosen kind in the address', async () => {
    const page = await openCommunity('/community/articles/new', 'giangvien');

    const lesson = Array.from(
      page
        .el()
        .querySelectorAll<HTMLElement>(
          'ui-segmented [role="radio"], ui-segmented [role="option"]',
        ),
    ).find((option) => option.textContent?.includes('Bài học sự cố'))!;
    lesson.click();
    await page.settle();

    expect(TestBed.inject(Router).url).toBe(
      '/community/articles/new?type=lesson',
    );
    expect(page.text()).toContain('Ghi bài học sự cố');
  });
});
