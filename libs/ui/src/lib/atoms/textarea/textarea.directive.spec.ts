import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Textarea } from './textarea.directive';

@Component({
  imports: [Textarea],
  template: `<textarea uiTextarea rows="2" readonly aria-invalid="true">
Ghi chú</textarea
  >`,
})
class Host {}

describe('Textarea', () => {
  it('is a native textarea with its own attributes and states', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const area = (fixture.nativeElement as HTMLElement).querySelector(
      'textarea',
    ) as HTMLTextAreaElement;
    expect(area.classList.contains('textarea')).toBe(true);
    expect(area.rows).toBe(2);
    expect(area.readOnly).toBe(true);
    expect(area.value).toBe('Ghi chú');
    expect(area.getAttribute('aria-invalid')).toBe('true');
  });
});
