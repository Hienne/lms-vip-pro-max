import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import { Component, viewChild, type TemplateRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type Drawer,
  openDrawer,
  type DrawerContext,
  type DrawerSide,
} from './drawer';

@Component({
  template: `
    <button id="opener">Mở</button>
    <ng-template #body><p id="content">Nội dung drawer</p></ng-template>
    <ng-template #footer><button id="save">Lưu</button></ng-template>
  `,
})
class Host {
  readonly body = viewChild.required<TemplateRef<DrawerContext>>('body');
  readonly footer = viewChild.required<TemplateRef<DrawerContext>>('footer');
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  const opener = fixture.nativeElement.querySelector(
    '#opener',
  ) as HTMLButtonElement;
  opener.focus();
  const dialog = TestBed.inject(Dialog);
  const host = fixture.componentInstance;
  const open = (
    side?: DrawerSide,
    withFooter = false,
  ): DialogRef<void, Drawer> =>
    openDrawer(dialog, host.body(), {
      title: 'Drawer mẫu',
      side,
      footer: withFooter ? host.footer() : undefined,
    });
  return { opener, open };
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

describe('openDrawer', () => {
  it('shows the title as the dialog name, the body and the optional footer', async () => {
    const { open } = setup();
    open('end', true);
    await settle();

    const drawer = panel() as HTMLElement;
    const title = document.getElementById(
      drawer.getAttribute('aria-labelledby') ?? '',
    );
    expect(drawer.getAttribute('aria-modal')).toBe('true');
    expect(title?.textContent).toBe('Drawer mẫu');
    expect(drawer.querySelector('#content')?.textContent).toBe(
      'Nội dung drawer',
    );
    expect(drawer.querySelector('#save')).not.toBeNull();
  });

  it('has no footer unless one is given', async () => {
    const { open } = setup();
    open();
    await settle();

    expect(document.querySelector('.drawer__footer')).toBeNull();
  });

  it('opens at the end by default and at the start on request', async () => {
    const { open } = setup();
    const ref = open();
    await settle();
    expect(document.querySelector('.drawer-pane--end')).not.toBeNull();
    ref.close();
    await vi.waitFor(() => expect(panel()).toBeNull());

    open('start');
    await settle();
    expect(document.querySelector('.drawer-pane--start')).not.toBeNull();
  });

  it('closes with the close button and restores focus', async () => {
    const { open, opener } = setup();
    open();
    await settle();

    (document.querySelector('[aria-label="Đóng"]') as HTMLElement).click();

    await vi.waitFor(() => expect(panel()).toBeNull());
    await vi.waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('closes on Escape', async () => {
    const { open } = setup();
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

    await vi.waitFor(() => expect(panel()).toBeNull());
  });

  it('closes on a backdrop click', async () => {
    const { open } = setup();
    open();
    await settle();

    (document.querySelector('.dialog-backdrop') as HTMLElement).click();

    await vi.waitFor(() => expect(panel()).toBeNull());
  });

  it('traps focus inside the drawer', async () => {
    const { open } = setup();
    open();
    await settle();

    expect(
      document.querySelectorAll('.cdk-focus-trap-anchor').length,
    ).toBeGreaterThan(0);
    const drawer = panel() as HTMLElement;
    await vi.waitFor(() =>
      expect(drawer.contains(document.activeElement)).toBe(true),
    );
  });
});
