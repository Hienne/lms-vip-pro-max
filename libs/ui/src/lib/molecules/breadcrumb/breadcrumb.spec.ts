import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Breadcrumb, type BreadcrumbItem } from './breadcrumb';

@Component({
  imports: [Breadcrumb],
  template: `<ui-breadcrumb [items]="items()" [label]="label()" />`,
})
class Host {
  readonly items = signal<readonly BreadcrumbItem[]>([
    { label: 'Khóa học', href: '/courses' },
    { label: 'Nền tảng nghiệp vụ', href: '/courses/foundation' },
    { label: 'Tổng quan Core Banking' },
  ]);
  readonly label = signal('Đường dẫn');
}

async function render() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  return {
    host: fixture.componentInstance,
    root,
    nav: () => root.querySelector('nav') as HTMLElement,
    settle: async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    },
  };
}

describe('Breadcrumb', () => {
  it('is a navigation landmark with an ordered list of the trail', async () => {
    const { nav } = await render();
    expect(nav().getAttribute('aria-label')).toBe('Đường dẫn');
    const names = Array.from(nav().querySelectorAll('ol > li')).map((li) =>
      li.querySelector('a, [aria-current]')?.textContent?.trim(),
    );
    expect(names).toEqual([
      'Khóa học',
      'Nền tảng nghiệp vụ',
      'Tổng quan Core Banking',
    ]);
  });

  it('links every item but the last, and marks the last as the current page', async () => {
    const { nav } = await render();
    const hrefs = Array.from(nav().querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toEqual(['/courses', '/courses/foundation']);
    const current = nav().querySelector('[aria-current="page"]') as HTMLElement;
    expect(current.textContent?.trim()).toBe('Tổng quan Core Banking');
    expect(current.tagName).not.toBe('A');
  });

  it('never links the last item, even with an href', async () => {
    const { host, nav, settle } = await render();
    host.items.set([
      { label: 'A', href: '/a' },
      { label: 'B', href: '/b' },
    ]);
    await settle();
    expect(nav().querySelectorAll('a')).toHaveLength(1);
    expect(nav().querySelector('[aria-current="page"]')?.textContent).toBe('B');
  });

  it('hides the separators from assistive technology', async () => {
    const { nav } = await render();
    const separators = Array.from(
      nav().querySelectorAll('li > span.breadcrumb__sep'),
    );
    expect(separators).toHaveLength(2);
    for (const sep of separators) {
      expect(sep.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('takes its accessible name from the label input', async () => {
    const { host, nav, settle } = await render();
    host.label.set('Vị trí hiện tại');
    await settle();
    expect(nav().getAttribute('aria-label')).toBe('Vị trí hiện tại');
  });
});
