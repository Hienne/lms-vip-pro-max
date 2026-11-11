import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  flashcardEndpoints as course,
  personalFlashcardEndpoints as personal,
  type PersonalCard,
} from '@lms/contracts';
import { backendRefusal, envelopeOk } from '@lms/mocks';
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
import { Flashcards } from './flashcards';

describe('Flashcard study flow', () => {
  let card: PersonalCard;
  let failSave: boolean;
  let failReveal: boolean;
  let root: HTMLElement;
  const requests: unknown[] = [];
  beforeEach(() => {
    card = {
      id: 1,
      prompt: 'Core Banking là gì?',
      answer: 'Hệ thống ngân hàng lõi.',
      starred: false,
      reviewStatus: null,
    };
    failSave = false;
    failReveal = false;
    requests.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        provideRouter([{ path: '', component: Flashcards }]),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
    const backend = TestBed.inject(MockBackend);
    const handle = backend.handle.bind(backend);
    vi.spyOn(backend, 'handle').mockImplementation((endpoint, request) => {
      if (endpoint === personal.decks)
        return {
          status: 200,
          body: envelopeOk([
            { id: 1, name: 'Core Banking', cardCount: 1, courseId: null },
            { id: 2, name: 'Bộ trống', cardCount: 0, courseId: null },
          ]),
        };
      if (endpoint === personal.cards)
        return {
          status: 200,
          body: envelopeOk(
            Number(request.params['deckId']) === 1 ? [card] : [],
          ),
        };
      if (endpoint === personal.progress) {
        requests.push(request.body);
        if (failSave) return backendRefusal('internalError');
        const body = request.body as {
          rating?: 'AGAIN' | 'KNOWN';
          starred?: boolean;
        };
        card = {
          ...card,
          ...(body.rating ? { reviewStatus: body.rating } : {}),
          ...(body.starred !== undefined ? { starred: body.starred } : {}),
        };
        return { status: 200, body: envelopeOk(card) };
      }
      if (endpoint === course.list)
        return {
          status: 200,
          body: envelopeOk([
            {
              id: 1,
              questionVersion: 2,
              competencyId: 1,
              competencyName: 'Nghiệp vụ',
              prompt: card.prompt,
              starred: false,
              reviewStatus: null,
            },
          ]),
        };
      if (endpoint === course.reveal)
        return failReveal
          ? backendRefusal('internalError')
          : {
              status: 200,
              body: envelopeOk({ options: [card.answer], explanation: null }),
            };
      if (endpoint === course.progress) {
        requests.push(request.body);
        return failSave
          ? backendRefusal('internalError')
          : { status: 200, body: envelopeOk(true) };
      }
      return handle(endpoint, request);
    });
  });
  async function settle() {
    for (let i = 0; i < 8; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  async function open(url = '/') {
    signInToMockBackend('hocvien');
    fakeSession().user.set(seedProfile('000004'));
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
    root = harness.routeNativeElement as HTMLElement;
  }
  async function click(label: string) {
    const button = Array.from(
      root.querySelectorAll<HTMLButtonElement>('button'),
    ).find((b) => b.textContent?.replace(/\s+/g, ' ').trim() === label);
    expect(button, label).toBeDefined();
    button?.click();
    await settle();
  }
  const percent = () =>
    root.querySelector('ui-progress')?.getAttribute('aria-valuenow');

  it('shows one deck choice and sends empty decks to add cards', async () => {
    await open();
    await click('Tạo bộ thẻ');
    expect(root.querySelector('input[aria-label="Tên bộ thẻ"]')).not.toBeNull();
    await click('Hủy');
    expect(
      root.querySelectorAll('app-personal-flashcards select'),
    ).toHaveLength(0);
    expect(
      Array.from(root.querySelectorAll('button')).filter((b) =>
        b.textContent?.includes('Ôn bộ này'),
      ),
    ).toHaveLength(1);
    expect(root.textContent).toContain('Chưa có thẻ');
    await click('Thêm thẻ');
    expect(root.textContent).toContain('Quản lý thẻ');
  });
  it('counts only saved personal ratings, not reveal or star, and retries the marked-again subset', async () => {
    await open();
    await click('Ôn bộ này');
    await click('Bắt đầu ôn');
    expect(root.querySelector('[aria-modal]')).toBeNull();
    expect(percent()).toBe('0');
    await click('Đánh dấu');
    expect(percent()).toBe('0');
    await click('Xem đáp án');
    expect(percent()).toBe('0');
    await click('Cần ôn lại');
    expect(percent()).toBe('100');
    expect(root.textContent).toContain('Đã hoàn tất lượt ôn');
    await click('Ôn lại thẻ chưa nhớ');
    expect(percent()).toBe('0');
    await click('Xem đáp án');
    await click('Đã nhớ');
    expect(root.textContent).not.toContain('Ôn lại thẻ chưa nhớ');
    expect(requests).toEqual([
      { starred: true },
      { rating: 'AGAIN' },
      { rating: 'KNOWN' },
    ]);
    await click('Về bộ thẻ');
    expect(root.textContent).toContain('Bộ thẻ của tôi');
  });
  it('keeps the personal answer and progress when saving fails', async () => {
    await open();
    await click('Ôn bộ này');
    await click('Bắt đầu ôn');
    await click('Xem đáp án');
    failSave = true;
    await click('Đã nhớ');
    expect(percent()).toBe('0');
    expect(root.textContent).toContain(card.answer);
    expect(root.textContent).not.toContain('Đã hoàn tất lượt ôn');
  });
  it('uses the same course session and saves its question version after reveal', async () => {
    await open('/?courseId=1');
    await click('Bắt đầu ôn');
    expect(percent()).toBe('0');
    failReveal = true;
    await click('Xem đáp án');
    expect(root.textContent).toContain('Không tải được đáp án');
    expect(percent()).toBe('0');
    failReveal = false;
    await click('Thử lại');
    expect(root.textContent).toContain(card.answer);
    await click('Đã nhớ');
    expect(percent()).toBe('100');
    expect(requests).toEqual([{ questionVersion: 2, rating: 'KNOWN' }]);
  });
});
