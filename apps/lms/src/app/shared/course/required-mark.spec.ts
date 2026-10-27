import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RequiredMark } from './required-mark';

@Component({
  imports: [RequiredMark],
  template: `<app-required-mark [required]="required()" />`,
})
class Host {
  readonly required = signal(true);
}

describe('RequiredMark', () => {
  it('shows a neutral "Bắt buộc" badge for a required course', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const badge = (fixture.nativeElement as HTMLElement).querySelector(
      '.badge',
    );
    expect(badge?.textContent?.trim()).toBe('Bắt buộc');
    // The neutral tone adds no modifier class.
    expect(badge?.className).not.toMatch(/badge--/);
  });

  it('shows an outline "Tự chọn" badge for an optional one', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.required.set(false);
    fixture.detectChanges();
    const badge = (fixture.nativeElement as HTMLElement).querySelector(
      '.badge',
    );
    expect(badge?.textContent?.trim()).toBe('Tự chọn');
    expect(badge?.classList.contains('badge--outline')).toBe(true);
  });
});
