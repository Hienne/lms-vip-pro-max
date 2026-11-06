import { Dialog } from '@angular/cdk/dialog';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { choose, confirm, type ConfirmOptions } from './confirm-dialog';

@Component({ template: `<button id="opener">Mở hộp thoại</button>` })
class Host {}

const OPTIONS: ConfirmOptions = {
  title: 'Xóa câu hỏi?',
  message: 'Thao tác không thể hoàn tác.',
  confirmLabel: 'Xóa',
};

function setup() {
  const fixture = TestBed.createComponent(Host);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  const opener = fixture.nativeElement.querySelector(
    '#opener',
  ) as HTMLButtonElement;
  opener.focus();
  const dialog = TestBed.inject(Dialog);
  const results: boolean[] = [];
  const open = (options: ConfirmOptions = OPTIONS) =>
    confirm(dialog, options).subscribe((result) => results.push(result));
  return { opener, open, results };
}

async function settle() {
  TestBed.tick();
  await Promise.resolve();
  TestBed.tick();
}

const panel = () => document.querySelector('[role="alertdialog"]');
const button = (label: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent?.trim() === label,
  );

afterEach(() => {
  TestBed.inject(Dialog).closeAll();
  document.querySelector('.cdk-overlay-container')?.remove();
  document.body.replaceChildren();
});

describe('confirm', () => {
  it('resolves true when the user confirms', async () => {
    const { open, results } = setup();
    open();
    await settle();

    button('Xóa')?.click();
    await settle();

    await vi.waitFor(() => expect(results).toEqual([true]));
    expect(panel()).toBeNull();
  });

  it('resolves false on the cancel button', async () => {
    const { open, results } = setup();
    open();
    await settle();

    button('Hủy')?.click();

    await vi.waitFor(() => expect(results).toEqual([false]));
  });

  it('resolves false on the close icon', async () => {
    const { open, results } = setup();
    open();
    await settle();

    (
      document.querySelector('[aria-label="Đóng hộp thoại"]') as HTMLElement
    ).click();

    await vi.waitFor(() => expect(results).toEqual([false]));
  });

  it('resolves false on Escape', async () => {
    const { open, results } = setup();
    open();
    await settle();

    panel()?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        bubbles: true,
      }),
    );

    await vi.waitFor(() => expect(results).toEqual([false]));
    expect(panel()).toBeNull();
  });

  it('resolves false on a backdrop click', async () => {
    const { open, results } = setup();
    open();
    await settle();

    (document.querySelector('.dialog-backdrop') as HTMLElement).click();

    await vi.waitFor(() => expect(results).toEqual([false]));
  });

  it('does not open until subscribed', async () => {
    const dialog = setup();
    expect(panel()).toBeNull();
    dialog.open();
    await settle();
    expect(panel()).not.toBeNull();
  });

  it('is labelled by its title and described by its message', async () => {
    const { open } = setup();
    open();
    await settle();

    const dialog = panel() as HTMLElement;
    const title = document.getElementById(
      dialog.getAttribute('aria-labelledby') ?? '',
    );
    const message = document.getElementById(
      dialog.getAttribute('aria-describedby') ?? '',
    );
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(title?.textContent).toBe('Xóa câu hỏi?');
    expect(message?.textContent).toBe('Thao tác không thể hoàn tác.');
  });

  it('uses the primary button by default and the danger button for the danger tone', async () => {
    const first = setup();
    first.open();
    await settle();
    expect(button('Xóa')?.classList).toContain('btn--primary');
    expect(button('Hủy')?.textContent?.trim()).toBe('Hủy');

    TestBed.inject(Dialog).closeAll();
    await settle();

    first.open({ ...OPTIONS, tone: 'danger' });
    await settle();
    expect(button('Xóa')?.classList).toContain('btn--danger');
  });

  it('has no icon beside the title, only the close button', async () => {
    const { open } = setup();
    open({ ...OPTIONS, tone: 'warning' });
    await settle();

    expect(panel()?.querySelector('.dialog__icon')).toBeNull();
    expect(panel()?.querySelectorAll('.dialog__header ui-icon')).toHaveLength(
      1,
    );
  });

  it('uses Vietnamese labels by default', async () => {
    const { open } = setup();
    open({ title: 'Xuất bản?', message: 'Học viên sẽ thấy ngay.' });
    await settle();

    expect(button('Xác nhận')).toBeTruthy();
    expect(button('Hủy')).toBeTruthy();
  });

  it('moves focus into the dialog, traps it and restores it on close', async () => {
    const { open, opener, results } = setup();
    expect(document.activeElement).toBe(opener);
    open();
    await settle();

    const dialog = panel() as HTMLElement;
    await vi.waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );
    // Trap: tab from the last tabbable element wraps inside the dialog.
    const tabbables = Array.from(
      dialog.querySelectorAll<HTMLElement>('button'),
    );
    tabbables.at(-1)?.focus();
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(
      document.querySelectorAll('.cdk-focus-trap-anchor').length,
    ).toBeGreaterThan(0);

    button('Hủy')?.click();
    await vi.waitFor(() => expect(results).toEqual([false]));
    await vi.waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

describe('choose', () => {
  const run = (act: () => void) => {
    const { opener: _opener } = setup();
    const dialog = TestBed.inject(Dialog);
    const results: (boolean | undefined)[] = [];
    choose(dialog, OPTIONS).subscribe((result) => results.push(result));
    return { results, act };
  };

  it('tells the close icon (undefined) from the cancel button (false) and confirm (true)', async () => {
    const closed = run(() => undefined);
    await settle();
    (
      document.querySelector('[aria-label="Đóng hộp thoại"]') as HTMLElement
    ).click();
    await vi.waitFor(() => expect(closed.results).toEqual([undefined]));

    const cancelled = run(() => undefined);
    await settle();
    button('Hủy')?.click();
    await vi.waitFor(() => expect(cancelled.results).toEqual([false]));

    const confirmed = run(() => undefined);
    await settle();
    button('Xóa')?.click();
    await vi.waitFor(() => expect(confirmed.results).toEqual([true]));
  });
});
