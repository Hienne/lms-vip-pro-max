import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AgentChatStore } from '../../core/assistant/agent-chat.store';
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
  return {
    available,
    open,
    turns,
    answering,
    store: {
      available$: available.asReadonly(),
      isOpen$: open.asReadonly(),
      turns$: turns.asReadonly(),
      isAnswering$: answering.asReadonly(),
      isOffline$: signal(false).asReadonly(),
      isConfirming$: signal(false).asReadonly(),
      announcement$: signal('').asReadonly(),
      close: vi.fn(() => open.set(false)),
      clear: vi.fn(() => turns.set([])),
      ask: vi.fn(),
      stop: vi.fn(),
      confirm: vi.fn(),
      cancel: vi.fn(),
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

describe('ChatWidget', () => {
  async function render() {
    const fake = fakeStore();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AgentChatStore, useValue: fake.store },
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
    expect(el.querySelector('a.chat__link')?.getAttribute('href')).toBe(
      '/assistant',
    );
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

  it('closes from its close button too', async () => {
    const { el, store } = await render();
    el.querySelector<HTMLButtonElement>('button[aria-label="Đóng"]')?.click();
    expect(store.close).toHaveBeenCalled();
  });

  it('keeps clear disabled with no turns or while a reply is on its way', async () => {
    const { fixture, el, turns, answering, store } = await render();
    const clear = () =>
      el.querySelector<HTMLButtonElement>(
        'button[aria-label="Xoá hội thoại"]',
      )!;
    expect(clear().disabled).toBe(true);
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
    el.querySelector<HTMLButtonElement>('.composer__bar button')?.click();
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
});
