import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Checkbox } from './checkbox.directive';

@Component({
  imports: [Checkbox],
  template: `<label>
    <input
      type="checkbox"
      uiCheckbox
      [checked]="checked()"
      (change)="checked.set($any($event.target).checked)"
    />
    Trộn thứ tự câu hỏi
  </label>`,
})
class Host {
  readonly checked = signal(true);
}

describe('Checkbox', () => {
  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector(
      'input',
    ) as HTMLInputElement;
    return { fixture, input, host: fixture.componentInstance };
  }

  it('is a real checkbox with the check look and no switch role', () => {
    const { input } = render();
    expect(input.type).toBe('checkbox');
    expect(input.classList.contains('check')).toBe(true);
    expect(input.hasAttribute('role')).toBe(false);
    expect(input.checked).toBe(true);
  });

  it('toggles natively, including from its label text', () => {
    const { fixture, input, host } = render();
    (fixture.nativeElement.querySelector('label') as HTMLElement).click();
    expect(input.checked).toBe(false);
    expect(host.checked()).toBe(false);
  });
});
