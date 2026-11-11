import { CourseJobAccess } from '../../core/course-jobs/course-job-access';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { ConversationSummary, ConversationContext } from '@lms/contracts';
import { AgentChatStore } from '../../core/assistant/agent-chat.store';
import { ConversationsStore } from '../../core/assistant/conversations.store';
import { AGENT_LAUNCHER_ID } from '../../core/assistant/agent-launcher';
import type { AgentTurn } from '../../core/assistant/agent-chat.model';
import { ChatWidget } from './chat-widget';

const turn = (id: number, text: string): AgentTurn => ({
  id,
  question: `Câu ${id}`,
  reply: {
    status: 'done',
    toolName: null,
    text,
    citations: [],
    navigatedTo: null,
    action: null,
    error: null,
  },
});

/** A store with nothing behind it: the panel only reads selectors and calls commands. */
function fakeStore() {
  const available = signal(true);
  const open = signal(true);
  const turns = signal<readonly AgentTurn[]>([]);
  const answering = signal(false);
  const docked = signal(false);
  const historyOpen = signal(false);
  const lesson = signal<ConversationContext | null>(null);
  const items = signal<readonly ConversationSummary[]>([]);
  return {
    docked,
    historyOpen,
    lesson,
    items,
    available,
    open,
    turns,
    answering,
    store: {
      available$: available.asReadonly(),
      isOpen$: open.asReadonly(),
      isDocked$: docked.asReadonly(),
      turns$: turns.asReadonly(),
      isAnswering$: answering.asReadonly(),
      isOffline$: signal(false).asReadonly(),
      isConfirming$: signal(false).asReadonly(),
      ratingId$: signal<number | null>(null).asReadonly(),
      ratingFailedId$: signal<number | null>(null).asReadonly(),
      announcement$: signal('').asReadonly(),
      isHistoryOpen$: historyOpen.asReadonly(),
      isOpening$: signal(false).asReadonly(),
      openError$: signal<string | null>(null).asReadonly(),
      conversationId$: signal<number | null>(null).asReadonly(),
      lesson$: lesson.asReadonly(),
      showHistory: vi.fn(() => historyOpen.set(true)),
      hideHistory: vi.fn(() => historyOpen.set(false)),
      openConversation: vi.fn(),
      close: vi.fn(() => open.set(false)),
      clear: vi.fn(() => turns.set([])),
      ask: vi.fn(),
      stop: vi.fn(),
      toggleDocked: vi.fn(() => docked.update((value) => !value)),
      confirm: vi.fn(),
      cancel: vi.fn(),
      retry: vi.fn(),
      rate: vi.fn(),
    },
    history: {
      items$: items.asReadonly(),
      isLoading$: signal(false).asReadonly(),
      loadError$: signal(undefined).asReadonly(),
      query$: signal('').asReadonly(),
      isChanging$: signal(false).asReadonly(),
      setQuery: vi.fn(),
      rename: vi.fn(),
      remove: vi.fn(),
      removeAll: vi.fn(),
      retryLoad: vi.fn(),
    },
  };
}

@Component({
  selector: 'app-host',
  imports: [ChatWidget],
  template: `<button id="agent-chat-launcher" type="button">Owl</button
    ><app-chat-widget />`,
})
class Host {}

@Component({ selector: 'app-blank', template: '' })
class Blank {}

