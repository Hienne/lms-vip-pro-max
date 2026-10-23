import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Icon } from '../icon/icon';
import { Badge, type BadgeTone } from './badge.directive';

@Component({
  imports: [Badge, Icon],
  template: `<span uiBadge [tone]="tone()" [dot]="dot()" [outline]="outline()">
    <ui-icon name="check" />Đã hoàn thành
  </span>`,
})
class Host {
  readonly tone = signal<BadgeTone>('neutral');
  readonly dot = signal(false);
  readonly outline = signal(false);
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const badge = (fixture.nativeElement as HTMLElement).querySelector(
    'span',
  ) as HTMLElement;
  return { fixture, badge, host: fixture.componentInstance };
}

describe('Badge', () => {
  it('is the neutral badge by default', () => {
    const { badge } = render();
    expect(badge.className).toBe('badge');
  });

  it.each([
    'primary',
    'success',
    'warning',
    'danger',
    'info',
    'reward',
  ] as const)('applies the %s tone', (tone) => {
    const { fixture, badge, host } = render();
    host.tone.set(tone);
    fixture.detectChanges();
    expect(badge.classList.contains(`badge--${tone}`)).toBe(true);
  });

  it('adds a dot and an outline on request', () => {
    const { fixture, badge, host } = render();
    host.dot.set(true);
    host.outline.set(true);
    fixture.detectChanges();
    expect(badge.classList.contains('badge--dot')).toBe(true);
    expect(badge.classList.contains('badge--outline')).toBe(true);
  });

  it('keeps its text and icon, so meaning does not rely on colour', () => {
    const { badge } = render();
    expect(badge.textContent).toContain('Đã hoàn thành');
    expect(badge.querySelector('ui-icon')).not.toBeNull();
  });
});

@Component({
  imports: [Badge],
  template: `<button uiBadge type="button" (click)="clicks = clicks + 1">
    1
  </button>`,
})
class ButtonHost {
  clicks = 0;
}

describe('Badge on a button', () => {
  it('keeps the native button, so it is focusable and clickable', () => {
    const fixture = TestBed.createComponent(ButtonHost);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    ) as HTMLButtonElement;
    expect(button.className).toBe('badge');
    button.focus();
    expect(document.activeElement).toBe(button);
    button.click();
    expect(fixture.componentInstance.clicks).toBe(1);
  });
});
