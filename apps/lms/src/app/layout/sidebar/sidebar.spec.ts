import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Tooltip } from '@lms/ui';
import { parseAppConfig, provideAppConfig } from '../../core/config/app-config';
import { testAppConfig } from '../../core/config/app-config.testing';
import type { MenuItem, NavSection } from '../../core/menu/menu-catalog';
import { Sidebar } from './sidebar';

const item = (code: string, label: string, upcoming: boolean): MenuItem =>
  ({
    code,
    href: `/${code.toLowerCase()}`,
    icon: 'book-open',
    label,
    section: 'Học tập',
    upcoming,
  }) as MenuItem;

const NAV: readonly NavSection[] = [
  {
    section: 'Học tập',
    items: [
      item('COURSES', 'Khóa học', false),
      item('KB', 'Kho tri thức', true),
    ],
  },
];

function render(options: { devTools?: boolean; collapsed?: boolean }) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideAppConfig(
        parseAppConfig(testAppConfig({ devTools: options.devTools ?? true })),
      ),
    ],
  });
  const fixture = TestBed.createComponent(Sidebar);
  fixture.componentRef.setInput('nav', NAV);
  fixture.componentRef.setInput('roleText', 'Học viên');
  fixture.componentRef.setInput('collapsible', true);
  fixture.componentRef.setInput('collapsed', options.collapsed ?? false);
  fixture.detectChanges();
  return fixture;
}

const links = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('.sidebar__link'));

describe('Sidebar', () => {
  it('marks an upcoming entry with muted text after its label and nothing else', () => {
    const el: HTMLElement = render({}).nativeElement;
    const [built, upcoming] = links(el);

    expect(built.querySelector('.sidebar__soon')).toBeNull();
    const soon = upcoming.querySelector('.sidebar__soon');
    expect(soon?.textContent?.trim()).toBe('Sắp ra mắt');
    expect(upcoming.querySelector('.sidebar__label')?.textContent).toContain(
      'Kho tri thức',
    );
    expect(upcoming.getAttribute('href')).toBe('/kb');
  });

  it('names the state in the tooltip of the icon rail', () => {
    const fixture = render({ collapsed: true });
    const text = fixture.debugElement
      .queryAll(By.css('.sidebar__link'))
      .map((link) => link.injector.get(Tooltip).text());

    expect(text).toEqual([
      'Khóa học',
      'Kho tri thức · Sắp ra mắt',
      'Giờ ra chơi',
    ]);
  });

  it('shows the design-system link only with dev tools', () => {
    expect(
      render({ devTools: true }).nativeElement.querySelector(
        '.sidebar__design-link',
      ),
    ).not.toBeNull();
    TestBed.resetTestingModule();
    const el: HTMLElement = render({ devTools: false }).nativeElement;
    expect(el.querySelector('.sidebar__design-link')).toBeNull();
    expect(el.querySelector('.sidebar__toggle')).not.toBeNull();
  });

  it('puts the active entertainment link in Community without a grant or dev tools', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideAppConfig(parseAppConfig(testAppConfig({ devTools: false }))),
      ],
    });
    const fixture = TestBed.createComponent(Sidebar);
    fixture.componentRef.setInput('nav', NAV);
    fixture.componentRef.setInput('roleText', 'Học viên');
    fixture.componentRef.setInput('activePath', '/chat-room');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const link = el.querySelector(
      'ul[aria-label="Cộng đồng"] a[href="/chat-room"]',
    );
    expect(link?.textContent?.trim()).toBe('Giờ ra chơi');
    expect(link?.getAttribute('aria-current')).toBe('page');
    expect(el.querySelector('.sidebar__footer')).toBeNull();
  });
});
