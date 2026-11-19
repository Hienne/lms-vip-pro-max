import { HttpTestingController } from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type {
  CreatedExternalConnection,
  ExternalConnection,
  FunctionCode,
} from '@lms/contracts';
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
import { ExternalAssistant } from './external-assistant';

const BASE = '/api/v1/assistant/external-connections';
const STATUS = `${BASE}/status`;
const MCP_URL = 'https://lms.example/api/v1/mcp';

const connection = (id: number, name = `Máy ${id}`): ExternalConnection => ({
  id,
  name,
  kind: 'token',
  tokenPrefix: `chan_ext_ab${id}`,
  createTime: '2026-11-10T09:00:00Z',
  expiresAt: '2026-12-10T09:00:00Z',
  lastUsedAt: null,
});

const TOKEN = 'chan_ext_secret0123456789abcdefghij';

describe('ExternalAssistant', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<ExternalAssistant>;

  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      TestBed.tick();
      await Promise.resolve();
    }
    fixture?.detectChanges();
  }

  async function render(menus: readonly FunctionCode[]): Promise<void> {
    TestBed.resetTestingModule();
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
      ...seedProfile('000004'),
      menus,
    });
    fixture = TestBed.createComponent(ExternalAssistant);
    await settle();
  }

  async function answerStatus(enabled: boolean, allowed: boolean) {
    backend
      .expectOne(STATUS)
      .flush(envelopeOk({ enabled, allowed, mcpUrl: MCP_URL }));
    await settle();
  }

  const button = () =>
    fixture.nativeElement.querySelector(
      'button[aria-label="Kết nối trợ lý ngoài"]',
    ) as HTMLButtonElement | null;
  const drawer = () => document.querySelector('.cdk-overlay-container');

  async function openWith(rows: readonly ExternalConnection[]) {
    await render(['AI_ASSISTANT']);
    await answerStatus(true, true);
    button()?.click();
    await settle();
    backend
      .expectOne((r) => r.url === BASE && r.method === 'GET')
      .flush(envelopeOk(rows));
    await settle();
  }

  const byText = (selector: string, text: string) =>
    Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
      (el) => el.textContent?.trim() === text,
    );

  afterEach(() => {
    backend.verify();
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((c) => (c.innerHTML = ''));
  });

  it('asks nothing and shows no button for a user without the assistant', async () => {
    await render(['COURSE_LEARNING']);
    backend.expectNone(STATUS);
    expect(button()).toBeNull();
  });

  it.each([
    [false, true],
    [true, false],
  ])(
    'shows no button when the flag is %s and the caller is allowed %s',
    async (enabled, allowed) => {
      await render(['AI_ASSISTANT']);
      await answerStatus(enabled, allowed);
      expect(button()).toBeNull();
    },
  );

  it('shows the button when the flag is on and the caller may draft, and lists the connections', async () => {
    await openWith([connection(2, 'Claude Code ở nhà'), connection(1)]);
    const text = drawer()?.textContent ?? '';
    expect(text).toContain('Claude Code ở nhà');
    expect(text).toContain('chưa dùng');
    expect(text).not.toContain(TOKEN);
  });

  it('labels a pasted code as the old way, shows an OAuth connection by its client, and links the guide', async () => {
    await openWith([
      {
        ...connection(5, 'Claude'),
        kind: 'oauth',
        tokenPrefix: null,
      },
      connection(4, 'Máy cũ'),
    ]);
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="external-connections"] li',
      ),
    ).map((row) => row.textContent?.replace(/\s+/g, ' ') ?? '');
    expect(rows[0]).toContain('Claude');
    expect(rows[0]).toContain('Cấp');
    expect(rows[0]).not.toContain('Mã kết nối (cũ)');
    expect(rows[1]).toContain('Mã kết nối (cũ) · chan_ext_ab4…');
    const guide = document.querySelector<HTMLAnchorElement>(
      '[data-testid="external-guide-link"]',
    );
    expect(guide?.getAttribute('href')).toBe('/tro-ly-ngoai');
  });

  it('shows the token and the command once after create, and forgets them on close', async () => {
    await openWith([]);
    const name = document.querySelector<HTMLInputElement>(
      '.cdk-overlay-container input[uiInput]',
    );
    if (!name) throw new Error('No name field');
    name.value = 'Máy làm việc';
    name.dispatchEvent(new Event('input'));
    await settle();
    byText('button', 'Tạo kết nối')?.click();
    await settle();

    const create = backend.expectOne(
      (r) => r.url === BASE && r.method === 'POST',
    );
    expect(create.request.body).toEqual({
      name: 'Máy làm việc',
      validDays: 30,
    });
    const created: CreatedExternalConnection = {
      connection: connection(9, 'Máy làm việc'),
      token: TOKEN,
    };
    create.flush(envelopeOk(created));
    await settle();
    backend
      .expectOne((r) => r.url === BASE && r.method === 'GET')
      .flush(envelopeOk([created.connection]));
    await settle();

    const token = document.querySelector<HTMLInputElement>(
      '[data-testid="external-token"]',
    );
    const command = document.querySelector<HTMLTextAreaElement>(
      '[data-testid="external-command"]',
    );
    expect(token?.value).toBe(TOKEN);
    expect(command?.value).toBe(
      `claude mcp add --transport http chan-academy ${location.origin}/api/v1/mcp --header "Authorization: Bearer ${TOKEN}"`,
    );
    expect(drawer()?.textContent).toContain('không mật');

    // Closed and opened again: the token is gone for good.
    byText('button', 'Xong')?.click();
    await settle();
    expect(document.querySelector('[data-testid="external-token"]')).toBeNull();
    expect(drawer()?.textContent).not.toContain(TOKEN);
  });

  it('revokes a connection only after the confirm', async () => {
    await openWith([connection(3, 'Máy cũ')]);
    document
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Thu hồi kết nối Máy cũ"]',
      )
      ?.click();
    await vi.waitFor(() =>
      expect(document.querySelector('[role="alertdialog"]')).not.toBeNull(),
    );
    backend.expectNone((r) => r.method === 'DELETE');

    Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '[role="alertdialog"] button',
      ),
    )
      .find((b) => b.textContent?.trim() === 'Thu hồi')
      ?.click();
    await settle();
    backend
      .expectOne((r) => r.url === `${BASE}/3` && r.method === 'DELETE')
      .flush(envelopeOk(null));
    await settle();
    backend
      .expectOne((r) => r.url === BASE && r.method === 'GET')
      .flush(envelopeOk([]));
    await settle();
    expect(drawer()?.textContent).toContain('Chưa có kết nối nào');
  });
});
