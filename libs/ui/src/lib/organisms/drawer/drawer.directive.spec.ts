import { Dialog } from '@angular/cdk/dialog';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DrawerOutlet } from './drawer.directive';
import type { DrawerSize } from './drawer';

@Component({
  imports: [DrawerOutlet],
  template: `
    <button id="opener">Mở</button>
    <ng-template
      [uiDrawer]="open()"
      [uiDrawerTitle]="title()"
      [uiDrawerVariant]="variant()"
      [uiDrawerSize]="size()"
      [uiDrawerFooter]="footer"
      [uiDrawerBusy]="busy()"
      [uiDrawerGuard]="guard()"
      (uiDrawerCloseRequest)="requested.set(requested() + 1)"
      uiDrawerBusyLabel="Đang lưu…"
      (uiDrawerDismiss)="dismissed.set(dismissed() + 1)"
      let-close="close"
    >
      <p id="content">Nội dung drawer</p>
      <button id="inner-close" (click)="close()">Đóng từ nội dung</button>
    </ng-template>
    <ng-template #footer><button id="save">Lưu</button></ng-template>
  `,
})
class Host {
  readonly variant = signal<'drawer' | 'dialog'>('drawer');
  readonly size = signal<DrawerSize>('md');
  readonly open = signal(false);
  readonly title = signal('Drawer mẫu');
  readonly busy = signal(false);
  readonly dismissed = signal(0);
  readonly guard = signal(false);
  readonly requested = signal(0);
}

function setup(variant: 'drawer' | 'dialog' = 'drawer') {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.variant.set(variant);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  const opener = fixture.nativeElement.querySelector(
    '#opener',
  ) as HTMLButtonElement;
  opener.focus();
  return { fixture, host: fixture.componentInstance, opener };
}

async function settle() {
  TestBed.tick();
  await Promise.resolve();
  TestBed.tick();
}

const panel = () => document.querySelector<HTMLElement>('[role="dialog"]');

afterEach(() => {
  TestBed.inject(Dialog).closeAll();
  document.querySelector('.cdk-overlay-container')?.remove();
  document.body.replaceChildren();
});

