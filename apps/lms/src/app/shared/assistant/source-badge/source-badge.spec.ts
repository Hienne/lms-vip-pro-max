import { OverlayContainer } from '@angular/cdk/overlay';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Citation } from '@lms/contracts';
import { SourceViewerStore } from '../../../core/assistant/source-viewer.store';
import { SourceBadge } from './source-badge';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../core/http/http.testing';

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
  citation: Citation = docx;
}

describe('SourceBadge', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
      ],
    }),
  );
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

  it('shows the section path above the place, and no line for a chunk without one', async () => {
    const { badge, panel, settle } = await render();
    badge.click();
    await settle();
    expect(panel()?.querySelector('.source__section')).toBeNull();
    badge.click();
    await settle();

    const withSection = TestBed.createComponent(Host);
    withSection.componentInstance.citation = {
      ...docx,
      sectionPath: 'Quy định ECR › Phê duyệt',
      snippet: 'Phê duyệt của Trưởng ban.',
    };
    document.body.appendChild(withSection.nativeElement);
    withSection.detectChanges();
    await withSection.whenStable();
    (withSection.nativeElement as HTMLElement).querySelector('button')?.click();
    withSection.detectChanges();
    await withSection.whenStable();
    const dialog = panel() as HTMLElement;
    expect(dialog.querySelector('.source__section')?.textContent).toBe(
      'Quy định ECR › Phê duyệt',
    );
    expect(dialog.querySelector('.source__quote')?.textContent).toBe(
      'Phê duyệt của Trưởng ban.',
    );
    const order = [...dialog.querySelectorAll('p')].map((p) => p.className);
    expect(order).toEqual([
      'source__file',
      'source__section',
      'source__where',
      'source__quote',
    ]);
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

  it('offers "Xem trong tài liệu" for a document source, which opens the viewer and closes the popover', async () => {
    const { badge, panel, settle } = await render();
    const open = vi
      .spyOn(TestBed.inject(SourceViewerStore), 'open')
      .mockImplementation(() => undefined);
    badge.click();
    await settle();
    const view = [...(panel()?.querySelectorAll('button') ?? [])].find((b) =>
      b.textContent?.includes('Xem trong tài liệu'),
    );
    view?.click();
    await settle();

    expect(open).toHaveBeenCalledWith(docx);
    expect(panel()).toBeNull();
  });
});
