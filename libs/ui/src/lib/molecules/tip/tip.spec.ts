import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Tip } from './tip';

@Component({
  imports: [Tip],
  template: `<ui-tip>Lưu nháp thường xuyên.</ui-tip
    ><ui-tip label="Gợi ý">Dùng phím Tab.</ui-tip>`,
})
class Host {}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return Array.from(
    fixture.nativeElement.querySelectorAll('ui-tip'),
  ) as HTMLElement[];
}

describe('Tip', () => {
  it('is an inline hint block labelled "Mẹo" by default and never a live region', () => {
    const [first, second] = render();

    expect(first.classList.contains('tip-note')).toBe(true);
    expect(first.querySelector('.tip-note__label')?.textContent).toBe('Mẹo');
    expect(first.textContent).toContain('Lưu nháp thường xuyên.');
    expect(first.hasAttribute('role')).toBe(false);
    expect(second.querySelector('.tip-note__label')?.textContent).toBe('Gợi ý');
  });

  it('is not the tooltip bubble', () => {
    const [tip] = render();
    expect(tip.classList.contains('tip')).toBe(false);
    expect(tip.classList.contains('ui-tooltip')).toBe(false);
  });
});
