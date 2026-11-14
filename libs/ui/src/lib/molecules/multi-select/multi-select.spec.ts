import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MultiSelect } from './multi-select';

@Component({
  imports: [MultiSelect],
  template: `<ui-multi-select
    label="Đơn vị"
    [options]="options"
    [(value)]="selected"
    [limit]="3"
  />`,
})
class Host {
  readonly selected = signal<readonly string[]>(['1']);
  readonly options = [
    { value: '1', label: 'Đơn vị sở hữu', disabled: true },
    { value: '2', label: 'Hà Nội' },
    { value: '3', label: 'Đà Nẵng' },
    { value: '4', label: 'Hồ Chí Minh' },
  ];
}

describe('MultiSelect', () => {
  afterEach(() =>
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((container) => container.remove()),
  );

  it('selects several items in place, keeps locked choices and enforces the limit', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    )!;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const boxes = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        '.multi-select__option input',
      ),
    );
    expect(boxes[0].checked).toBe(true);
    expect(boxes[0].disabled).toBe(true);
    boxes[1].click();
    boxes[2].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toEqual(['1', '2', '3']);
    expect(boxes[3].disabled).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    boxes[1].click();
    fixture.detectChanges();
    expect(boxes[3].disabled).toBe(false);
    const panel = document.querySelector('.multi-select__panel')!;
    panel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('.multi-select__panel')).toBeNull();
  });

  it('filters options without removing selections outside the search', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const search = document.querySelector<HTMLInputElement>(
      '.multi-select__panel input[type=search]',
    )!;
    search.value = 'hà nội';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    const boxes = document.querySelectorAll<HTMLInputElement>(
      '.multi-select__option input',
    );
    expect(boxes).toHaveLength(1);
    boxes[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toEqual(['1', '2']);
  });
});
