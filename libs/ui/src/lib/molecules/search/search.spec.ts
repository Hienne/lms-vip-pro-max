import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Search } from './search';

@Component({
  imports: [Search],
  template: `<ui-search
    label="Tìm khóa học"
    [debounce]="300"
    [placeholder]="placeholder()"
    (searched)="queries.push($event)"
  />`,
})
class Host {
  readonly placeholder = signal('Tên, mã…');
  readonly queries: string[] = [];
}

@Component({ imports: [Search], template: `<ui-search />` })
class DefaultsHost {}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const input = root.querySelector('input') as HTMLInputElement;
  const type = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const press = (key: string) =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  return { fixture, root, input, type, press, host: fixture.componentInstance };
}

describe('Search', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is a native search input named by its label, with a decorative icon', () => {
    const { root, input } = render();
    expect(input.type).toBe('search');
    expect(input.getAttribute('aria-label')).toBe('Tìm khóa học');
    expect(root.querySelector('.input-icon ui-icon')).not.toBeNull();
    expect(root.querySelector('ui-icon')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('defaults the name and placeholder to the mockup copy and takes an override', () => {
    const fixture = TestBed.createComponent(DefaultsHost);
    fixture.detectChanges();
    const defaults = fixture.nativeElement.querySelector('input');
    expect(defaults.placeholder).toBe('Tìm kiếm…');
    expect(defaults.getAttribute('aria-label')).toBe('Tìm kiếm');
    expect(render().input.placeholder).toBe('Tên, mã…');
  });

  it('emits once per pause while typing', () => {
    const { type, host } = render();
    type('c');
    vi.advanceTimersByTime(200);
    type('co');
    vi.advanceTimersByTime(200);
    type('cor');
    expect(host.queries).toEqual([]);
    vi.advanceTimersByTime(300);
    expect(host.queries).toEqual(['cor']);
  });

  it('emits immediately on Enter and does not repeat it after the pause', () => {
    const { type, press, host } = render();
    type('core');
    press('Enter');
    expect(host.queries).toEqual(['core']);
    vi.advanceTimersByTime(1000);
    expect(host.queries).toEqual(['core']);
  });

  it('emits immediately when the value is cleared', () => {
    const { type, host } = render();
    type('core');
    type('');
    expect(host.queries).toEqual(['']);
    vi.advanceTimersByTime(1000);
    expect(host.queries).toEqual(['']);
  });

  it('drops a pending emit when destroyed', () => {
    const { fixture, type, host } = render();
    type('core');
    fixture.destroy();
    vi.advanceTimersByTime(1000);
    expect(host.queries).toEqual([]);
  });
});
