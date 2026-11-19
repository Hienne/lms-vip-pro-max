import { HttpTestingController } from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { envelopeOk } from '@lms/mocks';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../core/http/http.testing';
import { SessionStore } from '../../../core/session/session.store';
import {
  fakeSession,
  FakeSessionStore,
  seedProfile,
} from '../../../core/session/session.testing';
import { Guide } from './guide';

const STATUS = '/api/v1/assistant/external-connections/status';

describe('Guide (/tro-ly-ngoai)', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<Guide>;

  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      TestBed.tick();
      await Promise.resolve();
    }
    fixture.detectChanges();
  }

  async function render(enabled: boolean, allowed: boolean): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        provideRouter([]),
        { provide: SessionStore, useClass: FakeSessionStore },
        { provide: ErrorHandler, useValue: { handleError: () => undefined } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fakeSession().user.set({
      ...seedProfile('000005'),
      menus: ['AI_ASSISTANT'],
    });
    fixture = TestBed.createComponent(Guide);
    await settle();
    backend.expectOne(STATUS).flush(envelopeOk({ enabled, allowed }));
    await settle();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => el().textContent?.replace(/\s+/g, ' ') ?? '';

  afterEach(() => backend.verify());

  it('shows the MCP URL on this origin, the Claude App steps first, and no token anywhere', async () => {
    await render(true, true);

    const url = el().querySelector<HTMLInputElement>('[data-testid="mcp-url"]');
    expect(url?.value).toBe(`${location.origin}/api/v1/mcp`);
    const app = el().querySelector('[data-testid="steps-claude-app"]');
    expect(app?.textContent).toContain('Add custom connector');
    expect(app?.textContent).toContain('Cho phép');
    expect(text()).not.toMatch(/chan_ext_|Bearer/);
    expect(el().querySelector('img')).toBeNull();
  });

  it('gives Claude Code the command without a header, then /mcp to sign in', async () => {
    await render(true, true);
    const tab = Array.from(
      el().querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ).find((button) => button.textContent?.trim() === 'Claude Code');
    tab?.click();
    await settle();

    const command = el().querySelector<HTMLInputElement>(
      '[data-testid="claude-code-command"]',
    );
    expect(command?.value).toBe(
      `claude mcp add --transport http chan-academy ${location.origin}/api/v1/mcp`,
    );
    expect(
      el().querySelector('[data-testid="steps-claude-code"]')?.textContent,
    ).toContain('/mcp');
  });

  it('answers the four questions authors ask', async () => {
    await render(true, true);
    const questions = Array.from(
      el().querySelectorAll('[data-testid="faq"] dt'),
    ).map((dt) => dt.textContent?.trim());
    expect(questions).toEqual([
      'Ngắt kết nối thế nào?',
      'Tài liệu của tôi đi đâu?',
      'Claude báo hết hạn hoặc cần đăng nhập?',
      'Trợ lý được làm gì?',
    ]);
    expect(text()).toContain('claude mcp remove chan-academy');
  });

  it.each([
    [false, false],
    [true, false],
  ])(
    'tells a caller who may not connect (flag %s, allowed %s) and shows no URL',
    async (enabled, allowed) => {
      await render(enabled, allowed);
      expect(text()).toContain('Bạn chưa dùng được trợ lý ngoài');
      expect(el().querySelector('[data-testid="mcp-url"]')).toBeNull();
    },
  );
});
