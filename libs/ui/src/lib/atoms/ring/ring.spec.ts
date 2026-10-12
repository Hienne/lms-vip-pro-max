import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Ring } from './ring';

@Component({
  imports: [Ring],
  template: `<ui-ring [value]="value()" [size]="size()" />`,
})
class Host {
  readonly value = signal(68);
  readonly size = signal(96);
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const ring = (fixture.nativeElement as HTMLElement).querySelector(
    'ui-ring',
  ) as HTMLElement;
  return { fixture, ring, host: fixture.componentInstance };
}

describe('Ring', () => {
  it('draws the value as an arc and shows it in the centre', () => {
    const { ring } = render();
    const bar = ring.querySelector('.progress-ring__bar') as SVGCircleElement;
    const radius = (96 - 9) / 2;
    const circumference = 2 * Math.PI * radius;
    expect(Number(bar.getAttribute('stroke-dasharray'))).toBeCloseTo(
      circumference,
      5,
    );
    expect(Number(bar.getAttribute('stroke-dashoffset'))).toBeCloseTo(
      circumference * 0.32,
      5,
    );
    expect(
      ring.querySelector('.progress-ring__value')?.textContent?.trim(),
    ).toBe('68%');
    expect(ring.textContent).toContain('hoàn thành');
  });

  it('makes the value readable by assistive technology', () => {
    const { ring } = render();
    expect(ring.getAttribute('role')).toBe('img');
    expect(ring.getAttribute('aria-label')).toBe('68% hoàn thành');
  });

  it('scales with its size, the label through a CSS variable', () => {
    const { fixture, ring, host } = render();
    host.size.set(64);
    fixture.detectChanges();
    expect(ring.querySelector('svg')?.getAttribute('width')).toBe('64');
    expect(ring.style.getPropertyValue('--ring-size')).toBe('64px');
  });

  it('follows the value and clamps it', () => {
    const { fixture, ring, host } = render();
    host.value.set(0);
    fixture.detectChanges();
    expect(ring.getAttribute('aria-label')).toBe('0% hoàn thành');
    host.value.set(250);
    fixture.detectChanges();
    expect(ring.getAttribute('aria-label')).toBe('Hoàn thành 100%');
  });

  it('blossoms into the hoa mai at 100%', () => {
    const { fixture, ring, host } = render();
    host.value.set(100);
    fixture.detectChanges();
    expect(ring.querySelector('ui-mai')).not.toBeNull();
    expect(ring.querySelector('.progress-ring__bar')).toBeNull();
    expect(ring.classList.contains('animate-reward-pop')).toBe(true);
    expect(ring.getAttribute('aria-label')).toBe('Hoàn thành 100%');
  });
});
