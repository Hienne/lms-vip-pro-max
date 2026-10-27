import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwatchGroup, type SwatchOption } from './swatch-group';

type Tint = 'teal' | 'indigo' | 'sand';

const OPTIONS: readonly SwatchOption<Tint>[] = [
  { value: 'teal', label: 'Xanh', swatch: { fill: 'primary', base: 'bg' } },
  {
    value: 'indigo',
    label: 'Chàm',
    swatch: { fill: 'info', base: 'info-subtle' },
  },
  {
    value: 'sand',
    label: 'Cát',
    swatch: { fill: 'warning', base: 'warning-subtle' },
  },
];

@Component({
  imports: [SwatchGroup],
  template: `<ui-swatch-group
    label="Bảng màu"
    [options]="options"
    [(value)]="tint"
  />`,
})
class Host {
  readonly options = OPTIONS;
  readonly tint = signal<Tint>('indigo');
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const listbox = root.querySelector('[role="listbox"]') as HTMLElement;
  const options = () =>
    Array.from(root.querySelectorAll<HTMLElement>('[role="option"]'));
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { root, listbox, options, settle, host: fixture.componentInstance };
}

const selected = (options: HTMLElement[]) =>
  options
    .filter((o) => o.getAttribute('aria-selected') === 'true')
    .map((o) => o.textContent?.trim());

const key = (name: string) =>
  new KeyboardEvent('keydown', { key: name, bubbles: true });

describe('SwatchGroup', () => {
  it('is one vertical single-choice group, named by its label', async () => {
    const { listbox, options } = await render();
    expect(listbox.getAttribute('aria-label')).toBe('Bảng màu');
    expect(listbox.getAttribute('aria-orientation')).toBe('vertical');
    expect(listbox.getAttribute('aria-multiselectable')).toBe('false');
    expect(options().map((o) => o.textContent?.trim())).toEqual([
      'Xanh',
      'Chàm',
      'Cát',
    ]);
  });

  it('marks the current option as selected', async () => {
    const { options } = await render();
    expect(selected(options())).toEqual(['Chàm']);
  });

  it('paints each swatch from colour tokens, hidden from assistive technology', async () => {
    const { options } = await render();
    const swatch = options()[1].querySelector<HTMLElement>(
      '.swatch-group__swatch',
    )!;
    expect(swatch.getAttribute('aria-hidden')).toBe('true');
    expect(swatch.style.getPropertyValue('--swatch-fill')).toBe(
      'var(--color-info)',
    );
    expect(swatch.style.getPropertyValue('--swatch-base')).toBe(
      'var(--color-info-subtle)',
    );
  });

  it('selects an option on click and updates the two-way model', async () => {
    const { options, settle, host } = await render();
    options()[2].click();
    await settle();
    expect(host.tint()).toBe('sand');
    expect(selected(options())).toEqual(['Cát']);
  });

  it('follows the model when it changes from outside', async () => {
    const { options, settle, host } = await render();
    host.tint.set('teal');
    await settle();
    expect(selected(options())).toEqual(['Xanh']);
  });

  it('moves the selection with the up and down arrow keys', async () => {
    const { listbox, options, settle, host } = await render();
    options()[1].focus();
    listbox.dispatchEvent(key('ArrowDown'));
    await settle();
    expect(host.tint()).toBe('sand');
    listbox.dispatchEvent(key('ArrowUp'));
    listbox.dispatchEvent(key('ArrowUp'));
    await settle();
    expect(host.tint()).toBe('teal');
  });

  it('keeps exactly one option in the tab order', async () => {
    const { options } = await render();
    expect(
      options().filter((o) => o.getAttribute('tabindex') === '0'),
    ).toHaveLength(1);
  });
});
