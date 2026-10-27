import type { Provider } from '@angular/core';
import type { MockInstance } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { createAppRoutes } from '../../../app.routes';
import { parseAppConfig, provideAppConfig } from '../../config/app-config';
import { testAppConfig } from '../../config/app-config.testing';
import { MockBackend } from './mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from './mock-backend.testing';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../session/session.testing';
import { SessionStore } from '../../session/session.store';

/**
 * Screen specs of the content and assignment admin, run against the seeded in-memory backend as
 * `quantri` (000002, admin of org 1). Every backend call is recorded on `calls`. `providers` replace
 * services a spec cannot run for real, such as the hasher that needs a worker.
 */
export function setUpAdminScreen(providers: Provider[] = []) {
  let harness: RouterTestingHarness;
  let calls: MockInstance<MockBackend['handle']>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
        ...providers,
      ],
    });
    calls = vi.spyOn(TestBed.inject(MockBackend), 'handle');
  });

  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((c) => (c.innerHTML = ''));
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    TestBed.tick();
  }

  const page = (): HTMLElement => harness.routeNativeElement as HTMLElement;

  return {
    get el(): HTMLElement {
      return page();
    },
    async open(url: string): Promise<void> {
      signInToMockBackend('quantri');
      fakeSession().user.set(seedProfile('000002'));
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url);
      await settle();
    },
    settle,
    /** The routed page component. */
    page: <T>() => harness.routeDebugElement?.componentInstance as T,
    url: () => TestBed.inject(Router).url,
    text: (root: ParentNode = page()) =>
      (root as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '',
    /** The last body or query sent to `endpoint`. */
    lastCall: (endpoint: unknown) =>
      calls.mock.calls.filter(([e]) => e === endpoint).at(-1)?.[1],
    callsTo: (endpoint: unknown) =>
      calls.mock.calls.filter(([e]) => e === endpoint).length,
    button: (label: string | RegExp, root: ParentNode = page()) =>
      Array.from(root.querySelectorAll<HTMLButtonElement>('button, a')).find(
        (b) => {
          const name = `${b.textContent ?? ''} ${b.getAttribute('aria-label') ?? ''}`;
          return typeof label === 'string'
            ? name.includes(label)
            : label.test(name);
        },
      ) as HTMLButtonElement | undefined,
    drawer: () => document.querySelector<HTMLElement>('[role="dialog"]'),
    alertDialog: () =>
      document.querySelector<HTMLElement>('[role="alertdialog"]'),
    /** The control inside the `ui-field` whose label contains `label`. */
    field: (label: string, root: ParentNode = page()) =>
      Array.from(root.querySelectorAll<HTMLElement>('ui-field'))
        .find((f) => f.querySelector('label')?.textContent?.includes(label))
        ?.querySelector('input, textarea, select') as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement,
    async type(control: HTMLInputElement | HTMLTextAreaElement, value: string) {
      control.value = value;
      control.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
    },
    async choose(control: HTMLSelectElement, value: string) {
      control.value = value;
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
    },
    async click(target: HTMLElement | undefined) {
      if (!target) throw new Error('Nothing to click');
      target.click();
      await settle();
    },
    get calls() {
      return calls;
    },
  };
}
