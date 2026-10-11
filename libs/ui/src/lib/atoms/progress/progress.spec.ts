import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Progress, type ProgressSize, type ProgressTone } from './progress';

@Component({
  imports: [Progress],
  template: `<ui-progress
    [value]="value()"
    [tone]="tone()"
    [size]="size()"
    [label]="label()"
  />`,
})
class Host {
  readonly value = signal(68);
  readonly tone = signal<ProgressTone | undefined>(undefined);
  readonly size = signal<ProgressSize>('md');
  readonly label = signal('Tiến độ');
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const bar = (fixture.nativeElement as HTMLElement).querySelector(
    'ui-progress',
  ) as HTMLElement;
  return { fixture, bar, host: fixture.componentInstance };
}

describe('Progress', () => {
  it('is a progressbar with its value and range', () => {
    const { bar } = render();
    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('68');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-label')).toBe('Tiến độ');
  });

  it('sets the bar width through a CSS variable, never an inline width', () => {
    const { bar } = render();
    expect(bar.style.getPropertyValue('--value')).toBe('68%');
    expect(
      bar.querySelector<HTMLElement>('.progress__bar')?.getAttribute('style'),
    ).toBeNull();
  });

  it('clamps and rounds the value', () => {
    const { fixture, bar, host } = render();
    host.value.set(140);
    fixture.detectChanges();
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
    expect(bar.style.getPropertyValue('--value')).toBe('100%');
    host.value.set(-5);
    fixture.detectChanges();
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
    host.value.set(33.6);
    fixture.detectChanges();
    expect(bar.getAttribute('aria-valuenow')).toBe('34');
  });

  it('is the primary colour without a tone', () => {
    const { bar } = render();
    expect(bar.className).toBe('progress');
  });

  it.each(['success', 'warning', 'danger', 'reward'] as const)(
    'has the %s tone',
    (tone) => {
      const { fixture, bar, host } = render();
      host.tone.set(tone);
      fixture.detectChanges();
      expect(bar.classList.contains(`progress--${tone}`)).toBe(true);
    },
  );

  it('has a small size and a custom label', () => {
    const { fixture, bar, host } = render();
    host.size.set('sm');
    host.label.set('Tiến độ Tổng quan Core Banking');
    fixture.detectChanges();
    expect(bar.classList.contains('progress--sm')).toBe(true);
    expect(bar.getAttribute('aria-label')).toBe(
      'Tiến độ Tổng quan Core Banking',
    );
  });
});
