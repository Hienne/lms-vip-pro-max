import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Mai, type MaiTone } from './mai';

@Component({
  imports: [Mai],
  template: `<ui-mai
    [size]="size()"
    [petal]="petal()"
    [core]="core()"
    [label]="label()"
  />`,
})
class Host {
  readonly size = signal(24);
  readonly petal = signal<MaiTone>('accent');
  readonly core = signal<MaiTone>('primary-strong');
  readonly label = signal('');
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const mai = (fixture.nativeElement as HTMLElement).querySelector(
    'ui-mai',
  ) as HTMLElement;
  return { fixture, mai, host: fixture.componentInstance };
}

describe('Mai', () => {
  it('draws five petals around a core in a 40-unit box', () => {
    const { mai } = render();
    const svg = mai.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 40 40');
    expect(mai.querySelectorAll('.mai__petals circle')).toHaveLength(5);
    expect(mai.querySelectorAll('.mai__core')).toHaveLength(1);
  });

  it.each([16, 40, 360])('renders at %ipx', (size) => {
    const { fixture, mai, host } = render();
    host.size.set(size);
    fixture.detectChanges();
    const svg = mai.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe(String(size));
    expect(svg?.getAttribute('height')).toBe(String(size));
  });

  it('takes its colours from theme tokens, mapped from the inputs', () => {
    const { fixture, mai, host } = render();
    expect(mai.style.getPropertyValue('--mai-petal')).toBe(
      'var(--color-accent)',
    );
    expect(mai.style.getPropertyValue('--mai-core')).toBe(
      'var(--color-primary-strong)',
    );
    host.petal.set('white');
    host.core.set('on-accent');
    fixture.detectChanges();
    expect(mai.style.getPropertyValue('--mai-petal')).toBe(
      'var(--color-white)',
    );
    expect(mai.style.getPropertyValue('--mai-core')).toBe(
      'var(--color-on-accent)',
    );
  });

  it('is decorative unless given a label', () => {
    const { fixture, mai, host } = render();
    expect(mai.getAttribute('aria-hidden')).toBe('true');
    expect(mai.hasAttribute('role')).toBe(false);

    host.label.set('Hoa mai');
    fixture.detectChanges();
    expect(mai.getAttribute('role')).toBe('img');
    expect(mai.getAttribute('aria-label')).toBe('Hoa mai');
    expect(mai.hasAttribute('aria-hidden')).toBe(false);
  });
});
