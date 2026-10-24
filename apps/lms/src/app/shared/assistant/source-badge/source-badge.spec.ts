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
  afterEach(() => {
    TestBed.inject(OverlayContainer).ngOnDestroy();
    document.body.innerHTML = '';
  });

  async function render() {
    const fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement);
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    await settle();
    const badge = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    ) as HTMLButtonElement;
    const panel = () =>
      TestBed.inject(OverlayContainer)
        .getContainerElement()
        .querySelector<HTMLElement>('[role="dialog"]');
    return { badge, panel, settle };
  }

  it('is a focusable button showing the number, named in full', async () => {
    const { badge } = await render();
    expect(badge.type).toBe('button');
    expect(badge.textContent?.trim()).toBe('2');
    expect(badge.getAttribute('aria-label')).toBe(
      'Nguồn 2: Quy-dinh-ECR.docx, đoạn 4–6',
    );
    expect(badge.getAttribute('aria-haspopup')).toBe('dialog');
    expect(badge.getAttribute('aria-expanded')).toBe('false');
    badge.focus();
    expect(document.activeElement).toBe(badge);
  });

  it('opens a popover with the file, the place and the passage', async () => {
    const { badge, panel, settle } = await render();
    badge.click();
    await settle();
    const dialog = panel() as HTMLElement;
    expect(dialog.getAttribute('aria-label')).toBe(
      'Nguồn 2: Quy-dinh-ECR.docx, đoạn 4–6',
    );
    expect(dialog.querySelector('.source__file')?.textContent).toBe(
      'Quy-dinh-ECR.docx',
    );
    expect(dialog.querySelector('.source__where')?.textContent).toBe(
      'đoạn 4–6',
    );
    expect(dialog.querySelector('.source__quote')?.textContent).toBe(
      docx.snippet,
    );
    expect(badge.getAttribute('aria-expanded')).toBe('true');
    expect(badge.getAttribute('aria-controls')).toBe(dialog.id);
  });

  it('closes with Escape and gives focus back to the badge', async () => {
    const { badge, panel, settle } = await render();
    badge.focus();
    badge.click();
    await settle();
    await vi.waitFor(() => expect(document.activeElement).toBe(panel()));
    panel()?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await settle();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(badge);
  });

  it('closes on a second click, for touch screens', async () => {
    const { badge, panel, settle } = await render();
    badge.click();
    await settle();
    expect(panel()).not.toBeNull();
    badge.click();
    await settle();
    expect(panel()).toBeNull();
  });
});
