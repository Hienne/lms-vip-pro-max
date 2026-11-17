import { HttpTestingController } from '@angular/common/http/testing';
import { Component, ErrorHandler } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { Citation, DocumentText } from '@lms/contracts';
import {
  backendRefusal,
  envelopeOk,
  knowledgeAnswerFixture,
  knowledgeDocumentTextFixtures,
} from '@lms/mocks';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { SourceViewerStore } from '../../../core/assistant/source-viewer.store';
import { provideEnvelopeHttpClient } from '../../../core/http/http.testing';
import { SourceViewer } from './source-viewer';

const TEXT = '/api/v1/knowledge/documents/1/text';
const cited = knowledgeAnswerFixture.citations[0] as Citation;
const chunks = knowledgeDocumentTextFixtures[1];

function text(from: number, to: number): DocumentText {
  return {
    documentId: 1,
    fileName: 'Quy-trinh-EOD.pdf',
    aroundChunkId: 11,
    chunks: chunks.slice(from, to + 1),
    hasMoreBefore: from > 0,
    hasMoreAfter: to < chunks.length - 1,
  };
}

@Component({
  selector: 'app-host',
  imports: [SourceViewer],
  template: `<button type="button" id="source">Nguồn 1</button>
    <app-source-viewer />`,
})
class Host {}

describe('SourceViewer', () => {
  let backend: HttpTestingController;
  let store: SourceViewerStore;
  let fixture: ComponentFixture<Host>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        { provide: ErrorHandler, useValue: { handleError: () => undefined } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SourceViewerStore);
    fixture = TestBed.createComponent(Host);
  });

  afterEach(() => {
    store.close();
    TestBed.tick();
    backend.verify();
  });

  const panel = () => document.querySelector('ui-drawer');
  const body = () => panel()?.textContent ?? '';

  async function openWith(data: DocumentText): Promise<void> {
    const trigger = fixture.nativeElement.querySelector(
      '#source',
    ) as HTMLButtonElement;
    trigger.focus();
    store.open(cited);
    await fixture.whenStable();
    backend.expectOne((r) => r.url === TEXT).flush(envelopeOk(data));
    await fixture.whenStable();
    TestBed.tick();
  }

  it('opens a panel with the document title, the text and the cited passage highlighted', async () => {
    await openWith(text(0, 3));

    expect(panel()?.getAttribute('class')).toContain('drawer');
    expect(document.querySelector('.drawer__title')?.textContent).toBe(
      'Quy-trinh-EOD.pdf',
    );
    expect(body()).toContain('Quy trình EOD áp dụng cho mọi phân hệ');
    expect(body()).toContain('Quy trình EOD › Đóng sổ');
    expect(body()).toContain('trang 1 · dòng 3–9');
    const marked = panel()?.querySelectorAll('[aria-current="true"]');
    expect(marked).toHaveLength(1);
    expect(marked?.[0].textContent).toContain('đối chiếu số dư sổ cái');
  });

  it('"Xem thêm" loads more neighbours', async () => {
    await openWith(text(1, 2));
    const more = [...(panel()?.querySelectorAll('button') ?? [])].filter((b) =>
      b.textContent?.includes('Xem thêm'),
    );
    expect(more).toHaveLength(2);

    more[1].click();
    await fixture.whenStable();
    const request = backend.expectOne((r) => r.url === TEXT);
    expect(request.request.params.get('span')).toBe('5');
    request.flush(envelopeOk(text(0, 4)));
    await fixture.whenStable();
    TestBed.tick();

    expect(panel()?.querySelectorAll('.chunk')).toHaveLength(5);
    expect(
      [...(panel()?.querySelectorAll('button') ?? [])].some((b) =>
        b.textContent?.includes('Xem thêm'),
      ),
    ).toBe(false);
  });

  it('says so when the document was deleted', async () => {
    store.open(cited);
    await fixture.whenStable();
    const refusal = backendRefusal('resourceNotFound');
    backend
      .expectOne((r) => r.url === TEXT)
      .flush(refusal.body, { status: refusal.status, statusText: 'OK' });
    await fixture.whenStable();
    TestBed.tick();

    expect(body()).toContain('Tài liệu này đã bị xoá');
    expect(panel()?.querySelectorAll('.chunk')).toHaveLength(0);
  });

  it('closes on Escape and gives focus back to the source', async () => {
    await openWith(text(0, 3));

    panel()?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        bubbles: true,
      }),
    );

    await vi.waitFor(() => expect(store.status$()).toBe('closed'));
    expect(panel()).toBeNull();
    await vi.waitFor(() => expect(document.activeElement?.id).toBe('source'));
  });

  it('traps focus inside the panel', async () => {
    await openWith(text(0, 3));
    expect(panel()?.closest('[aria-modal="true"]')).not.toBeNull();
    await vi.waitFor(() =>
      expect(
        document
          .querySelector('.cdk-dialog-container')
          ?.contains(document.activeElement),
      ).toBe(true),
    );
  });
});
