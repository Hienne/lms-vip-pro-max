import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  envelopeOk,
  knowledgeDocumentFixtures,
  knowledgeStreamFixture,
} from '@lms/mocks';
import type { StoredTurn } from '@lms/contracts';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../core/http/http.testing';
import { SourceViewerStore } from '../../../core/assistant/source-viewer.store';
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

  it('is a page of its own with the title, the greeting and what it searches', async () => {
    await open();
    expect(el.querySelector('h1')?.textContent?.trim()).toBe(
      'Trợ lý AI tra cứu tài liệu',
    );
    expect(text()).toContain(
      'Xin chào! Hãy hỏi mình bất kỳ điều gì về nội dung tài liệu trong kho.',
    );
    expect(text()).toContain('Trợ lý chỉ trả lời từ các tài liệu trong kho.');
    expect(
      el
        .querySelector('.chat__scope')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim(),
    ).toBe(`Tra trong: Tất cả tài liệu (${knowledgeDocumentFixtures.length})`);
    // The documents stay shut in their drawer until the scope line opens it.
    expect(document.querySelector('app-document-list')).toBeNull();
    expect(
      el.querySelector('.chat__scope-open')?.getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('is open to a learner as well as an instructor', async () => {
    await open('000001');
    expect(el.querySelector('h1')?.textContent?.trim()).toBe(
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

  it('rates a finished answer, and the thumbs show the server’s saved choice', async () => {
    await open();
    const input = el.querySelector(
      'input#assistant-question',
    ) as HTMLInputElement;
    input.value = 'EOD là gì?';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    await settle();
    expect(el.querySelector('app-answer-feedback')).toBeNull();

    backend
      .expectOne(STREAM)
      .flush(
        knowledgeStreamFixture
          .map((e) =>
            JSON.stringify(e.type === 'done' ? { ...e, turnId: 41 } : e),
          )
          .join('\n'),
        { headers: { 'Content-Type': 'application/x-ndjson' } },
      );
    await settle();
    const up = el.querySelector<HTMLButtonElement>(
      'app-answer-feedback button[aria-label="Câu trả lời hữu ích"]',
    );
    expect(up?.getAttribute('aria-pressed')).toBe('false');

    up?.click();
    await settle();
    const request = backend.expectOne('/api/v1/assistant/turns/41/feedback');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ helpful: true });
    request.flush(envelopeOk({ helpful: true, reasonCode: null, note: null }));
    await settle();
    expect(
      el
        .querySelector(
          'app-answer-feedback button[aria-label="Câu trả lời hữu ích"]',
        )
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('offers follow-ups under the newest answer, asks one on click, and drops them with the next question', async () => {
    await open();
    const input = el.querySelector(
      'input#assistant-question',
    ) as HTMLInputElement;
    input.value = 'EOD là gì?';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    await settle();
    expect(el.querySelector('.log__suggestions')).toBeNull();

    backend
      .expectOne(STREAM)
      .flush(
        knowledgeStreamFixture
          .map((e) =>
            JSON.stringify(
              e.type === 'done' ? { ...e, suggestions: ['Còn ngoại lệ?'] } : e,
            ),
          )
          .join('\n'),
        { headers: { 'Content-Type': 'application/x-ndjson' } },
      );
    await settle();
    const chips = el.querySelectorAll<HTMLButtonElement>(
      '.log__suggestions button',
    );
    expect(Array.from(chips).map((b) => b.textContent?.trim())).toEqual([
      'Còn ngoại lệ?',
    ]);

    chips[0].click();
    await settle();
    expect(el.querySelector('.log__suggestions')).toBeNull();
    expect(backend.expectOne(STREAM).request.body).toMatchObject({
      question: 'Còn ngoại lệ?',
    });
  });

  describe('sources', () => {
    const TEXT = '/api/v1/knowledge/documents/1/text';

    afterEach(() =>
      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((c) => (c.innerHTML = '')),
    );

    async function askAndAnswer(): Promise<void> {
      const input = el.querySelector(
        'input#assistant-question',
      ) as HTMLInputElement;
      input.value = 'Quy trình EOD gồm những bước nào?';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      el.querySelector('form')?.dispatchEvent(new Event('submit'));
      await settle();
      backend
        .expectOne(STREAM)
        .flush(
          knowledgeStreamFixture.map((e) => JSON.stringify(e)).join('\n'),
          {
            headers: { 'Content-Type': 'application/x-ndjson' },
          },
        );
      await settle();
    }
    const sourceRows = () =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('.sources .source'));

    it('lists the sources under the answer and opens one in a pane beside the chat', async () => {
      await open();
      await askAndAnswer();
      expect(sourceRows()).toHaveLength(2);
      expect(el.querySelector('aside.source')).toBeNull();

      sourceRows()[0].click();
      await settle();
      const pane = el.querySelector('aside.source');
      expect(pane?.querySelector('h2')?.textContent?.trim()).toBe(
        'Quy-trinh-EOD.pdf',
      );
      expect(el.classList).toContain('assistant--source');
      expect(backend.match((r) => r.url === TEXT)).toHaveLength(1);
      expect(TestBed.inject(SourceViewerStore).docked$()).toBe(true);

      (
        pane?.querySelector(
          'button[aria-label="Đóng nguồn"]',
        ) as HTMLButtonElement
      ).click();
      await settle();
      expect(el.querySelector('aside.source')).toBeNull();
    });

    it('leaves a source to the shell’s drawer on a narrower screen', async () => {
      breakpoints.wide.next(false);
      await open();
      await askAndAnswer();
      sourceRows()[0].click();
      await settle();
      // The drawer is the shell's (`app-source-viewer`), which this harness does not render.
      const viewer = TestBed.inject(SourceViewerStore);
      expect(viewer.citation$()?.fileName).toBe('Quy-trinh-EOD.pdf');
      expect(viewer.docked$()).toBe(false);
      expect(el.querySelector('aside.source')).toBeNull();
    });
  });

  describe('documents drawer', () => {
    const drawer = () => document.querySelector<HTMLElement>('[role="dialog"]');
    // A query-parameter navigation lands a few turns after the click.
    async function navigated(): Promise<void> {
      for (let turn = 0; turn < 3; turn++) {
        await new Promise((resolve) => setTimeout(resolve));
        await settle();
      }
    }

    afterEach(() =>
      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((c) => (c.innerHTML = '')),
    );

    it('opens from the scope line with the upload and the list, and closes back to the chat', async () => {
      await open();
      el.querySelector<HTMLButtonElement>('.chat__scope-open')?.click();
      await navigated();

      expect(TestBed.inject(Router).url).toBe('/assistant?tai-lieu=1');
      expect(drawer()?.textContent).toContain('Tài liệu của trợ lý');
      expect(drawer()?.querySelector('label.drop')).not.toBeNull();
      expect(drawer()?.querySelectorAll('app-document-list li')).toHaveLength(
        knowledgeDocumentFixtures.length,
      );
      expect(
        el.querySelector('.chat__scope-open')?.getAttribute('aria-expanded'),
      ).toBe('true');

      drawer()
        ?.querySelector<HTMLButtonElement>('button[aria-label="Đóng"]')
        ?.click();
      await navigated();
      expect(TestBed.inject(Router).url).toBe('/assistant');
      expect(drawer()).toBeNull();
    });

    it('opens the drawer from the old documents URL', async () => {
      fakeSession().user.set(seedProfile('000005'));
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/assistant/tai-lieu');
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

      expect(TestBed.inject(Router).url).toBe('/assistant?tai-lieu=1');
      expect(drawer()?.querySelector('app-document-list')).not.toBeNull();
    });
  });

  describe('saved conversations', () => {
    const LIST_CONVERSATIONS = '/api/v1/assistant/conversations';
    const summary = {
      id: 7,
      title: 'Quy trình EOD',
      lastActivityTime: '2026-11-10T09:00:00Z',
      createTime: '2026-11-10T09:00:00Z',
    };
    const storedTurn: StoredTurn = {
      id: 1,
      surface: 'AGENT',
      question: 'EOD là gì?',
      answer: 'Chạy EOD phải đối chiếu số dư.',
      citations: [],
      toolNames: [],
      navigation: null,
      actionId: 'a1',
      action: {
        id: 'a1',
        tool: 'update_profile',
        title: 'Cập nhật hồ sơ cá nhân',
        changes: [],
        status: 'expired',
        expiresAt: '2026-11-10T09:10:00Z',
        message: null,
      },
      feedback: null,
      status: 'done',
      createTime: '2026-11-10T09:00:00Z',
    };

    const flushList = (items: readonly (typeof summary)[]) =>
      backend
        .expectOne((r) => r.url === LIST_CONVERSATIONS && r.method === 'GET')
        .flush(
          envelopeOk({
            items,
            page: 0,
            size: 50,
            totalElements: items.length,
            totalPages: 1,
          }),
        );

    afterEach(() =>
      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((c) => (c.innerHTML = '')),
    );

    it('lists the saved conversations in a column beside the chat on a wide screen', async () => {
      await open();
      flushList([summary]);
      await settle();

      const aside = el.querySelector('aside#assistant-history');
      expect(aside?.getAttribute('aria-labelledby')).toBe(
        'assistant-history-title',
      );
      expect(aside?.querySelector('.history__title')?.textContent).toBe(
        'Hội thoại',
      );
      expect(aside?.textContent).toContain('Quy trình EOD');
      expect(el.classList).toContain('assistant--history');
    });

    it('is a closed drawer on a narrow screen that the Hội thoại button opens', async () => {
      breakpoints.wide.next(false);
      await open();
      expect(el.querySelector('aside')).toBeNull();
      const toggle = Array.from(
        el.querySelectorAll<HTMLButtonElement>('.chat__toggle'),
      ).find((b) => b.textContent?.includes('Hội thoại')) as HTMLButtonElement;
      expect(toggle.getAttribute('aria-expanded')).toBe('false');

      toggle.click();
      await settle();
      flushList([summary]);
      await vi.waitFor(() =>
        expect(
          document.querySelector('[role="dialog"]')?.textContent,
        ).toContain('Quy trình EOD'),
      );
    });

    it('reopens a saved conversation with its answer and the state of its card, and a reload keeps it open', async () => {
      await open();
      flushList([summary]);
      await settle();

      el.querySelector<HTMLButtonElement>('.history__open')?.click();
      await settle();
      backend
        .expectOne('/api/v1/assistant/conversations/7')
        .flush(envelopeOk({ ...summary, turns: [storedTurn] }));
      await settle();

      expect(text()).toContain('EOD là gì?');
      expect(text()).toContain('Chạy EOD phải đối chiếu số dư.');
      expect(text()).toContain('Đề xuất “Cập nhật hồ sơ cá nhân”: đã hết hạn');
      expect(sessionStorage.getItem('lms.assistant-page.v1.000005')).toBe('7');
    });

    it('starts a new conversation from the list, forgetting the open one', async () => {
      await open();
      flushList([summary]);
      await settle();
      el.querySelector<HTMLButtonElement>('.history__open')?.click();
      await settle();
      backend
        .expectOne('/api/v1/assistant/conversations/7')
        .flush(envelopeOk({ ...summary, turns: [storedTurn] }));
      await settle();

      Array.from(el.querySelectorAll<HTMLButtonElement>('.history__bar button'))
        .find((b) => b.textContent?.includes('Hội thoại mới'))
        ?.click();
      await settle();

      expect(el.querySelector('app-chat-message')).toBeNull();
      expect(sessionStorage.getItem('lms.assistant-page.v1.000005')).toBeNull();
    });
  });
});
