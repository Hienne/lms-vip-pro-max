import { OverlayContainer } from '@angular/cdk/overlay';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Citation } from '@lms/contracts';
import { SourceBadge } from './source-badge';

const docx: Citation = {
  n: 2,
  documentId: 9,
  fileName: 'Quy-dinh-ECR.docx',
  page: null,
  lineStart: 4,
  lineEnd: 6,
  snippet: 'Thay đổi khẩn cấp phải có phê duyệt của Trưởng ban.',
};

@Component({
  imports: [SourceBadge],
  template: `<app-source-badge [citation]="citation" />`,
})
class Host {
  readonly citation = docx;
}

describe('SourceBadge', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const badge = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    ) as HTMLButtonElement;
    const tooltip = () =>
      TestBed.inject(OverlayContainer)
        .getContainerElement()
        .querySelector('[role="tooltip"]');
    const settle = (ms = 400) => {
      vi.advanceTimersByTime(ms);
      fixture.detectChanges();
    };
    return { badge, tooltip, settle };
  }

  it('is a focusable button showing the number, named in full', () => {
    const { badge } = render();
    expect(badge.type).toBe('button');
    expect(badge.textContent?.trim()).toBe('2');
    expect(badge.getAttribute('aria-label')).toBe(
      'Nguồn 2: Quy-dinh-ECR.docx, đoạn 4–6',
    );
    badge.focus();
    expect(document.activeElement).toBe(badge);
  });

  it('shows the file, the place and the passage on keyboard focus', () => {
    const { badge, tooltip, settle } = render();
    badge.dispatchEvent(new FocusEvent('focus'));
    settle();
    const tip = tooltip() as HTMLElement;
    expect(tip.querySelector('.source__file')?.textContent).toBe(
      'Quy-dinh-ECR.docx',
    );
    expect(tip.querySelector('.source__where')?.textContent).toBe('đoạn 4–6');
    expect(tip.querySelector('.source__quote')?.textContent).toBe(docx.snippet);
    expect(badge.getAttribute('aria-describedby')).toBe(tip.id);
  });

  it('shows on hover and hides with Escape', () => {
    const { badge, tooltip, settle } = render();
    badge.dispatchEvent(new MouseEvent('mouseenter'));
    settle();
    expect(tooltip()).not.toBeNull();
    badge.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    settle(0);
    expect(tooltip()).toBeNull();
  });

  it('toggles on a tap, for touch screens', () => {
    const { badge, tooltip, settle } = render();
    badge.click();
    settle(0);
    expect(tooltip()?.textContent).toContain(docx.snippet);
    badge.click();
    settle(0);
    expect(tooltip()).toBeNull();
  });
});
