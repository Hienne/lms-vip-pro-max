import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, vi } from 'vitest';
import { Tooltip } from './tooltip.directive';

@Component({
  imports: [Tooltip],
  template: `<button [uiTooltip]="text()">Trigger</button>`,
})
class Host {
  readonly text = signal('Xóa khóa học');
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const trigger = (fixture.nativeElement as HTMLElement).querySelector(
    'button',
  ) as HTMLButtonElement;
  const container = TestBed.inject(OverlayContainer).getContainerElement();
  const bubble = () => container.querySelector('[role="tooltip"]');
  const settle = (ms = 400) => {
    vi.advanceTimersByTime(ms);
    fixture.detectChanges();
  };
  return { fixture, trigger, bubble, settle, host: fixture.componentInstance };
}

const press = (el: Element, key: string) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

describe('Tooltip', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  it('shows the text after a short delay on hover and hides on leave', () => {
    const { trigger, bubble, settle } = render();
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    settle(50);
    expect(bubble()).toBeNull();
    settle();
    expect(bubble()?.textContent?.trim()).toBe('Xóa khóa học');
    trigger.dispatchEvent(new MouseEvent('mouseleave'));
    settle(0);
    expect(bubble()).toBeNull();
  });

  it('shows on keyboard focus and hides on blur', () => {
    const { trigger, bubble, settle } = render();
    trigger.dispatchEvent(new FocusEvent('focus'));
    settle();
    expect(bubble()).not.toBeNull();
    trigger.dispatchEvent(new FocusEvent('blur'));
    settle(0);
    expect(bubble()).toBeNull();
  });

  it('hides on Escape, even while the pointer is still over the trigger', () => {
    const { trigger, bubble, settle } = render();
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    settle();
    press(document.body, 'Escape');
    settle(0);
    expect(bubble()).toBeNull();
  });

  it('cancels a pending show when Escape is pressed on the trigger during the delay', () => {
    const { trigger, bubble, settle } = render();
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    settle(100);
    press(trigger, 'Escape');
    settle();
    expect(bubble()).toBeNull();
  });

  it('never shows if the pointer leaves before the delay ends', () => {
    const { trigger, bubble, settle } = render();
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    settle(100);
    trigger.dispatchEvent(new MouseEvent('mouseleave'));
    settle();
    expect(bubble()).toBeNull();
  });

  it('links the trigger to the tooltip with aria-describedby only while visible', () => {
    const { trigger, bubble, settle } = render();
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    settle();
    const id = trigger.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    expect(bubble()?.id).toBe(id);
    trigger.dispatchEvent(new MouseEvent('mouseleave'));
    settle(0);
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);
  });

  it('follows the text while visible', () => {
    const { fixture, trigger, bubble, settle, host } = render();
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    settle();
    host.text.set('Sửa khóa học');
    fixture.detectChanges();
    settle(0);
    expect(bubble()?.textContent?.trim()).toBe('Sửa khóa học');
  });

  it('does not show an empty tooltip', () => {
    const { fixture, trigger, bubble, settle, host } = render();
    host.text.set('');
    fixture.detectChanges();
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    settle();
    expect(bubble()).toBeNull();
  });

  it('removes the tooltip when the trigger is destroyed', () => {
    const { fixture, trigger, bubble, settle } = render();
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    settle();
    fixture.destroy();
    expect(bubble()).toBeNull();
  });
});
