import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Icon } from '../icon/icon';
import { IconButton } from './icon-button.directive';

@Component({
  imports: [IconButton, Icon],
  template: `<button
    uiIconButton
    [label]="label()"
    [variant]="variant()"
    [size]="size()"
    [dot]="dot()"
  >
    <ui-icon name="bell" />
  </button>`,
})
class Host {
  readonly label = signal('Thông báo');
  readonly variant = signal<'default' | 'danger'>('default');
  readonly size = signal<'md' | 'sm'>('md');
  readonly dot = signal(false);
}

@Component({
  imports: [IconButton],
  // Templates are not type-checked in tests; ngtsc rejects this one at build time (NG8008).
  template: `<button uiIconButton>x</button>`,
})
class Unlabelled {}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const button = (fixture.nativeElement as HTMLElement).querySelector(
    'button',
  ) as HTMLButtonElement;
  return { fixture, button, host: fixture.componentInstance };
}

describe('IconButton', () => {
  it('uses the label as its accessible name, with no native title', () => {
    const { button } = render();
    expect(button.getAttribute('aria-label')).toBe('Thông báo');
    expect(button.hasAttribute('title')).toBe(false);
  });

  it('shows the label as a tooltip on hover', () => {
    vi.useFakeTimers();
    try {
      const { fixture, button } = render();
      button.dispatchEvent(new MouseEvent('mouseenter'));
      vi.advanceTimersByTime(400);
      fixture.detectChanges();
      const bubble = TestBed.inject(OverlayContainer)
        .getContainerElement()
        .querySelector('[role="tooltip"]');
      expect(bubble?.textContent?.trim()).toBe('Thông báo');
      expect(button.getAttribute('aria-describedby')).toBe(bubble?.id);
    } finally {
      vi.useRealTimers();
      TestBed.inject(OverlayContainer).ngOnDestroy();
    }
  });

  it('follows the label when it changes', () => {
    const { fixture, button, host } = render();
    host.label.set('Sửa khóa học');
    fixture.detectChanges();
    expect(button.getAttribute('aria-label')).toBe('Sửa khóa học');
  });

  it('cannot be used without a label', () => {
    const fixture = TestBed.createComponent(Unlabelled);
    expect(() => fixture.detectChanges()).toThrow(/required/i);
  });

  it('is a native button of type button', () => {
    const { button } = render();
    expect(button.tagName).toBe('BUTTON');
    expect(button.type).toBe('button');
    expect(button.classList.contains('icon-btn')).toBe(true);
  });

  it('adds modifiers for the danger variant, the small size and the unread dot', () => {
    const { fixture, button, host } = render();
    expect(button.className).not.toContain('icon-btn--');
    host.variant.set('danger');
    host.size.set('sm');
    host.dot.set(true);
    fixture.detectChanges();
    expect(button.classList.contains('icon-btn--danger')).toBe(true);
    expect(button.classList.contains('icon-btn--sm')).toBe(true);
    expect(button.classList.contains('icon-btn--dot')).toBe(true);
  });
});
