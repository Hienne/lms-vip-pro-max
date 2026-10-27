import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  envelopeOk,
  knowledgeDocumentFixtures,
  knowledgeStreamFixture,
} from '@lms/mocks';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../core/http/http.testing';
import { SessionStore } from '../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';
import {
  FakeBreakpoints,
  provideFakeBreakpoints,
} from './data-access/breakpoints.testing';

const LIST = '/api/v1/knowledge/documents';
const STREAM = '/api/v1/knowledge/chat/stream';

describe('Assistant', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
  let el: HTMLElement;
  let breakpoints: FakeBreakpoints;

  beforeEach(() => {
    breakpoints = new FakeBreakpoints();
    TestBed.configureTestingModule({
      providers: [
        provideEnvelopeHttpClient(),
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
        provideFakeBreakpoints(breakpoints),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });
  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }

  /** The list the screen shows, not the signed-in user's own poll the tracker makes. */
  const screenList = (): TestRequest[] =>
    backend.match(
      (r) =>
        r.url === LIST && r.method === 'GET' && r.params.get('size') === '20',
    );

  async function open(userId = '000005') {
    fakeSession().user.set(seedProfile(userId));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/assistant');
    await settle();
    screenList()[0].flush(
      envelopeOk({
        items: knowledgeDocumentFixtures,
        page: 0,
        size: 20,
        totalElements: knowledgeDocumentFixtures.length,
        totalPages: 1,
      }),
    );
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';

  it('is a page of its own with the title, the greeting and the shared documents', async () => {
    await open();
    expect(el.querySelector('h1')?.textContent).toBe(
      'Trợ lý AI tra cứu tài liệu',
    );
    expect(text()).toContain(
      'Xin chào! Hãy hỏi mình bất kỳ điều gì về nội dung tài liệu trong kho.',
    );
    expect(text()).toContain('Trợ lý chỉ trả lời từ các tài liệu trong kho.');
    expect(el.querySelectorAll('app-document-list li')).toHaveLength(
      knowledgeDocumentFixtures.length,
    );
  });

  it('is open to a learner as well as an instructor', async () => {
    await open('000001');
    expect(el.querySelector('h1')?.textContent).toBe(
      'Trợ lý AI tra cứu tài liệu',
    );
  });

  it('answers a typed question with its sources, then announces it', async () => {
    await open();
    const input = el.querySelector(
      'input#assistant-question',
    ) as HTMLInputElement;
    input.value = 'Quy trình EOD gồm những bước nào?';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    await settle();

    expect(text()).toContain('Quy trình EOD gồm những bước nào?');
    const request = backend.expectOne(STREAM);
    expect(
      Array.from(el.querySelectorAll('button')).some(
        (b) => b.textContent?.trim() === 'Dừng',
      ),
    ).toBe(true);

    request.flush(
      knowledgeStreamFixture.map((e) => JSON.stringify(e)).join('\n'),
      {
        headers: { 'Content-Type': 'application/x-ndjson' },
      },
    );
    await settle();
    expect(text()).toContain('khóa ngày giao dịch [1].');
    expect(
      el.querySelectorAll('app-chat-message app-source-badge button'),
    ).toHaveLength(2);
    expect(el.querySelector('app-chat-message details')).toBeNull();
    expect(el.querySelector('[role="status"]')?.textContent).toContain(
      'Trợ lý trả lời:',
    );
    expect(input.value).toBe('');
  });

  describe('documents panel', () => {
    const toggle = () => el.querySelector('.chat__toggle') as HTMLButtonElement;
    const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

    afterEach(() =>
      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((c) => (c.innerHTML = '')),
    );

    it('sits beside the chat on a wide screen, and the toggle hides and shows it', async () => {
      await open();
      const panel = () => el.querySelector('aside#assistant-documents');
      expect(panel()?.getAttribute('aria-labelledby')).toBe(
        'assistant-documents-title',
      );
      expect(panel()?.querySelector('h2')?.textContent?.trim()).toBe(
        'Tài liệu trong kho',
      );
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(toggle().getAttribute('aria-controls')).toBe(
        'assistant-documents',
      );
      expect(toggle().textContent).toContain(
        `Tài liệu ${knowledgeDocumentFixtures.length}`,
      );

      toggle().click();
      await settle();
      expect(panel()).toBeNull();
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(el.classList).not.toContain('assistant--panel');

      toggle().click();
      await settle();
      expect(panel()).not.toBeNull();
      expect(el.classList).toContain('assistant--panel');
    });

    it('is a closed drawer on a narrow screen that Escape closes, giving focus back', async () => {
      breakpoints.wide.next(false);
      await open();
      expect(el.querySelector('aside')).toBeNull();
      expect(dialog()).toBeNull();
      expect(toggle().getAttribute('aria-expanded')).toBe('false');

      toggle().focus();
      toggle().click();
      await settle();
      await vi.waitFor(() => expect(dialog()).not.toBeNull());
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(dialog()?.textContent).toContain('Tài liệu trong kho');
      expect(
        dialog()?.querySelector('#assistant-documents app-document-list'),
      ).not.toBeNull();
      expect(dialog()?.querySelector('label.drop')).not.toBeNull();

      dialog()?.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          bubbles: true,
        }),
      );
      await settle();
      await vi.waitFor(() => expect(dialog()).toBeNull());
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      await vi.waitFor(() => expect(document.activeElement).toBe(toggle()));
    });
  });
});
