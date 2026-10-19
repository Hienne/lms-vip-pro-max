import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Popover } from './popover.directive';

@Component({
  imports: [Popover],
  template: `
    @if (shown()) {
      <button
        class="trigger"
        popoverLabel="Tùy chỉnh giao diện"
        [uiPopover]="panel"
      >
        Mở
      </button>
    }
    <ng-template #panel>
      <button class="first">Một</button>
      <button class="second">Hai</button>
    </ng-template>
    <button class="outside">Ngoài</button>
  `,
})
class Host {
  readonly shown = signal(true);
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  document.body.appendChild(fixture.nativeElement);
  const root = fixture.nativeElement as HTMLElement;
  const container = TestBed.inject(OverlayContainer).getContainerElement();
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  await settle();
  return {
    fixture,
    settle,
    trigger: () => root.querySelector<HTMLButtonElement>('.trigger')!,
    outside: root.querySelector<HTMLButtonElement>('.outside')!,
    panel: () => container.querySelector<HTMLElement>('[role="dialog"]'),
  };
}

const press = (el: Element, key: string) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

describe('Popover', () => {
  afterEach(() => {
    TestBed.inject(OverlayContainer).ngOnDestroy();
    document.body.innerHTML = '';
  });

  it('starts closed and announces the dialog it controls', async () => {
    const { trigger, panel } = await render();
    expect(trigger().getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().hasAttribute('aria-controls')).toBe(false);
    expect(panel()).toBeNull();
  });

  it('opens a named dialog with the template on click', async () => {
    const { trigger, panel, settle } = await render();
    trigger().click();
    await settle();
    expect(panel()?.getAttribute('aria-label')).toBe('Tùy chỉnh giao diện');
    expect(panel()?.querySelector('.first')).not.toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().getAttribute('aria-controls')).toBe(panel()?.id);
  });

  it('moves focus into the panel', async () => {
    const { trigger, panel, settle } = await render();
    trigger().click();
    await settle();
    // jsdom has no layout, so the focus trap finds no visible control and the panel takes focus;
    // in a browser it is the first control (checked in the header verify step).
    await vi.waitFor(() =>
      expect(panel()?.contains(document.activeElement)).toBe(true),
    );
  });

  it('closes when the trigger is clicked again', async () => {
    const { trigger, panel, settle } = await render();
    trigger().click();
    await settle();
    trigger().click();
    await settle();
    expect(panel()).toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on Escape and gives focus back to the trigger', async () => {
    const { trigger, panel, settle } = await render();
    trigger().click();
    await settle();
    const inside = panel()!.querySelector<HTMLElement>('.second')!;
    inside.focus();
    press(inside, 'Escape');
    await settle();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes on a click outside and stays open on a click inside', async () => {
    const { trigger, outside, panel, settle } = await render();
    trigger().click();
    await settle();
    panel()!.querySelector<HTMLElement>('.second')!.click();
    await settle();
    expect(panel()).not.toBeNull();

    outside.click();
    await settle();
    expect(panel()).toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('removes the panel when the trigger goes away', async () => {
    const { fixture, trigger, panel, settle } = await render();
    trigger().click();
    await settle();
    fixture.componentInstance.shown.set(false);
    await settle();
    expect(panel()).toBeNull();
  });
});
