import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { assessmentReportEndpoints as api } from '@lms/contracts';
import { createAppRoutes } from '../../../app.routes';
import { provideAppConfig } from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../core/dev/mock-api/mock-backend.testing';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import { SessionStore } from '../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';
import { ReportScreenStore } from './data-access/report-screen.store';

describe('ReportScreen', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
  });

  async function settle() {
    for (let i = 0; i < 6; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  async function open(path: string) {
    signInToMockBackend('quantri.ban');
    fakeSession().user.set(seedProfile('000003'));
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(path);
    await settle();
    const root = harness.routeNativeElement as HTMLElement;
    const store = harness.routeDebugElement!.injector.get(ReportScreenStore);
    const labels = () =>
      Array.from(root.querySelectorAll('form label')).map((l) =>
        l.textContent?.replace(/\s+/g, ' ').trim(),
      );
    const text = () => root.textContent?.replace(/\s+/g, ' ') ?? '';
    return { root, store, labels, text };
  }

  it('filters by name, with no id inputs left', async () => {
    const { root, labels } = await open('/reports/results');
    expect(labels().slice(0, 4)).toEqual([
      'Đơn vị',
      'Phòng / nhóm',
      'Khóa học',
      'Bài kiểm tra',
    ]);
    expect(labels().some((label) => /^ID /.test(label ?? ''))).toBe(false);
    expect(root.querySelector('input[inputmode="numeric"]')).toBeNull();
  });

  it('runs "Tình trạng học viên" from the pickers alone', async () => {
    const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
    const { root, store, labels, text } = await open('/reports/learners');
    expect(labels().slice(0, 2)).toEqual(['Khóa học', 'Bài kiểm tra*']);
    expect(text()).toContain(
      'Chọn khóa học và bài kiểm tra để xem cả học viên chưa thi.',
    );
    const quiz =
      root.querySelectorAll<HTMLInputElement>('[role="combobox"]')[1];
    expect(quiz.getAttribute('aria-disabled')).toBe('true');
    expect(text()).toContain('Chọn khóa học trước');

    store.pickers.pick('courseId', store.pickers.options$.courseId()[0]);
    await settle();
    store.pickers.pick('quizId', store.pickers.options$.quizId()[0]);
    root.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await settle();

    expect(TestBed.inject(Router).url).toBe(
      '/reports/learners?courseId=1&quizId=1',
    );
    expect(spy.mock.calls.some(([e]) => e === api.learners)).toBe(true);
    expect(text()).not.toContain('Chọn khóa học và bài kiểm tra');
  });

  describe('Xuất CSV', () => {
    const exportButton = (root: HTMLElement) =>
      Array.from(root.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Xuất CSV'),
      )!;
    const reason = (root: HTMLElement) => {
      const button = exportButton(root);
      return button
        .getAttribute('aria-describedby')
        ?.split(' ')
        .map((id) => root.ownerDocument.getElementById(id)?.textContent?.trim())
        .join(' ');
    };

    it.each([
      ['/reports', 'Chọn một báo cáo chi tiết để xuất CSV.'],
      ['/reports/learners', 'Chọn bài kiểm tra để xuất.'],
      ['/reports/results?userId=000099', 'Không có dữ liệu để xuất.'],
    ])('on %s says why it is disabled', async (path, text) => {
      const { root } = await open(path);
      expect(exportButton(root).disabled).toBe(true);
      expect(reason(root)).toBe(text);
      expect(
        exportButton(root).closest('[uiTooltip], .report-screen__export'),
      ).not.toBeNull();
    });

    it('is enabled, with no reason, when there are rows', async () => {
      const { root } = await open('/reports/results');
      expect(exportButton(root).disabled).toBe(false);
      expect(exportButton(root).hasAttribute('aria-describedby')).toBe(false);
    });
  });

  it('describes the view it shows', async () => {
    const { text } = await open('/reports');
    expect(text()).toContain(
      'Tiến độ học và kết quả thi theo phạm vi được cấp.',
    );
  });

  it('says a report from a bad link does not exist', async () => {
    const { text } = await open('/reports/programs');
    expect(text()).toContain('Không có báo cáo này. Chọn một báo cáo ở trên.');
  });
});
