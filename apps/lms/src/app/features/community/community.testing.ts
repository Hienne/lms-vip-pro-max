import type { MockInstance } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { createAppRoutes } from '../../app.routes';
import { parseAppConfig, provideAppConfig } from '../../core/config/app-config';
import { testAppConfig } from '../../core/config/app-config.testing';
import { MockBackend } from '../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../core/dev/mock-api/mock-backend.testing';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../core/session/session.testing';
import { SessionStore } from '../../core/session/session.store';

/** The demo accounts the community specs sign in as (staff code by username). */
export const COMMUNITY_USERS = {
  hocvien: '000004',
  giangvien: '000005',
  'hocvien.tichhop': '000007',
  dieuphoi: '000008',
  'quantri.ban': '000003',
} as const;

export type CommunityUser = keyof typeof COMMUNITY_USERS;

/** A community route rendered on the seeded mock backend, with the calls it made. */
export interface CommunityPage {
  readonly harness: RouterTestingHarness;
  readonly handle: MockInstance<MockBackend['handle']>;
  el(): HTMLElement;
  text(): string;
  settle(): Promise<void>;
  /** The buttons and links whose text is exactly `label`. */
  controls(label: string): HTMLElement[];
  click(label: string): Promise<void>;
  /** Settles until the page text contains `text` (a lazy route may still be loading). */
  waitForText(text: string, timeoutMs?: number): Promise<void>;
  /** The request bodies sent to `endpoint`, oldest first. */
  bodies(endpoint: unknown): unknown[];
}

export function configureCommunityTesting(): void {
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
}

/** Signs in as `user` and opens `url`; call {@link configureCommunityTesting} first. */
export async function openCommunity(
  url: string,
  user: CommunityUser = 'hocvien',
): Promise<CommunityPage> {
  const handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
  signInToMockBackend(user);
  fakeSession().user.set(seedProfile(COMMUNITY_USERS[user]));
  const harness = await RouterTestingHarness.create();
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    TestBed.tick();
  };
  await harness.navigateByUrl(url);
  await settle();
  const el = () => document.body as HTMLElement;
  const controls = (label: string) =>
    Array.from(el().querySelectorAll<HTMLElement>('button, a')).filter(
      (b) => b.textContent?.replace(/\s+/g, ' ').trim() === label,
    );
  return {
    harness,
    handle,
    el,
    text: () => el().textContent?.replace(/\s+/g, ' ') ?? '',
    settle,
    controls,
    click: async (label: string) => {
      const [control] = controls(label);
      if (!control) throw new Error(`No control labelled "${label}"`);
      control.click();
      await settle();
    },
    waitForText: async (text: string, timeoutMs = 2000) => {
      const until = Date.now() + timeoutMs;
      while (!el().textContent?.replace(/\s+/g, ' ').includes(text)) {
        if (Date.now() > until)
          throw new Error(`The page never showed "${text}"`);
        await new Promise((resolve) => setTimeout(resolve, 20));
        await settle();
      }
    },
    bodies: (endpoint: unknown) =>
      handle.mock.calls
        .filter(([e]) => e === endpoint)
        .map(([, req]) => req.body),
  };
}
