import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { learnerEndpoints, personalEndpoints } from '@lms/contracts';
import { backendRefusal } from '@lms/mocks';
import type { MockInstance } from 'vitest';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../core/dev/mock-api/mock-backend.testing';
import { SessionStore } from '../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';

describe('Saved', () => {
  let backend: MockBackend;
  let handle: MockInstance<MockBackend['handle']>;
  let token: string;
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  const real = (): MockBackend['handle'] => (endpoint, request) =>
    MockBackend.prototype.handle.call(backend, endpoint, request);

  /** The mock backend called directly, as the signed-in learner. */
  const call = (
    endpoint: Parameters<MockBackend['handle']>[0],
    params: Record<string, string> = {},
    body?: unknown,
  ) => real()(endpoint, { token, params, query: {}, body });

  beforeEach(() => {
    sessionStorage.clear();
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
    backend = TestBed.inject(MockBackend);
    handle = vi.spyOn(backend, 'handle');
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    TestBed.tick();
  }

  async function open(url = '/saved', username = 'hocvien', userId = '000004') {
    token = signInToMockBackend(username);
    fakeSession().user.set(seedProfile(userId));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const calls = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint);
  const press = async (node: Element | null | undefined) => {
    (node as HTMLElement).click();
    await settle();
  };
  const lessons = () =>
    Array.from(el.querySelectorAll<HTMLAnchorElement>('.saved__lesson'));
  const lesson = (name: string) =>
    lessons().find((a) => a.textContent?.includes(name))!;
  const current = () =>
    el.querySelector('.saved__lesson[aria-current="true"]')?.textContent;
  const sheetTitle = () =>
    el.querySelector('#saved-sheet-title')?.textContent?.trim();
  const entries = () =>
    Array.from(el.querySelectorAll<HTMLElement>('.saved__entry'));
  const places = () =>
    entries().map((e) => e.querySelector('.saved__where')?.textContent?.trim());
  const kind = (label: string) =>
    Array.from(el.querySelectorAll('[role="option"]')).find(
      (o) => o.textContent?.trim() === label,
    );
  const search = async (value: string) => {
    const input = el.querySelector<HTMLInputElement>('ui-search input')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle();
  };
  const dialog = () =>
    document.querySelector<HTMLElement>('[role="alertdialog"]');
  const inDialog = (label: string) =>
    Array.from(dialog()!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label,
    );
  const removeEntry = async (entry: HTMLElement, confirmLabel: string) => {
    await press(entry.querySelector('ui-menu button'));
    await press(document.querySelector('[role="menuitem"]'));
    await press(inDialog(confirmLabel));
  };

  // The seed: a video note on "Kiến trúc tổng thể…", a PDF note (page 5) and a PDF bookmark (page 2)
  // on "Mô hình dữ liệu khách hàng (CIF)", both lessons of one course.
  const VIDEO_LESSON = 'Kiến trúc tổng thể';
  const PDF_LESSON = 'Mô hình dữ liệu khách hàng';

  describe('with notes and a bookmark', () => {
    beforeEach(() => open());

    it('reads both kinds once and says how many there are', () => {
      expect(
        calls(personalEndpoints.saved).map(([, r]) => r.query['kind']),
      ).toEqual(['notes', 'bookmarks']);
      expect(
        el.querySelector('ui-search input')?.getAttribute('placeholder'),
      ).toBe('Tìm trong 2 ghi chú và 1 đánh dấu…');
    });

    it('indexes the lessons under their course and opens the first one', () => {
      expect(
        Array.from(el.querySelectorAll('.saved__course')).map((h) =>
          h.textContent?.trim(),
        ),
      ).toEqual(['Tổng quan hệ thống Core Banking']);
      expect(lessons()).toHaveLength(2);
      expect(current()).toContain(VIDEO_LESSON);
      expect(sheetTitle()).toContain(VIDEO_LESSON);
      expect(places()).toEqual(['Video 4:10']);
      expect(entries()[0].textContent).toContain('Kiểm soát maker-checker');
    });

    it('keeps the chosen lesson in the URL and lists its notes and bookmarks in page order', async () => {
      await press(lesson(PDF_LESSON));
      expect(TestBed.inject(Router).url).toMatch(/^\/saved\?bai=\d+$/);
      expect(current()).toContain(PDF_LESSON);
      expect(places()).toEqual(['Trang 2', 'Trang 5']);
      expect(entries()[0].textContent).toMatch(/Đánh dấu · .* — trang 2/);
      expect(entries()[1].textContent).toContain('Đổi CCCD → cập nhật CIF');
      expect(text()).toContain('1 ghi chú, 1 đánh dấu');
    });

    it('opens PDF entries at their page and video entries at their block', async () => {
      expect(
        entries()[0].querySelector('.saved__where')!.getAttribute('href'),
      ).toMatch(/^\/lesson\/\d+\/\d+\?block=\d+$/);
      await press(lesson(PDF_LESSON));
      expect(
        entries()[1].querySelector('.saved__where')!.getAttribute('href'),
      ).toMatch(/\?block=\d+&page=5$/);
    });

    it('filters the lesson page to notes or bookmarks', async () => {
      await press(lesson(PDF_LESSON));
      await press(kind('Đánh dấu'));
      expect(places()).toEqual(['Trang 2']);
      await press(kind('Ghi chú'));
      expect(places()).toEqual(['Trang 5']);
      await press(lesson(VIDEO_LESSON));
      await press(kind('Đánh dấu'));
      expect(entries()).toHaveLength(0);
      expect(text()).toContain('Bài này chưa có đánh dấu.');
    });

    it('opens a lesson named in the URL, and the first one when the name is unknown', async () => {
      await press(lesson(PDF_LESSON));
      const url = TestBed.inject(Router).url;
      await harness.navigateByUrl('/saved');
      await settle();
      await harness.navigateByUrl(url);
      await settle();
      expect(current()).toContain(PDF_LESSON);
      await harness.navigateByUrl('/saved?bai=999999');
      await settle();
      expect(current()).toContain(VIDEO_LESSON);
    });

    it('searches the text, lesson and course of every entry', async () => {
      await search('CCCD');
      expect(lessons()).toHaveLength(1);
      expect(current()).toContain(PDF_LESSON);
      expect(places()).toEqual(['Trang 5']);

      await search('không tồn tại');
      expect(lessons()).toHaveLength(0);
      expect(text()).toContain(
        'Không có ghi chú hay đánh dấu nào khớp “không tồn tại”.',
      );

      await search('');
      expect(lessons()).toHaveLength(2);
    });

    it('deletes a note after the learner confirms, and the lesson leaves the index', async () => {
      await press(entries()[0].querySelector('ui-menu button'));
      await press(document.querySelector('[role="menuitem"]'));
      expect(dialog()!.textContent).toContain('Xóa ghi chú?');
      await press(inDialog('Hủy'));
      expect(calls(personalEndpoints.deleteNote)).toHaveLength(0);

      await removeEntry(entries()[0], 'Xóa');
      expect(calls(personalEndpoints.deleteNote)).toHaveLength(1);
      expect(lessons()).toHaveLength(1);
      expect(current()).toContain(PDF_LESSON);
      expect(
        el.querySelector('ui-search input')?.getAttribute('placeholder'),
      ).toBe('Tìm trong 1 ghi chú và 1 đánh dấu…');
    });

    it('removes a bookmark through its own endpoint', async () => {
      await press(lesson(PDF_LESSON));
      await press(entries()[0].querySelector('ui-menu button'));
      await press(document.querySelector('[role="menuitem"]'));
      expect(dialog()!.textContent).toContain('Bỏ đánh dấu?');
      await press(inDialog('Bỏ đánh dấu'));
      expect(calls(personalEndpoints.deleteBookmark)).toHaveLength(1);
      expect(places()).toEqual(['Trang 5']);
    });

    it('shows the error with a retry when the list cannot be read', async () => {
      handle.mockImplementation((endpoint, request) =>
        endpoint === personalEndpoints.saved
          ? backendRefusal('internalError')
          : real()(endpoint, request),
      );
      await harness.navigateByUrl('/learn');
      await harness.navigateByUrl('/saved');
      await settle();
      el = harness.routeNativeElement as HTMLElement;
      expect(text()).toContain('Không tải được mục đã lưu');

      handle.mockImplementation(real());
      await press(
        Array.from(el.querySelectorAll('button')).find((b) =>
          b.textContent?.includes('Thử lại'),
        ),
      );
      expect(lessons()).toHaveLength(2);
    });
  });

  describe('with more than a page of notes', () => {
    beforeEach(async () => {
      token = signInToMockBackend('hocvien');
      const course = call(learnerEndpoints.course, { courseId: '1' })?.body as {
        data: {
          content: { chapters: { lessons: { lesson: { id: number } }[] }[] };
        };
      };
      const lessonId = course.data.content.chapters[0].lessons[0].lesson.id;
      for (let i = 0; i < 100; i += 1) {
        call(
          personalEndpoints.addNote,
          { lessonId: String(lessonId) },
          { anchor: { type: 'none' }, text: `Ghi chú ${i}` },
        );
      }
    });

    it('reads every page and shows them on one lesson page', async () => {
      await open();
      expect(
        calls(personalEndpoints.saved)
          .map(([, r]) => `${r.query['kind']} ${r.query['page']}`)
          .sort(),
      ).toEqual(['bookmarks 0', 'notes 0', 'notes 1']);
      expect(entries()).toHaveLength(101);
      expect(
        places()
          .slice(0, 100)
          .every((p) => p === 'Cả bài'),
      ).toBe(true);
      expect(places().at(-1)).toBe('Video 4:10');
    });

    it('stops requesting later pages if the server repeats page zero', async () => {
      const original = real();
      handle.mockImplementation((endpoint, request) =>
        endpoint === personalEndpoints.saved
          ? original(endpoint, {
              ...request,
              query: { ...request.query, page: '0' },
            })
          : original(endpoint, request),
      );
      await open();
      expect(
        calls(personalEndpoints.saved)
          .filter(([, r]) => r.query['kind'] === 'notes')
          .map(([, r]) => r.query['page']),
      ).toEqual(['0', '1']);
      expect(entries()).toHaveLength(100);
    });
  });

  describe('with nothing saved', () => {
    beforeEach(() => open('/saved', 'hocvien.tichhop', '000007'));

    it('says so in one line, with the way to the lessons', () => {
      expect(lessons()).toHaveLength(0);
      expect(text()).toContain('Chưa có mục nào.');
      const start = Array.from(el.querySelectorAll('a')).find((a) =>
        a.textContent?.includes('Vào học'),
      );
      expect(start?.getAttribute('href')).toBe('/learn');
      expect(el.querySelector('ui-search')).toBeNull();
      expect(TestBed.inject(Router).url).toBe('/saved');
    });
  });
});