describe.each(['drawer', 'dialog'] as const)('uiDrawer (%s)', (variant) => {
  it('opens with its title, body and footer when the condition turns true', async () => {
    const { host } = setup(variant);
    await settle();
    expect(panel()).toBeNull();

    host.open.set(true);
    await settle();

    expect(document.querySelector(`.drawer-pane--${variant}`)).not.toBeNull();
    const drawer = panel() as HTMLElement;
    const heading = document.getElementById(
      drawer.getAttribute('aria-labelledby') ?? '',
    );
    expect(heading?.textContent).toBe('Drawer mẫu');
    expect(drawer.querySelector('#content')?.textContent).toBe(
      'Nội dung drawer',
    );
    expect(drawer.querySelector('#save')).not.toBeNull();
  });

  it('closes without a dismissal when the condition turns false', async () => {
    const { host } = setup(variant);
    host.open.set(true);
    await settle();

    host.open.set(false);
    await settle();

    await vi.waitFor(() => expect(panel()).toBeNull());
    expect(host.dismissed()).toBe(0);
  });

  it('reports a dismissal on Escape', async () => {
    const { host } = setup(variant);
    host.open.set(true);
    await settle();

    panel()?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        bubbles: true,
      }),
    );

    await vi.waitFor(() => expect(host.dismissed()).toBe(1));
    expect(panel()).toBeNull();
  });

  it('reports a dismissal on a backdrop click', async () => {
    const { host } = setup(variant);
    host.open.set(true);
    await settle();

    (document.querySelector('.dialog-backdrop') as HTMLElement).click();

    await vi.waitFor(() => expect(host.dismissed()).toBe(1));
    expect(panel()).toBeNull();
  });

  it('reports a dismissal on the close button', async () => {
    const { host } = setup(variant);
    host.open.set(true);
    await settle();

    (document.querySelector('[aria-label="Đóng"]') as HTMLElement).click();

    await vi.waitFor(() => expect(host.dismissed()).toBe(1));
    expect(panel()).toBeNull();
  });

  it('reports a dismissal on close() from the template context', async () => {
    const { host } = setup(variant);
    host.open.set(true);
    await settle();

    (document.getElementById('inner-close') as HTMLElement).click();

    await vi.waitFor(() => expect(host.dismissed()).toBe(1));
    expect(panel()).toBeNull();
  });

  it('opens again after the state says so once it was dismissed', async () => {
    const { host } = setup(variant);
    host.open.set(true);
    await settle();
    (document.querySelector('[aria-label="Đóng"]') as HTMLElement).click();
    await vi.waitFor(() => expect(panel()).toBeNull());

    host.open.set(false);
    await settle();
    host.open.set(true);
    await settle();

    expect(panel()).not.toBeNull();
  });

  it('updates the title of an open drawer', async () => {
    const { host } = setup(variant);
    host.open.set(true);
    await settle();

    host.title.set('Tiêu đề mới');
    await settle();

    const drawer = panel() as HTMLElement;
    expect(
      document.getElementById(drawer.getAttribute('aria-labelledby') ?? '')
        ?.textContent,
    ).toBe('Tiêu đề mới');
  });

  it('gives focus back to the opener', async () => {
    const { host, opener } = setup(variant);
    host.open.set(true);
    await settle();
    await vi.waitFor(() =>
      expect(panel()?.contains(document.activeElement)).toBe(true),
    );

    host.open.set(false);
    await settle();

    await vi.waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('closes the drawer, without a dismissal, when its host is destroyed', async () => {
    const { fixture, host } = setup(variant);
    host.open.set(true);
    await settle();
    expect(panel()).not.toBeNull();

    fixture.destroy();

    await vi.waitFor(() => expect(panel()).toBeNull());
    expect(host.dismissed()).toBe(0);
  });

  it('fills the screen less a margin when its size is full', async () => {
    const { host } = setup(variant);
    host.size.set('full');
    host.open.set(true);
    await settle();

    expect(document.querySelector('.drawer-pane--full')).not.toBeNull();
  });

  describe('while guarded', () => {
    const key = (name: string) =>
      panel()?.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: name,
          code: name,
          keyCode: name === 'Escape' ? 27 : 0,
          bubbles: true,
        }),
      );

    it('asks the page instead of closing on Escape, the backdrop and the close button', async () => {
      const { host } = setup(variant);
      host.guard.set(true);
      host.open.set(true);
      await settle();

      key('Escape');
      await settle();
      document.querySelector<HTMLElement>('.dialog-backdrop')?.click();
      await settle();
      document.querySelector<HTMLElement>('[aria-label="Đóng"]')?.click();
      await settle();
      document.querySelector<HTMLElement>('#inner-close')?.click();
      await settle();

      expect(host.requested()).toBe(4);
      expect(host.dismissed()).toBe(0);
      expect(panel()).not.toBeNull();
    });

    it('closes again as soon as the guard is lifted', async () => {
      const { host } = setup(variant);
      host.guard.set(true);
      host.open.set(true);
      await settle();
      host.guard.set(false);
      await settle();

      document.querySelector<HTMLElement>('[aria-label="Đóng"]')?.click();
      await settle();

      expect(host.requested()).toBe(0);
      expect(host.dismissed()).toBe(1);
      expect(panel()).toBeNull();
    });
  });

  describe('while busy', () => {
    const escape = () =>
      panel()?.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          bubbles: true,
        }),
      );

    async function openBusy() {
      const ctx = setup(variant);
      ctx.host.open.set(true);
      await settle();
      ctx.host.busy.set(true);
      await settle();
      return ctx;
    }

    it('shows the overlay with its label and marks the panel busy', async () => {
      await openBusy();

      const busy = document.querySelector('.drawer__busy');
      expect(busy?.textContent).toContain('Đang lưu…');
      expect(busy?.getAttribute('role')).toBe('status');
      expect(document.querySelector('.drawer')?.getAttribute('aria-busy')).toBe(
        'true',
      );
    });

    it('ignores Escape and a backdrop click', async () => {
      const { host } = await openBusy();

      escape();
      (document.querySelector('.dialog-backdrop') as HTMLElement).click();
      await settle();

      expect(panel()).not.toBeNull();
      expect(host.dismissed()).toBe(0);
    });

    it('disables the close button and ignores close() from the template', async () => {
      const { host } = await openBusy();

      const button = document.querySelector<HTMLButtonElement>(
        '[aria-label="Đóng"]',
      ) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      button.click();
      (document.getElementById('inner-close') as HTMLElement).click();
      await settle();

      expect(panel()).not.toBeNull();
      expect(host.dismissed()).toBe(0);
    });

    it('still closes when the condition turns false', async () => {
      const { host } = await openBusy();

      host.open.set(false);
      await settle();

      await vi.waitFor(() => expect(panel()).toBeNull());
      expect(host.dismissed()).toBe(0);
    });

    it('accepts closing again, and drops the overlay, when busy ends', async () => {
      const { host } = await openBusy();

      host.busy.set(false);
      await settle();
      expect(document.querySelector('.drawer__busy')).toBeNull();
      expect(
        document.querySelector('.drawer')?.getAttribute('aria-busy'),
      ).toBeNull();

      escape();
      await vi.waitFor(() => expect(host.dismissed()).toBe(1));
      expect(panel()).toBeNull();
    });
  });
});
