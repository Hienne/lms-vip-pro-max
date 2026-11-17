import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ConversationSummary } from '@lms/contracts';
import { ConversationList } from './conversation-list';

const row = (id: number, title: string): ConversationSummary => ({
  id,
  title,
  lastActivityTime: new Date().toISOString(),
  createTime: new Date().toISOString(),
});

@Component({
  selector: 'app-host',
  imports: [ConversationList],
  template: `<app-conversation-list
    [items]="items()"
    [activeId]="activeId()"
    [loading]="loading()"
    [failed]="failed()"
    [searching]="searching()"
    [openError]="openError()"
    [busy]="busy()"
    (searched)="events.push(['searched', $event])"
    (created)="events.push(['created'])"
    (opened)="events.push(['opened', $event])"
    (renamed)="events.push(['renamed', $event])"
    (removed)="events.push(['removed', $event.id])"
    (removedAll)="events.push(['removedAll'])"
    (retried)="events.push(['retried'])"
  />`,
})
class Host {
  readonly items = signal<readonly ConversationSummary[]>([
    row(1, 'Quy trình EOD'),
    row(2, 'Mở tài khoản'),
  ]);
  readonly activeId = signal<number | null>(2);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly searching = signal(false);
  readonly openError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly events: unknown[][] = [];
}

describe('ConversationList', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, host: fixture.componentInstance, el };
  }

  afterEach(() => document.body.replaceChildren());

  const button = (el: HTMLElement, name: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);

  it('lists each conversation as a button with its title, and marks the open one', async () => {
    const { el } = await render();
    const opens = el.querySelectorAll<HTMLButtonElement>('.history__open');
    expect(
      [...opens].map((b) => b.querySelector('.history__title')?.textContent),
    ).toEqual(['Quy trình EOD', 'Mở tài khoản']);
    expect(opens[0].getAttribute('aria-current')).toBeNull();
    expect(opens[1].getAttribute('aria-current')).toBe('true');
    expect(el.querySelector('ul')?.getAttribute('aria-label')).toBe(
      'Hội thoại đã lưu',
    );
  });

  it('gives every action a name that says which conversation it is for', async () => {
    const { el } = await render();
    expect(button(el, 'Đổi tên hội thoại Quy trình EOD')).not.toBeNull();
    expect(button(el, 'Xoá hội thoại Quy trình EOD')).not.toBeNull();
    expect(button(el, 'Đổi tên hội thoại Mở tài khoản')).not.toBeNull();
    expect(
      el.querySelector('input[type="search"]')?.getAttribute('aria-label'),
    ).toBe('Tìm hội thoại theo tên');
  });

  it('says what the user asked for: open, new, delete, delete all and search', async () => {
    const { el, host } = await render();
    el.querySelectorAll<HTMLButtonElement>('.history__open')[0].click();
    Array.from(el.querySelectorAll<HTMLButtonElement>('.history__bar button'))
      .find((b) => b.textContent?.includes('Hội thoại mới'))
      ?.click();
    button(el, 'Xoá hội thoại Mở tài khoản')?.click();
    Array.from(el.querySelectorAll<HTMLButtonElement>('.history__foot button'))
      .find((b) => b.textContent?.includes('Xoá tất cả'))
      ?.click();

    expect(host.events).toEqual([
      ['opened', 1],
      ['created'],
      ['removed', 2],
      ['removedAll'],
    ]);
  });

  it('renames in place: Enter saves the trimmed title, Escape and no change say nothing', async () => {
    const { fixture, el, host } = await render();
    const editor = () =>
      el.querySelector<HTMLInputElement>('input.history__editor');

    button(el, 'Đổi tên hội thoại Quy trình EOD')?.click();
    await fixture.whenStable();
    expect(editor()?.value).toBe('Quy trình EOD');
    expect(document.activeElement).toBe(editor());
    editor()!.value = '  Quy trình cuối ngày ';
    editor()!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    await fixture.whenStable();
    expect(host.events).toEqual([
      ['renamed', { id: 1, title: 'Quy trình cuối ngày' }],
    ]);
    expect(editor()).toBeNull();

    button(el, 'Đổi tên hội thoại Mở tài khoản')?.click();
    await fixture.whenStable();
    editor()!.value = 'Khác';
    editor()!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await fixture.whenStable();
    expect(editor()).toBeNull();

    button(el, 'Đổi tên hội thoại Mở tài khoản')?.click();
    await fixture.whenStable();
    button(el, 'Lưu tên')?.click();
    await fixture.whenStable();
    expect(host.events).toHaveLength(1);
  });

  it('keeps Escape inside the name box so it does not close a panel around it', async () => {
    const { fixture, el } = await render();
    button(el, 'Đổi tên hội thoại Quy trình EOD')?.click();
    await fixture.whenStable();
    const seen = vi.fn();
    el.addEventListener('keydown', seen);
    el.querySelector('input.history__editor')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(seen).not.toHaveBeenCalled();
  });

  it('moves focus to the list when the row that had it is deleted', async () => {
    const { fixture, el, host } = await render();
    button(el, 'Xoá hội thoại Quy trình EOD')?.focus();
    host.items.set([row(2, 'Mở tài khoản')]);
    await fixture.whenStable();
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(el.querySelector('ul')),
    );
  });

  it('does not take focus when the list shrinks while focus is elsewhere', async () => {
    const { fixture, el, host } = await render();
    const outside = document.createElement('input');
    document.body.appendChild(outside);
    outside.focus();
    host.items.set([row(2, 'Mở tài khoản')]);
    await fixture.whenStable();
    expect(document.activeElement).toBe(outside);
    expect(el.querySelector('ul')).not.toBeNull();
  });

  it('tells nothing saved from no match, and shows a failure with a retry', async () => {
    const { fixture, el, host } = await render();
    host.items.set([]);
    await fixture.whenStable();
    expect(el.textContent).toContain('Chưa có hội thoại nào.');
    expect(el.querySelector('.history__foot')).toBeNull();

    host.searching.set(true);
    await fixture.whenStable();
    expect(el.textContent).toContain('Không có hội thoại nào khớp.');

    host.failed.set(true);
    await fixture.whenStable();
    expect(el.textContent).toContain('Chưa tải được danh sách hội thoại.');
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Thử lại')
      ?.click();
    expect(host.events).toEqual([['retried']]);
  });

  it('shows why a conversation could not be opened and holds the row actions while busy', async () => {
    const { fixture, el, host } = await render();
    host.openError.set('Hội thoại này không còn.');
    host.busy.set(true);
    await fixture.whenStable();
    expect(el.textContent).toContain('Hội thoại này không còn.');
    expect(
      el.querySelector<HTMLButtonElement>('.history__open')?.disabled,
    ).toBe(true);
    expect(button(el, 'Xoá hội thoại Quy trình EOD')?.disabled).toBe(true);
  });
});
