import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Menu, type MenuEntry } from './menu';

const ENTRIES: readonly MenuEntry[] = [
  { kind: 'label', label: 'Hành động' },
  { kind: 'item', value: 'edit', label: 'Sửa', icon: 'pen-line' },
  { kind: 'item', value: 'copy', label: 'Sao chép', icon: 'copy' },
  { kind: 'item', value: 'lock', label: 'Khóa', disabled: true },
  { kind: 'separator' },
  {
    kind: 'item',
    value: 'delete',
    label: 'Xóa',
    icon: 'trash-2',
    tone: 'danger',
  },
];

@Component({
  imports: [Menu],
  template: `<ui-menu
    label="Hành động"
    icon="ellipsis"
    [entries]="entries"
    [translucent]="translucent()"
    (selected)="chosen.set($event)"
  />`,
})
class Host {
  readonly entries = ENTRIES;
  readonly translucent = signal(false);
  readonly chosen = signal<string | null>(null);
}

@Component({
  imports: [Menu],
  template: `<ui-menu label="Thao tác hàng" iconOnly [entries]="entries" />`,
})
class IconOnlyHost {
  readonly entries = ENTRIES;
}

async function settle(fixture: { whenStable(): Promise<unknown> }) {
  TestBed.tick();
  await fixture.whenStable();
  TestBed.tick();
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await settle(fixture);
  const trigger = fixture.nativeElement.querySelector(
    'button',
  ) as HTMLButtonElement;
  const menu = () => document.body.querySelector<HTMLElement>('[role="menu"]');
  const items = () =>
    Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
  const key = async (target: HTMLElement, k: string) => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
    );
    await settle(fixture);
  };
  const open = async () => {
    trigger.click();
    await settle(fixture);
  };
  const active = () => document.activeElement as HTMLElement | null;
  return {
    fixture,
    trigger,
    menu,
    items,
    key,
    open,
    active,
    host: fixture.componentInstance,
  };
}

describe('Menu', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.querySelector('.cdk-overlay-container')?.remove();
  });

  it('applies the optional translucent appearance to its trigger and overlay', async () => {
    const { fixture, trigger, host, open, menu } = await render();
    host.translucent.set(true);
    await settle(fixture);
    expect(trigger.classList.contains('menu-trigger--translucent')).toBe(true);
    await open();
    expect(menu()?.classList.contains('menu--translucent')).toBe(true);
  });

  it('is closed until the trigger is activated, and the trigger says it opens a menu', async () => {
    const { trigger, menu } = await render();
    expect(trigger.getAttribute('aria-haspopup')).toBe('true');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.textContent?.trim()).toBe('Hành động');
    expect(menu()).toBeNull();
  });

  it('can be an icon-only trigger named by its label', () => {
    const fixture = TestBed.createComponent(IconOnlyHost);
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;
    expect(trigger.getAttribute('aria-label')).toBe('Thao tác hàng');
    expect(trigger.textContent?.trim()).toBe('');
  });

  it('opens a named menu of items, separators and headings from the trigger', async () => {
    const { trigger, menu, items, open } = await render();
    await open();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(menu()?.getAttribute('aria-label')).toBe('Hành động');
    expect(items().map((i) => i.textContent?.trim())).toEqual([
      'Sửa',
      'Sao chép',
      'Khóa',
      'Xóa',
    ]);
    expect(menu()?.querySelectorAll('[role="separator"]')).toHaveLength(1);
    expect(menu()?.textContent).toContain('Hành động');
  });

  it('marks danger items and disabled items', async () => {
    const { items, open } = await render();
    await open();
    const [first, , lock, remove] = items();
    expect(remove.classList.contains('is-danger')).toBe(true);
    expect(lock.getAttribute('aria-disabled')).toBe('true');
    expect(first.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('moves between items with the arrow keys, Home and End', async () => {
    const { menu, items, open, key, active } = await render();
    await open();
    expect(active()).toBe(items()[0]);
    await key(menu() as HTMLElement, 'ArrowDown');
    expect(active()).toBe(items()[1]);
    await key(menu() as HTMLElement, 'End');
    expect(active()).toBe(items()[3]);
    await key(menu() as HTMLElement, 'Home');
    expect(active()).toBe(items()[0]);
    await key(menu() as HTMLElement, 'ArrowUp');
    expect(active()).toBe(items()[3]);
  });

  it('jumps to the item whose label starts with the typed letters', async () => {
    const { menu, items, open, key, active } = await render();
    await open();
    await key(menu() as HTMLElement, 'x');
    expect(active()).toBe(items()[3]);
  });

  it('emits the value of the chosen item with Enter, closes and gives focus back to the trigger', async () => {
    const { menu, items, open, key, trigger, host, active } = await render();
    await open();
    await key(menu() as HTMLElement, 'ArrowDown');
    await key(items()[1], 'Enter');
    expect(host.chosen()).toBe('copy');
    expect(menu()).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(active()).toBe(trigger);
  });

  it('chooses an item with a click', async () => {
    const { items, open, fixture, host, menu } = await render();
    await open();
    items()[0].click();
    await settle(fixture);
    expect(host.chosen()).toBe('edit');
    expect(menu()).toBeNull();
  });

  it('does not choose a disabled item', async () => {
    const { items, open, fixture, host } = await render();
    await open();
    items()[2].click();
    await settle(fixture);
    expect(host.chosen()).toBeNull();
  });

  it('closes on Escape without choosing and returns focus to the trigger', async () => {
    const { menu, open, key, trigger, host, active } = await render();
    await open();
    await key(menu() as HTMLElement, 'Escape');
    expect(menu()).toBeNull();
    expect(host.chosen()).toBeNull();
    expect(active()).toBe(trigger);
  });
});
