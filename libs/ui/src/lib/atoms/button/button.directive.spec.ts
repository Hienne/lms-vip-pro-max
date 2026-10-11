import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Icon } from '../icon/icon';
import {
  Button,
  type ButtonSize,
  type ButtonVariant,
} from './button.directive';

@Component({
  imports: [Button, Icon],
  template: `
    <button
      uiButton
      [variant]="variant()"
      [size]="size()"
      [block]="block()"
      [busy]="busy()"
      [disabled]="disabled()"
      (click)="clicks.set(clicks() + 1)"
    >
      <ui-icon name="play" size="sm" /> Bắt đầu học
    </button>
    <a
      uiButton
      id="link"
      href="/catalog"
      [disabled]="linkDisabled()"
      (click)="linkClicks.set(linkClicks() + 1)"
      >Mở danh mục</a
    >
    <form (submit)="$event.preventDefault(); submits.set(submits() + 1)">
      <button uiButton id="plain">Mặc định</button>
      <button uiButton id="submit" type="submit">Lưu</button>
    </form>
  `,
})
class Host {
  readonly variant = signal<ButtonVariant>('secondary');
  readonly size = signal<ButtonSize>('md');
  readonly block = signal(false);
  readonly busy = signal(false);
  readonly disabled = signal(false);
  readonly linkDisabled = signal(false);
  readonly clicks = signal(0);
  readonly linkClicks = signal(0);
  readonly submits = signal(0);
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const button = root.querySelector('button[uiButton]') as HTMLButtonElement;
  const link = root.querySelector('#link') as HTMLAnchorElement;
  return { fixture, root, button, link, host: fixture.componentInstance };
}

describe('Button', () => {
  it('is a native button with the base class and the secondary look by default', () => {
    const { button } = render();
    expect(button.tagName).toBe('BUTTON');
    expect(button.classList.contains('btn')).toBe(true);
    expect(button.classList.contains('btn--secondary')).toBe(true);
    expect(button.className).not.toMatch(/btn--(sm|lg|block)/);
  });

  it.each([
    'primary',
    'secondary',
    'ghost',
    'danger',
    'danger-ghost',
    'on-dark',
  ] as const)('applies the %s variant', (variant) => {
    const { fixture, button, host } = render();
    host.variant.set(variant);
    fixture.detectChanges();
    expect(button.classList.contains(`btn--${variant}`)).toBe(true);
    expect(button.className.match(/btn--(?!sm|lg|block)[a-z-]+/g)).toEqual([
      `btn--${variant}`,
    ]);
  });

  it.each(['sm', 'lg'] as const)('applies the %s size', (size) => {
    const { fixture, button, host } = render();
    host.size.set(size);
    fixture.detectChanges();
    expect(button.classList.contains(`btn--${size}`)).toBe(true);
  });

  it('is full width with the block flag', () => {
    const { fixture, button, host } = render();
    host.block.set(true);
    fixture.detectChanges();
    expect(button.classList.contains('btn--block')).toBe(true);
  });

  it('keeps icon and text where the markup puts them', () => {
    const { button } = render();
    expect(button.firstElementChild?.tagName).toBe('UI-ICON');
    expect(button.textContent).toContain('Bắt đầu học');
  });

  describe('type', () => {
    it('defaults to button so it never submits a form by accident', () => {
      const { root } = render();
      expect(root.querySelector('#plain')?.getAttribute('type')).toBe('button');
      expect(root.querySelector('#submit')?.getAttribute('type')).toBe(
        'submit',
      );
    });

    it('does not submit the form unless it is a submit button', () => {
      const { fixture, root, host } = render();
      (root.querySelector('#plain') as HTMLElement).click();
      expect(host.submits()).toBe(0);
      (root.querySelector('#submit') as HTMLElement).click();
      fixture.detectChanges();
      expect(host.submits()).toBe(1);
    });

    it('sets no type on a link', () => {
      const { link } = render();
      expect(link.hasAttribute('type')).toBe(false);
    });
  });

  describe('busy', () => {
    it('shows the busy state: aria-busy, spinner class, still focusable', () => {
      const { fixture, button, host } = render();
      host.busy.set(true);
      fixture.detectChanges();
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.hasAttribute('aria-disabled')).toBe(false);
      expect(button.classList.contains('is-loading')).toBe(true);
      expect(button.hasAttribute('disabled')).toBe(false);
    });

    it('blocks activation', () => {
      const { fixture, button, host } = render();
      host.busy.set(true);
      fixture.detectChanges();
      button.click();
      expect(host.clicks()).toBe(0);
      host.busy.set(false);
      fixture.detectChanges();
      button.click();
      expect(host.clicks()).toBe(1);
      expect(button.hasAttribute('aria-busy')).toBe(false);
    });
  });

  describe('disabled', () => {
    it('is the native disabled attribute on a button', () => {
      const { fixture, button, host } = render();
      host.disabled.set(true);
      fixture.detectChanges();
      expect(button.disabled).toBe(true);
      button.click();
      expect(host.clicks()).toBe(0);
    });

    it('is announced on a link and blocks navigation', () => {
      const { fixture, link, host } = render();
      host.linkDisabled.set(true);
      fixture.detectChanges();
      expect(link.getAttribute('aria-disabled')).toBe('true');
      expect(link.getAttribute('tabindex')).toBe('-1');
      const click = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      link.dispatchEvent(click);
      expect(click.defaultPrevented).toBe(true);
      expect(host.linkClicks()).toBe(0);
    });

    it('leaves an enabled link alone', () => {
      const { link, host } = render();
      expect(link.hasAttribute('aria-disabled')).toBe(false);
      expect(link.hasAttribute('tabindex')).toBe(false);
      expect(link.getAttribute('href')).toBe('/catalog');
      link.addEventListener('click', (e) => e.preventDefault());
      link.click();
      expect(host.linkClicks()).toBe(1);
    });
  });
});
