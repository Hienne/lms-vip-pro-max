import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ControlSize } from '../control-size';
import { Select } from './select.directive';

@Component({
  imports: [Select],
  template: `<select
    uiSelect
    [size]="size()"
    [disabled]="disabled()"
    [attr.aria-invalid]="'true'"
  >
    <option value="">— Chọn —</option>
    <option value="1">Nền tảng nghiệp vụ Core Banking</option>
  </select>`,
})
class Host {
  readonly size = signal<ControlSize>('md');
  readonly disabled = signal(false);
}

describe('Select', () => {
  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const select = (fixture.nativeElement as HTMLElement).querySelector(
      'select',
    ) as HTMLSelectElement;
    return { fixture, select, host: fixture.componentInstance };
  }

  it('is a native select with its options', () => {
    const { select } = render();
    expect(select.classList.contains('select')).toBe(true);
    expect(select.options).toHaveLength(2);
    select.value = '1';
    expect(select.selectedOptions[0].textContent).toContain('Nền tảng');
  });

  it('has a small size and a native disabled state', () => {
    const { fixture, select, host } = render();
    host.size.set('sm');
    host.disabled.set(true);
    fixture.detectChanges();
    expect(select.classList.contains('select--sm')).toBe(true);
    expect(select.disabled).toBe(true);
  });

  it('keeps aria-invalid for the invalid styling', () => {
    const { select } = render();
    expect(select.getAttribute('aria-invalid')).toBe('true');
  });
});
