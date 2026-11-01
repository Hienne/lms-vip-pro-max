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

  async function open(username = 'hocvien', userId = '000004') {
    token = signInToMockBackend(username);
    fakeSession().user.set(seedProfile(userId));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/saved');
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const calls = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint);
  const tab = (name: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]')).find((t) =>
      t.textContent?.includes(name),
    )!;
  const press = async (node: Element | null | undefined) => {
    (node as HTMLElement).click();
    await settle();
  };
  const rows = () =>
    Array.from(el.querySelectorAll<HTMLElement>('.saved__row')).filter(
      (row) => row.closest('[role="tabpanel"]:not([inert])') !== null,
    );
  const titles = () =>
    rows().map((row) => row.querySelector('strong')?.textContent?.trim());
  const dialog = () =>
    document.querySelector<HTMLElement>('[role="alertdialog"]');
  const inDialog = (label: string) =>
    Array.from(dialog()!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label,
    );

  describe('with notes and a bookmark', () => {
    beforeEach(() => open());

    it('lists the notes newest first, with the counts of both tabs', () => {
      expect(tab('Ghi chú').textContent).toContain('2');
      expect(tab('Đánh dấu').textContent).toContain('1');
      expect(titles()).toEqual([
        'Kiểm soát maker-checker',
        'Đổi CCCD → cập nhật CIF',
      ]);
    });

    it('renders the list in the selected tab only, not a second copy in the other', async () => {
      const links = () => el.querySelectorAll('a.saved__open').length;
      expect(links()).toBe(2);
      await press(tab('Đánh dấu'));
      expect(links()).toBe(1);
    });

    it('says where each row is: its lesson, the page or second, and how long ago', () => {
      const [video, pdf] = rows().map((row) => row.querySelector('small')!);
      expect(video.textContent).toMatch(/· Video 4:10 · .+/);
      expect(pdf.textContent).toMatch(/· Trang 5 · .+/);
      expect(el.querySelector('.saved__icon')).toBeNull();
    });

    it('opens the lesson at the spot: the block, and the page or the second', () => {
      const [video, pdf] = rows().map(
        (row) =>
          row.querySelector<HTMLAnchorElement>('a')!.getAttribute('href')!,
      );
      expect(video).toMatch(/^\/lesson\/1\/\d+\?block=\d+&t=250$/);
      expect(pdf).toMatch(/^\/lesson\/1\/\d+\?block=\d+&page=5$/);
    });

    it('shows the bookmarks on their tab, by their label', async () => {
      await press(tab('Đánh dấu'));
      expect(calls(personalEndpoints.saved).at(-1)?.[1].query).toMatchObject({
        kind: 'bookmarks',
      });
      expect(titles()).toEqual([expect.stringMatching(/ — trang 2$/)]);
      expect(rows()[0].querySelector('a')!.getAttribute('href')).toMatch(
        /&page=2$/,
      );
      expect(tab('Ghi chú').textContent).toContain('2');
    });

    it('deletes a note after the learner confirms, and the counts follow', async () => {
      await press(
        el.querySelector('button[aria-label="Xóa Kiểm soát maker-checker"]'),
      );
      expect(dialog()!.textContent).toContain('Xóa ghi chú?');
      await press(inDialog('Hủy'));
      expect(calls(personalEndpoints.deleteNote).length).toBe(0);
      expect(titles().length).toBe(2);

      await press(
        el.querySelector('button[aria-label="Xóa Kiểm soát maker-checker"]'),
      );
      await press(inDialog('Xóa'));
      expect(calls(personalEndpoints.deleteNote).length).toBe(1);
      expect(titles()).toEqual(['Đổi CCCD → cập nhật CIF']);
      expect(tab('Ghi chú').textContent).toContain('1');
    });

    it('removes a bookmark through its own endpoint', async () => {
      await press(tab('Đánh dấu'));
      await press(rows()[0].querySelector('button'));
      expect(dialog()!.textContent).toContain('Bỏ đánh dấu?');
      await press(inDialog('Bỏ đánh dấu'));
      expect(calls(personalEndpoints.deleteBookmark).length).toBe(1);
      expect(text()).toContain('Chưa có mục nào.');
      expect(tab('Đánh dấu').textContent).toContain('0');
    });

    it('shows the error with a retry when the list cannot be read', async () => {
      handle.mockImplementation((endpoint, request) =>
        endpoint === personalEndpoints.saved
          ? backendRefusal('internalError')
          : real()(endpoint, request),
      );
      await press(tab('Đánh dấu'));
      expect(text()).toContain('Hệ thống gặp lỗi');

      handle.mockImplementation(real());
      await press(
        Array.from(el.querySelectorAll('button')).find((b) =>
          b.textContent?.includes('Thử lại'),
        ),
      );
      expect(titles().length).toBe(1);
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
      for (let i = 0; i < 19; i += 1) {
        call(
          personalEndpoints.addNote,
          { lessonId: String(lessonId) },
          { anchor: { type: 'none' }, text: `Ghi chú ${i}` },
        );
      }
      await open();
    });

    it('pages the list, and goes back a page when the last row of a page is deleted', async () => {
      expect(rows().length).toBe(20);
      expect(text()).toContain('Hiển thị 1–20 / 21');

      await press(
        el.querySelector('nav[aria-label="Phân trang"] button:nth-of-type(3)'),
      );
      expect(rows().length).toBe(1);
      expect(calls(personalEndpoints.saved).at(-1)?.[1].query).toMatchObject({
        page: '1',
      });

      await press(rows()[0].querySelector('button'));
      await press(inDialog('Xóa'));
      expect(rows().length).toBe(20);
      expect(el.querySelector('nav[aria-label="Phân trang"]')).toBeNull();
    });
  });

  describe('with nothing saved', () => {
    beforeEach(() => open('hocvien.tichhop', '000007'));

    it('says so in one line, with the way to the lessons', () => {
      expect(rows().length).toBe(0);
      expect(text()).toContain('Chưa có mục nào.');
      const start = Array.from(el.querySelectorAll('a')).find((a) =>
        a.textContent?.includes('Vào học'),
      );
      expect(start?.getAttribute('href')).toBe('/learn');
      expect(tab('Ghi chú').textContent).toContain('0');
      expect(TestBed.inject(Router).url).toBe('/saved');
    });
  });
});
