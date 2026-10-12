import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Spinner } from './spinner.directive';

@Component({
  imports: [Spinner],
  template: `<span uiSpinner [label]="label()"></span>`,
})
class Host {
  readonly label = signal('Đang tải');
}

describe('Spinner', () => {
  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const spinner = (fixture.nativeElement as HTMLElement).querySelector(
      '.spinner',
    ) as HTMLElement;
    return { fixture, spinner, host: fixture.componentInstance };
  }

  it('is a status with a Vietnamese label by default', () => {
    const { spinner } = render();
    expect(spinner.getAttribute('role')).toBe('status');
    expect(spinner.getAttribute('aria-label')).toBe('Đang tải');
  });

  it('takes another label', () => {
    const { fixture, spinner, host } = render();
    host.label.set('Đang lưu');
    fixture.detectChanges();
    expect(spinner.getAttribute('aria-label')).toBe('Đang lưu');
  });
});
