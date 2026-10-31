import { RouterTestingHarness } from '@angular/router/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
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

/** The admin question bank and quiz settings, which stay on this screen after the learner routes left. */
describe('AssessmentScreen (admin)', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  beforeEach(() => {
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
  });

  async function open(url: string) {
    signInToMockBackend('quantri');
    fakeSession().user.set(seedProfile('000002'));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    for (let i = 0; i < 6; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';

  it('lists the question bank', async () => {
    await open('/admin/questions');
    expect(text()).toContain('CH-CIF-01');
    expect(el.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
  });

  it('lists the quizzes with a link to their settings', async () => {
    await open('/admin/quizzes');
    expect(text()).toContain('Kiểm tra nghiệp vụ CIF');
    expect(el.querySelector('a[href="/admin/quizzes/q1"]')).toBeTruthy();
  });

  it('opens the settings of a quiz with its form', async () => {
    await open('/admin/quizzes/q1');
    expect(el.querySelector('form')).toBeTruthy();
    expect(text()).toContain('Lưu cấu hình');
  });
});