describe('ChatWidget', () => {
  async function render() {
    const fake = fakeStore();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: Blank }]),
        { provide: AgentChatStore, useValue: fake.store },
        { provide: CourseJobAccess, useValue: { canGenerate$: signal(false) } },
        { provide: ConversationsStore, useValue: fake.history },
      ],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, ...fake };
  }

  const dialog = (el: HTMLElement) =>
    el.querySelector<HTMLElement>('[role="dialog"]');

  it('is a non-modal dialog named "Trợ lý nhanh", headed by the owl, with the empty line when there are no turns', async () => {
    const { el } = await render();
    const panel = dialog(el);
    expect(panel?.getAttribute('aria-modal')).toBe('false');
    expect(panel?.getAttribute('aria-label')).toBe('Trợ lý nhanh');
    expect(panel?.querySelector('h2')).toBeNull();
    const face = panel?.querySelector('.chat__header app-owl-face svg');
    expect(face?.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.chat__empty')?.textContent).toContain(
      'Hỏi về tài liệu, mở một màn hình hoặc sửa hồ sơ của bạn.',
    );
    const header = [
      ...el.querySelectorAll('.chat__header button, .chat__header a'),
    ].map((control) => control.getAttribute('aria-label'));
    expect(header).toEqual(['Lịch sử hội thoại', 'Mở rộng', 'Đóng']);
  });

  it('names the lesson a conversation is about and opens it with questions about that lesson', async () => {
    const { fixture, el, store, lesson } = await render();
    expect(el.querySelector('.chat__context')).toBeNull();

    lesson.set({
      courseId: 5,
      revisionId: 50,
      lessonId: 9,
      label: 'Tín dụng › Lãi suất',
    });
    await fixture.whenStable();

    expect(el.querySelector('.chat__context')?.textContent).toContain(
      'Tín dụng › Lãi suất',
    );
    const suggestions = [
      ...el.querySelectorAll<HTMLButtonElement>('.chat__suggestion'),
    ];
    expect(suggestions.map((button) => button.textContent?.trim())).toEqual([
      'Bài này nói gì?',
      'Tóm tắt bài này',
    ]);
    suggestions[1].click();
    expect(store.ask).toHaveBeenCalledWith('Tóm tắt bài này', 'tom_tat_bai');
  });

  it('renders nothing while closed or when the assistant is not available', async () => {
    const { fixture, el, open, available } = await render();
    open.set(false);
    await fixture.whenStable();
    expect(dialog(el)).toBeNull();
    open.set(true);
    available.set(false);
    await fixture.whenStable();
    expect(dialog(el)).toBeNull();
  });

  it('focuses the message box when it opens', async () => {
    const { fixture, el, open } = await render();
    expect(document.activeElement).toBe(el.querySelector('textarea'));
    open.set(false);
    await fixture.whenStable();
    open.set(true);
    await fixture.whenStable();
    expect(document.activeElement).toBe(el.querySelector('textarea'));
  });

  it('starts every opening at the newest message', async () => {
    const height = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockReturnValue(900);
    try {
      const { fixture, el, open, turns } = await render();
      turns.set([turn(1, 'Trả lời một'), turn(2, 'Trả lời hai')]);
      await fixture.whenStable();
      open.set(false);
      await fixture.whenStable();
      open.set(true);
      await fixture.whenStable();
      expect(el.querySelector<HTMLElement>('[role="log"]')?.scrollTop).toBe(
        900,
      );
    } finally {
      height.mockRestore();
    }
  });

  it('closes on Escape and hands focus back to the owl', async () => {
    const { fixture, el, store } = await render();
    el.querySelector('textarea')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await fixture.whenStable();
    expect(store.close).toHaveBeenCalled();
    expect(dialog(el)).toBeNull();
    expect(document.activeElement?.id).toBe(AGENT_LAUNCHER_ID);
  });

  it('docks and undocks from its header, saying which it will do', async () => {
    const { fixture, el, store } = await render();
    const toggle = () =>
      el.querySelector<HTMLButtonElement>('.chat__dock') as HTMLButtonElement;
    expect(toggle().getAttribute('aria-label')).toBe('Mở rộng');
    expect(el.querySelector('app-chat-widget')?.classList).not.toContain(
      'chat-widget--docked',
    );
    toggle().click();
    await fixture.whenStable();
    expect(store.toggleDocked).toHaveBeenCalled();
    expect(toggle().getAttribute('aria-label')).toBe('Thu nhỏ');
    expect(el.querySelector('app-chat-widget')?.classList).toContain(
      'chat-widget--docked',
    );
  });

  it('closes from its close button too', async () => {
    const { el, store } = await render();
    el.querySelector<HTMLButtonElement>('button[aria-label="Đóng"]')?.click();
    expect(store.close).toHaveBeenCalled();
  });

  it('offers a new conversation only once there is one, and not while a reply is on its way', async () => {
    const { fixture, el, turns, answering, store } = await render();
    const clear = () =>
      el.querySelector<HTMLButtonElement>(
        'button[aria-label="Hội thoại mới"]',
      ) as HTMLButtonElement;
    expect(clear()).toBeNull();
    turns.set([turn(1, 'Trả lời một')]);
    await fixture.whenStable();
    expect(clear().disabled).toBe(false);
    answering.set(true);
    await fixture.whenStable();
    expect(clear().disabled).toBe(true);
    answering.set(false);
    await fixture.whenStable();
    clear().click();
    expect(store.clear).toHaveBeenCalled();
  });

  it('swaps the log for the saved conversations from the history button, and back', async () => {
    const { fixture, el, items, store } = await render();
    items.set([
      {
        id: 7,
        title: 'Quy trình EOD',
        lastActivityTime: '2026-11-10T09:00:00Z',
        createTime: '2026-11-10T09:00:00Z',
      },
    ]);
    const toggle = () =>
      el.querySelector<HTMLButtonElement>(
        '.chat__header button[aria-label$="hội thoại"][aria-pressed]',
      ) as HTMLButtonElement;
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(el.querySelector('app-conversation-list')).toBeNull();

    toggle().click();
    await fixture.whenStable();
    expect(store.showHistory).toHaveBeenCalled();
    expect(el.querySelector('[role="log"]')).toBeNull();
    expect(el.querySelector('textarea')).toBeNull();
    expect(el.querySelector('app-conversation-list')?.textContent).toContain(
      'Quy trình EOD',
    );
    expect(toggle().getAttribute('aria-label')).toBe('Quay lại hội thoại');

    toggle().click();
    await fixture.whenStable();
    expect(store.hideHistory).toHaveBeenCalled();
    expect(el.querySelector('[role="log"]')).not.toBeNull();
  });

  it('reopens a conversation from the list through the store', async () => {
    const { fixture, el, items, store, historyOpen } = await render();
    items.set([
      {
        id: 7,
        title: 'Quy trình EOD',
        lastActivityTime: '2026-11-10T09:00:00Z',
        createTime: '2026-11-10T09:00:00Z',
      },
    ]);
    historyOpen.set(true);
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('.history__open')?.click();
    expect(store.openConversation).toHaveBeenCalledWith(7);
  });

  it('offers three suggested questions that are sent as they stand, then puts the cursor in the box', async () => {
    const { el, store } = await render();
    const suggestions = [
      ...el.querySelectorAll<HTMLButtonElement>('.chat__suggestion'),
    ];
    expect(suggestions.map((s) => s.textContent?.trim())).toEqual([
      'Quy trình EOD gồm những bước nào?',
      'Mở trang Hồ sơ cá nhân',
      'Đổi chức danh của tôi',
    ]);
    suggestions[1].click();
    expect(store.ask).toHaveBeenCalledWith(
      'Mở trang Hồ sơ cá nhân',
      'dieu_huong',
    );
    expect(document.activeElement?.id).toBe('agent-composer-box');
  });

  it('offers follow-ups only under the newest finished answer, and asking one sends it', async () => {
    const { fixture, el, store, turns, answering } = await render();
    turns.set([
      { ...turn(1, 'Một'), suggestions: ['Cũ?'] },
      { ...turn(2, 'Hai'), suggestions: ['Còn gì nữa?', 'Ví dụ?'] },
    ]);
    await fixture.whenStable();
    const buttons = () => [
      ...el.querySelectorAll<HTMLButtonElement>('.chat__suggestion'),
    ];
    expect(buttons().map((b) => b.textContent?.trim())).toEqual([
      'Còn gì nữa?',
      'Ví dụ?',
    ]);

    buttons()[1].click();
    expect(store.ask).toHaveBeenCalledWith('Ví dụ?', undefined);

    answering.set(true);
    await fixture.whenStable();
    expect(buttons()).toHaveLength(0);
  });

  it('shows each turn in order and hides the empty line', async () => {
    const { fixture, el, turns } = await render();
    turns.set([turn(1, 'Trả lời một'), turn(2, 'Trả lời hai')]);
    await fixture.whenStable();
    expect(el.querySelectorAll('app-agent-message')).toHaveLength(2);
    expect(el.querySelector('.chat__empty')).toBeNull();
  });

  it('sends a message the composer asks and stops the reply on request', async () => {
    const { fixture, el, store, answering } = await render();
    const box = el.querySelector<HTMLTextAreaElement>('textarea')!;
    box.value = 'EOD là gì?';
    box.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    box.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }),
    );
    await fixture.whenStable();
    expect(store.ask).toHaveBeenCalledWith('EOD là gì?');
    answering.set(true);
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('.composer__action')?.click();
    expect(store.stop).toHaveBeenCalled();
  });

  it('hands a card’s Xác nhận and Huỷ to the store with the turn it belongs to', async () => {
    const { fixture, el, turns, store } = await render();
    turns.set([
      {
        ...turn(7, 'Vui lòng kiểm tra và xác nhận thay đổi bên dưới.'),
        reply: {
          ...turn(7, '').reply,
          text: 'Vui lòng kiểm tra và xác nhận thay đổi bên dưới.',
          action: {
            status: 'pending',
            message: null,
            pending: {
              id: 'a1',
              tool: 'update_profile',
              title: 'Cập nhật hồ sơ cá nhân',
              changes: [
                {
                  field: 'positionName',
                  label: 'Chức danh',
                  from: null,
                  to: 'Chuyên viên',
                },
              ],
              expiresAt: '2026-10-24T09:10:00Z',
            },
          },
        },
      },
    ]);
    await fixture.whenStable();
    const [confirm, cancel] = Array.from(
      el.querySelectorAll<HTMLButtonElement>('app-action-card button'),
    );
    confirm.click();
    cancel.click();
    expect(store.confirm).toHaveBeenCalledWith(7);
    expect(store.cancel).toHaveBeenCalledWith(7);
  });

  it('puts the cursor back in the message box after a card button is used, since the buttons go away', async () => {
    const { fixture, el, turns } = await render();
    turns.set([
      {
        ...turn(7, 'Vui lòng kiểm tra và xác nhận thay đổi bên dưới.'),
        reply: {
          ...turn(7, '').reply,
          action: {
            status: 'pending',
            message: null,
            pending: {
              id: 'a1',
              tool: 'update_profile',
              title: 'Cập nhật hồ sơ cá nhân',
              changes: [
                {
                  field: 'positionName',
                  label: 'Chức danh',
                  from: null,
                  to: 'Chuyên viên',
                },
              ],
              expiresAt: '2026-10-24T09:10:00Z',
            },
          },
        },
      },
    ]);
    await fixture.whenStable();
    const confirm = el.querySelector<HTMLButtonElement>(
      'app-action-card button',
    )!;
    confirm.focus();
    expect(document.activeElement).toBe(confirm);
    confirm.click();
    expect(document.activeElement).toBe(el.querySelector('textarea'));
  });

  it('offers opening questions that follow the page, and the default three elsewhere', async () => {
    const { fixture, el } = await render();
    const router = TestBed.inject(Router);
    const questions = () =>
      [...el.querySelectorAll('.chat__suggestion')].map((b) =>
        b.textContent?.trim(),
      );
    const fallback = questions();
    expect(fallback).toHaveLength(3);

    await router.navigateByUrl('/quiz/4/take');
    await fixture.whenStable();
    const quiz = questions();
    expect(quiz).toHaveLength(3);
    expect(quiz).not.toEqual(fallback);

    await router.navigateByUrl('/community/questions');
    await fixture.whenStable();
    expect(questions()).not.toEqual(quiz);

    await router.navigateByUrl('/profile');
    await fixture.whenStable();
    expect(questions()).toEqual(fallback);
  });

  it('retries a turn through the store', async () => {
    const { fixture, el, turns, store } = await render();
    turns.set([
      {
        id: 4,
        question: 'Câu lỗi',
        reply: { ...turn(4, '').reply, status: 'error', error: 'Lỗi' },
      },
    ]);
    await fixture.whenStable();
    const retry = [...el.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Thử lại',
    );
    retry?.click();
    expect(store.retry).toHaveBeenCalledWith(4);
  });
  it('offers the thumbs only under a finished answer the server stored, and hands a click to the store with the turn', async () => {
    const { fixture, el, turns, store } = await render();
    const done = (id: number, serverTurnId?: number): AgentTurn => ({
      ...turn(id, 'Câu hỏi'),
      reply: { ...turn(id, '').reply, status: 'done', text: 'Trả lời.' },
      ...(serverTurnId ? { serverTurnId, feedback: null } : {}),
    });
    turns.set([done(1), done(2, 52)]);
    await fixture.whenStable();
    expect(el.querySelectorAll('app-answer-feedback')).toHaveLength(1);

    el.querySelector<HTMLButtonElement>(
      'app-answer-feedback button[aria-label="Câu trả lời hữu ích"]',
    )?.click();
    expect(store.rate).toHaveBeenCalledWith(2, { helpful: true });
  });
});
