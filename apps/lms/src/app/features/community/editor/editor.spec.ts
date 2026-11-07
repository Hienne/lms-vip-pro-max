import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  communityEndpoints,
  communityMediaEndpoints as media,
} from '@lms/contracts';
import { backendRefusal, envelopeOk } from '@lms/mocks';
import { contentFormFrom, toDraftFields } from '../data-access/content-form';
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

  it('preserves structured review context and unrelated assets when replacing a design file', () => {
    const value = contentFormFrom(
      {
        contentId: 12,
        revisionId: 2,
        revisionNo: 1,
        revisionVersion: 0,
        contentVersion: 0,
        title: 'Review API',
        bodyMarkdown: 'Thiết kế API cần phản biện.',
        revisionStatus: 'draft',
        context: {
          review: {
            problem: 'Vấn đề cần phản biện đầy đủ.',
            constraints: 'Tương thích API',
            decisionsNeeded: ['Thống nhất retry', 'Giữ idempotency'],
          },
        },
        assets: [
          { revisionAssetId: 10, assetId: 20, usage: 'design_file', sortNo: 0 },
          {
            revisionAssetId: 11,
            assetId: 21,
            usage: 'attachment',
            caption: 'Log tổng hợp',
            sortNo: 1,
          },
        ],
      },
      [],
    );
    expect(value.review.decisions).toBe('Thống nhất retry\nGiữ idempotency');
    const fields = toDraftFields(value, {
      review: true,
      design: {
        assetId: 30,
        usage: 'design_file',
        caption: 'Thiết kế v2.pdf',
        sortNo: 0,
      },
      cover: { assetId: 40, usage: 'cover', sortNo: 0 },
    });
    expect(fields.context?.review).toEqual({
      problem: 'Vấn đề cần phản biện đầy đủ.',
      constraints: 'Tương thích API',
      decisionsNeeded: ['Thống nhất retry', 'Giữ idempotency'],
    });
    expect(fields.assets?.map((asset) => asset.assetId)).toEqual([21, 40, 30]);
    expect(
      toDraftFields(value, { review: true, cover: null }).assets?.map(
        (asset) => asset.assetId,
      ),
    ).toEqual([20, 21]);
    expect(
      toDraftFields(value, { review: true, design: null }).assets?.map(
        (asset) => asset.assetId,
      ),
    ).toEqual([21]);
  });

  it('opens the dedicated architecture review editor with separate cover and design file controls', async () => {
    const page = await openCommunity('/community/reviews/new', 'giangvien');
    expect(page.text()).toContain('Tạo đề nghị review');
    expect(page.text()).toContain('Vấn đề cần giải quyết');
    expect(page.text()).toContain('Quyết định cần thống nhất');
    expect(
      page.el().querySelector('app-community-cover-picker'),
    ).not.toBeNull();
    expect(
      page.el().querySelector('input[type="file"]')?.getAttribute('accept'),
    ).toContain('application/pdf');
    await page.click('Đăng thiết kế');
    expect(page.text()).toContain('Mô tả vấn đề cần ít nhất 20 ký tự.');
  });

  it('preserves attachment metadata while changing or removing only the cover', () => {
    const value = contentFormFrom(
      {
        contentId: 1,
        revisionId: 2,
        revisionNo: 1,
        revisionVersion: 1,
        contentVersion: 1,
        title: 'Existing article',
        bodyMarkdown: 'Existing article body.',
        revisionStatus: 'draft',
        assets: [
          { revisionAssetId: 10, assetId: 20, usage: 'cover', sortNo: 0 },
          {
            revisionAssetId: 11,
            assetId: 21,
            usage: 'attachment',
            caption: 'Keep this caption',
            altText: null,
            sortNo: 2,
          },
        ],
      },
      [],
    );
    expect(toDraftFields(value).assets).toEqual(value.assets);
    expect(toDraftFields(value, { cover: null }).assets).toEqual([
      value.assets[1],
    ]);
    expect(
      toDraftFields(value, {
        cover: { assetId: 30, usage: 'cover', sortNo: 0 },
      }).assets,
    ).toEqual([value.assets[1], { assetId: 30, usage: 'cover', sortNo: 0 }]);
  });

  it('shows a default cover and rejects an unsupported file before uploading', async () => {
    const page = await openCommunity('/community/articles/new', 'giangvien');
    expect(
      page.el().querySelector('app-content-thumbnail img')?.getAttribute('src'),
    ).toContain('/images/community-defaults.png');
    const input = page
      .el()
      .querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['bad'], 'bad.pdf', { type: 'application/pdf' })],
    });
    input.dispatchEvent(new Event('change'));
    await page.settle();
    expect(page.text()).toContain('Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB.');
    expect(page.bodies(media.startUpload)).toHaveLength(0);
  });

  it.each([
    ['/community/articles/new', communityEndpoints.createArticle],
    ['/community/questions/new', communityEndpoints.createQuestion],
  ] as const)(
    'uploads, saves and removes a cover at %s',
    async (route, createEndpoint) => {
      const originalBuffer = Blob.prototype.arrayBuffer;
      const originalCreate = URL.createObjectURL;
      const originalRevoke = URL.revokeObjectURL;
      Blob.prototype.arrayBuffer = async () => new Uint8Array([1, 2, 3]).buffer;
      URL.createObjectURL = vi.fn(() => 'blob:community-cover');
      URL.revokeObjectURL = vi.fn();
      try {
        const page = await openCommunity(route, 'giangvien');
        const backend = TestBed.inject(MockBackend);
        const session = {
          uploadId: crypto.randomUUID(),
          assetId: 9123,
          status: 'uploading',
          partSize: 8_388_608,
          totalBytes: 3,
          uploadedBytes: 0,
        };
        page.handle.mockImplementation((endpoint, request) => {
          if (endpoint === media.startUpload)
            return { status: 200, body: envelopeOk(session) };
          if (endpoint === media.uploadPart)
            return {
              status: 200,
              body: envelopeOk({
                ...session,
                partNumber: 1,
                sizeBytes: 3,
                checksumSha256: 'a'.repeat(64),
                uploadedBytes: 3,
              }),
            };
          if (endpoint === media.completeUpload)
            return {
              status: 200,
              body: envelopeOk({
                ...session,
                status: 'ready',
                uploadedBytes: 3,
              }),
            };
          if (endpoint === media.content)
            return {
              status: 200,
              body: envelopeOk(null),
              file: new Blob(['image'], { type: 'image/webp' }),
            };
          return MockBackend.prototype.handle.call(backend, endpoint, request);
        });
        const input = page
          .el()
          .querySelector<HTMLInputElement>(
            'app-community-cover-picker input[type="file"]',
          )!;
        Object.defineProperty(input, 'files', {
          value: [new File(['img'], 'cover.webp', { type: 'image/webp' })],
        });
        input.dispatchEvent(new Event('change'));
        await page.waitForText('Dùng ảnh mặc định');
        expect(page.bodies(media.uploadPart)).toHaveLength(1);
        await type(page, 'input[autocomplete="off"]', 'Nội dung có ảnh bìa');
        await page.click('Lưu nháp');
        expect(page.bodies(createEndpoint)[0]).toMatchObject({
          assets: [{ assetId: 9123, usage: 'cover', sortNo: 0 }],
        });
        await page.waitForText('Sửa bản nháp');
        await page.click('Dùng ảnh mặc định');
        await page.click('Lưu nháp');
        expect(page.bodies(communityEndpoints.saveDraft).at(-1)).toMatchObject({
          assets: [],
        });
      } finally {
        Blob.prototype.arrayBuffer = originalBuffer;
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
      }
    },
  );

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
