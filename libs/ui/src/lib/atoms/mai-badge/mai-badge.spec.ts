import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MaiBadge } from './mai-badge';

@Component({
  imports: [MaiBadge],
  template: `<ui-mai-badge
    name="Khởi đầu suôn sẻ"
    description="Hoàn thành khóa đầu tiên"
    [earned]="earned()"
  />`,
})
class Host {
  readonly earned = signal(true);
}

function render(earned: boolean) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.earned.set(earned);
  fixture.detectChanges();
  const badge = (fixture.nativeElement as HTMLElement).querySelector(
    'ui-mai-badge',
  ) as HTMLElement;
  return { fixture, badge };
}

describe('MaiBadge', () => {
  it('shows an earned badge with its description and a reward animation', () => {
    const { badge } = render(true);
    const plate = badge.querySelector('.mai-badge');
    expect(plate?.classList.contains('is-locked')).toBe(false);
    expect(plate?.classList.contains('animate-reward-pop')).toBe(true);
    expect(badge.textContent).toContain('Khởi đầu suôn sẻ');
    expect(badge.textContent).toContain('Hoàn thành khóa đầu tiên');
    expect(badge.textContent).not.toContain('Chưa mở khóa');
    expect(badge.querySelector('.sr-only')?.textContent).toContain(
      'Đã mở khóa',
    );
  });

  it('says "Chưa mở khóa" in text for a locked badge, not by colour alone', () => {
    const { badge } = render(false);
    const plate = badge.querySelector('.mai-badge');
    expect(plate?.classList.contains('is-locked')).toBe(true);
    expect(plate?.classList.contains('animate-reward-pop')).toBe(false);
    expect(badge.textContent).toContain(
      'Chưa mở khóa · Hoàn thành khóa đầu tiên',
    );
  });

  it('exposes the description as a tooltip and keeps the flower decorative', () => {
    const { badge } = render(true);
    expect(badge.getAttribute('title')).toBe('Hoàn thành khóa đầu tiên');
    expect(badge.querySelector('ui-mai')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('switches state when `earned` changes', () => {
    const { fixture, badge } = render(false);
    fixture.componentInstance.earned.set(true);
    fixture.detectChanges();
    expect(
      badge.querySelector('.mai-badge')?.classList.contains('is-locked'),
    ).toBe(false);
  });
});
