import { Dialog } from '@angular/cdk/dialog';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DrawerOutlet } from './drawer.directive';

@Component({
  imports: [DrawerOutlet],
  template: `
    <button id="opener">Mở</button>
    <ng-template
      [uiDrawer]="open()"
      [uiDrawerTitle]="title()"
      [uiDrawerFooter]="footer"
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
  readonly open = signal(false);
  readonly title = signal('Drawer mẫu');
  readonly dismissed = signal(0);
}

function setup() {
  const fixture = TestBed.createComponent(Host);
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

describe('uiDrawer', () => {
  it('opens with its title, body and footer when the condition turns true', async () => {
    const { host } = setup();
    await settle();
    expect(panel()).toBeNull();

    host.open.set(true);
    await settle();

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
    const { host } = setup();
    host.open.set(true);
    await settle();

    host.open.set(false);
    await settle();

    await vi.waitFor(() => expect(panel()).toBeNull());
    expect(host.dismissed()).toBe(0);
  });

  it('reports a dismissal on Escape', async () => {
    const { host } = setup();
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
    const { host } = setup();
    host.open.set(true);
    await settle();

    (document.querySelector('.dialog-backdrop') as HTMLElement).click();

    await vi.waitFor(() => expect(host.dismissed()).toBe(1));
    expect(panel()).toBeNull();
  });

  it('reports a dismissal on the close button', async () => {
    const { host } = setup();
    host.open.set(true);
    await settle();

    (document.querySelector('[aria-label="Đóng"]') as HTMLElement).click();

    await vi.waitFor(() => expect(host.dismissed()).toBe(1));
    expect(panel()).toBeNull();
  });

  it('reports a dismissal on close() from the template context', async () => {
    const { host } = setup();
    host.open.set(true);
    await settle();

    (document.getElementById('inner-close') as HTMLElement).click();

    await vi.waitFor(() => expect(host.dismissed()).toBe(1));
    expect(panel()).toBeNull();
  });

  it('opens again after the state says so once it was dismissed', async () => {
    const { host } = setup();
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
    const { host } = setup();
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
    const { host, opener } = setup();
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
    const { fixture, host } = setup();
    host.open.set(true);
    await settle();
    expect(panel()).not.toBeNull();

    fixture.destroy();

    await vi.waitFor(() => expect(panel()).toBeNull());
    expect(host.dismissed()).toBe(0);
  });
});
