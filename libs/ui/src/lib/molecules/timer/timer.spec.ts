import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Timer } from './timer';

@Component({
  imports: [Timer],
  template: `<ui-timer [seconds]="seconds()" [lowAt]="60" />`,
})
class Host {
  readonly seconds = signal(768);
}

function render(seconds = 768) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.seconds.set(seconds);
  fixture.detectChanges();
  const el = (fixture.nativeElement as HTMLElement).querySelector(
    'ui-timer',
  ) as HTMLElement;
  return { fixture, el, host: fixture.componentInstance };
}

const text = (el: Element | null) =>
  el?.textContent?.replace(/\s+/g, ' ').trim();

describe('Timer', () => {
  it.each([
    [768, '12:48'],
    [45, '00:45'],
    [0, '00:00'],
    [5, '00:05'],
    [3600, '60:00'],
    [-3, '00:00'],
    [59.6, '01:00'],
  ])('shows %f seconds as %s', (seconds, expected) => {
    expect(text(render(seconds).el.querySelector('.timer__time'))).toBe(
      expected,
    );
  });

  it('is a timer that does not announce every tick', () => {
    const { el } = render();
    expect(el.getAttribute('role')).toBe('timer');
    expect(el.getAttribute('aria-live')).toBe('off');
  });

  it('follows the remaining seconds the caller passes in', () => {
    const { fixture, el, host } = render();
    host.seconds.set(700);
    fixture.detectChanges();
    expect(text(el.querySelector('.timer__time'))).toBe('11:40');
  });

  it('is calm above the threshold', () => {
    const { el } = render(61);
    expect(el.classList.contains('is-low')).toBe(false);
    expect(el.querySelector('.sr-only')).toBeNull();
  });

  it('turns low at the threshold with a different icon and a spoken label, not colour alone', () => {
    const calm = render(61).el.querySelector('ui-icon svg')?.innerHTML;
    const { el } = render(60);
    expect(el.classList.contains('is-low')).toBe(true);
    expect(el.querySelector('ui-icon svg')?.innerHTML).not.toBe(calm);
    expect(text(el.querySelector('.sr-only'))).toBe('Sắp hết giờ');
  });
});
