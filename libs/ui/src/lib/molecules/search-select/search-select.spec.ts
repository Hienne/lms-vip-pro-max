import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SearchSelect } from './search-select';

@Component({
  imports: [SearchSelect],
  template: `<ui-search-select
    label="Bài giảng"
    [options]="options"
    [(value)]="selected"
  />`,
})
class Host {
  readonly selected = signal('1');
  readonly options = [
    { value: '1', label: 'Thanh toán quốc tế' },
    { value: '2', label: 'Đào tạo tín dụng' },
    { value: '3', label: 'Không được chọn', disabled: true },
  ];
}

describe('SearchSelect', () => {
  afterEach(() =>
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove()),
  );

  it('searches Vietnamese text inside the popup without losing the current selection, then selects and closes', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    )!;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const search = document.querySelector<HTMLInputElement>(
      '.search-select__panel input',
    )!;
    search.value = 'dao tao tin dung';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(document.querySelectorAll('.search-select__option')).toHaveLength(1);
    expect(fixture.componentInstance.selected()).toBe('1');
    expect(trigger.textContent).toContain('Thanh toán quốc tế');
    (document.querySelector('.search-select__option') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toBe('2');
    expect(trigger.textContent).toContain('Đào tạo tín dụng');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('moves from search to keyboard choices and closes with Escape without changing the value', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    )!;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const search = document.querySelector<HTMLInputElement>(
      '.search-select__panel input',
    )!;
    search.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    fixture.detectChanges();
    expect(document.activeElement?.getAttribute('role')).toBe('listbox');
    search.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe('1');
    expect(document.querySelector('.search-select__panel')).toBeNull();
  });
});
