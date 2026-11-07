import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Icon, type IconSize } from './icon';
import {
  ICON_CATALOG,
  ICONS,
  registeredIcon,
  type IconName,
} from './icon-registry';

@Component({
  imports: [Icon],
  template: `<ui-icon [name]="name()" [size]="size()" [label]="label()" />`,
})
class Host {
  readonly name = signal<IconName>('house');
  readonly size = signal<IconSize>('md');
  readonly label = signal('');
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const icon = (fixture.nativeElement as HTMLElement).querySelector(
    'ui-icon',
  ) as HTMLElement;
  return { fixture, icon, host: fixture.componentInstance };
}

describe('Icon', () => {
  it('renders the registered Lucide icon with the mockup stroke width', () => {
    const { icon } = render();
    const svg = icon.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.querySelectorAll('path, circle, rect').length).toBeGreaterThan(
      0,
    );
    expect(svg?.getAttribute('stroke-width')).toBe('1.75');
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
  });

  it('switches the drawing when the name changes', () => {
    const { fixture, icon, host } = render();
    const before = icon.querySelector('svg')?.innerHTML;
    host.name.set('trophy');
    fixture.detectChanges();
    expect(icon.querySelector('svg')?.innerHTML).not.toBe(before);
  });

  describe('accessibility', () => {
    it('is decorative by default: hidden from assistive technology', () => {
      const { icon } = render();
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.hasAttribute('role')).toBe(false);
      expect(icon.hasAttribute('aria-label')).toBe(false);
    });

    it('becomes a labelled image when given a label', () => {
      const { fixture, icon, host } = render();
      host.label.set('Đã hoàn thành');
      fixture.detectChanges();
      expect(icon.getAttribute('role')).toBe('img');
      expect(icon.getAttribute('aria-label')).toBe('Đã hoàn thành');
      expect(icon.hasAttribute('aria-hidden')).toBe(false);
    });
  });

  describe('sizes', () => {
    it('is the default size without a modifier class', () => {
      const { icon } = render();
      expect(icon.classList.contains('icon')).toBe(true);
      expect(icon.className).not.toContain('icon--');
    });

    it.each(['sm', 'lg', 'xl'] as const)('adds icon--%s', (size) => {
      const { fixture, icon, host } = render();
      host.size.set(size);
      fixture.detectChanges();
      expect(icon.classList.contains(`icon--${size}`)).toBe(true);
    });
  });
});

describe('icon registry', () => {
  it('registers every mockup icon, plus the ones the app added', () => {
    expect(ICON_CATALOG.filter((icon) => icon.mockup)).toHaveLength(89);
    expect(
      ICON_CATALOG.filter((icon) => !icon.mockup).map((i) => i.name),
    ).toEqual([
      'monitor',
      'arrow-up',
      'square',
      'panel-right-open',
      'panel-right-close',
      'alarm-clock-check',
      'route',
    ]);
    for (const { name } of ICON_CATALOG) {
      expect(ICONS[name]).toBeDefined();
    }
  });

  it('has no mockup name twice', () => {
    const names = ICON_CATALOG.map((icon) => icon.mockup).filter(Boolean);
    expect(new Set(names).size).toBe(names.length);
  });

  it('rejects an unregistered name at type-check time', () => {
    // @ts-expect-error not a registered icon
    const unknown: IconName = 'not-an-icon';
    expect(unknown).toBe('not-an-icon');
  });
});

describe('registeredIcon', () => {
  it('keeps a registered name and falls back for one the app does not bundle', () => {
    expect(registeredIcon('flame', 'award')).toBe('flame');
    expect(registeredIcon('skateboard', 'award')).toBe('award');
    expect(registeredIcon('toString', 'award')).toBe('award');
  });
});
