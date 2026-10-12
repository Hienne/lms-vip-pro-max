import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Tabs, TabPanel, type TabItem } from './tabs';

const ITEMS: readonly TabItem[] = [
  { id: 'overview', label: 'Tổng quan', icon: 'book-open' },
  { id: 'courses', label: 'Khóa học', count: 6 },
  { id: 'exams', label: 'Bài thi' },
];

@Component({
  imports: [Tabs, TabPanel],
  template: `<ui-tabs label="Mục" [tabs]="items" [(selected)]="selected">
    <div uiTabPanel="overview">Nội dung tổng quan</div>
    <div uiTabPanel="courses">Nội dung khóa học</div>
    <div uiTabPanel="exams">Nội dung bài thi</div>
  </ui-tabs>`,
})
class Host {
  readonly items = ITEMS;
  readonly selected = signal('overview');
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const tabs = () =>
    Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'));
  const panels = () =>
    Array.from(root.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const press = async (key: string) => {
    root
      .querySelector('[role="tablist"]')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    await settle();
  };
  return {
    fixture,
    root,
    tabs,
    panels,
    press,
    settle,
    host: fixture.componentInstance,
  };
}

const visible = (panels: HTMLElement[]) =>
  panels
    .filter((p) => !p.hasAttribute('inert'))
    .map((p) => p.textContent?.trim());

describe('Tabs', () => {
  it('is a named tab list with one tab per item', async () => {
    const { root, tabs } = await render();
    expect(
      root.querySelector('[role="tablist"]')?.getAttribute('aria-label'),
    ).toBe('Mục');
    expect(tabs().map((t) => t.textContent?.trim())).toEqual([
      'Tổng quan',
      'Khóa học 6',
      'Bài thi',
    ]);
  });

  it('includes the count in the accessible name and shows an optional icon', async () => {
    const { tabs } = await render();
    expect(tabs()[1].querySelector('.tabs__count')?.textContent).toBe('6');
    expect(tabs()[0].querySelector('ui-icon')).not.toBeNull();
    expect(tabs()[2].querySelector('ui-icon')).toBeNull();
  });

  it('marks the selected tab and shows only its panel, which it controls', async () => {
    const { tabs, panels } = await render();
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(visible(panels())).toEqual(['Nội dung tổng quan']);
    const controlled = panels().find(
      (p) => p.id === tabs()[0].getAttribute('aria-controls'),
    );
    expect(controlled?.textContent?.trim()).toBe('Nội dung tổng quan');
  });

  it('selects on click and reports it through selectedChange', async () => {
    const { tabs, panels, settle, host } = await render();
    tabs()[1].click();
    await settle();
    expect(host.selected()).toBe('courses');
    expect(visible(panels())).toEqual(['Nội dung khóa học']);
  });

  it('follows the selected input from outside', async () => {
    const { tabs, settle, host } = await render();
    host.selected.set('exams');
    await settle();
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual([
      'false',
      'false',
      'true',
    ]);
  });

  it('keeps one tab in the tab order and moves with arrows, Home and End', async () => {
    const { tabs, press, host } = await render();
    expect(
      tabs().filter((t) => t.getAttribute('tabindex') === '0'),
    ).toHaveLength(1);
    tabs()[0].focus();
    await press('ArrowRight');
    expect(host.selected()).toBe('courses');
    await press('End');
    expect(host.selected()).toBe('exams');
    await press('Home');
    expect(host.selected()).toBe('overview');
    await press('ArrowLeft');
    expect(host.selected()).toBe('exams');
  });
});
