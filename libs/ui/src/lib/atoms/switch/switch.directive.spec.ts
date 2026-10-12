import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Switch } from './switch.directive';

@Component({
  imports: [Switch],
  template: `<label
    ><input type="checkbox" uiSwitch checked /> Nhắc học trước hạn</label
  >`,
})
class Host {}

describe('Switch', () => {
  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector(
      'input',
    ) as HTMLInputElement;
  }

  it('exposes switch semantics while staying a native checkbox', () => {
    const input = render();
    expect(input.type).toBe('checkbox');
    expect(input.getAttribute('role')).toBe('switch');
    expect(input.classList.contains('switch')).toBe(true);
    expect(input.classList.contains('check')).toBe(false);
  });

  it('toggles natively and reports its state', () => {
    const input = render();
    expect(input.checked).toBe(true);
    input.click();
    expect(input.checked).toBe(false);
  });
});
