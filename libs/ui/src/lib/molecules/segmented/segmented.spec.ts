import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Segmented, type SegmentedOption } from './segmented';

type Period = 'week' | 'month' | 'quarter';

const OPTIONS: readonly SegmentedOption<Period>[] = [
  { value: 'week', label: 'Tuần' },
  { value: 'month', label: 'Tháng', icon: 'calendar' },
  { value: 'quarter', label: 'Quý' },
];

@Component({
  imports: [Segmented],
  template: `<ui-segmented
    label="Kỳ"
    [options]="options"
    [(value)]="period"
  />`,
})
class Host {
  readonly options = OPTIONS;
  readonly period = signal<Period>('month');
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const listbox = root.querySelector('[role="listbox"]') as HTMLElement;
  const options = () =>
    Array.from(root.querySelectorAll<HTMLElement>('[role="option"]'));
  return { fixture, root, listbox, options, host: fixture.componentInstance };
}

const selected = (options: HTMLElement[]) =>
  options
    .filter((o) => o.getAttribute('aria-selected') === 'true')
    .map((o) => o.textContent?.trim());

describe('Segmented', () => {
  it('is one single-choice group for assistive technology, named by its label', async () => {
    const { listbox, options } = await render();
    expect(listbox.getAttribute('aria-label')).toBe('Kỳ');
    expect(listbox.getAttribute('aria-multiselectable')).toBe('false');
    expect(options().map((o) => o.textContent?.trim())).toEqual([
      'Tuần',
      'Tháng',
      'Quý',
    ]);
  });

  it('marks the current option as selected', async () => {
    const { options } = await render();
    expect(selected(options())).toEqual(['Tháng']);
  });

  it('shows an option icon when one is given', async () => {
    const { options } = await render();
    expect(options()[1].querySelector('ui-icon')).not.toBeNull();
    expect(options()[0].querySelector('ui-icon')).toBeNull();
  });

  it('selects an option on click and updates the two-way model', async () => {
    const { fixture, options, host } = await render();
    options()[2].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.period()).toBe('quarter');
    expect(selected(options())).toEqual(['Quý']);
  });

  it('follows the model when it changes from outside', async () => {
    const { fixture, options, host } = await render();
    host.period.set('week');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(selected(options())).toEqual(['Tuần']);
  });

  it('moves the selection with the arrow keys', async () => {
    const { fixture, listbox, options, host } = await render();
    options()[1].focus();
    listbox.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.period()).toBe('quarter');
    listbox.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );
    listbox.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.period()).toBe('week');
  });

  it('keeps exactly one option in the tab order', async () => {
    const { options } = await render();
    expect(
      options().filter((o) => o.getAttribute('tabindex') === '0'),
    ).toHaveLength(1);
  });
});
