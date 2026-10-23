import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { KnowledgeDocument } from '@lms/contracts';
import { knowledgeDocumentFixtures } from '@lms/mocks';
import { DocumentList } from './document-list';

@Component({
  imports: [DocumentList],
  template: `<app-document-list
    [documents]="documents()"
    [total]="total()"
    [page]="page()"
    [pageSize]="20"
    [loading]="loading()"
    [failed]="failed()"
    (pageChange)="pages.push($event)"
    (retry)="retries = retries + 1"
  />`,
})
class Host {
  readonly documents = signal<readonly KnowledgeDocument[]>(
    knowledgeDocumentFixtures,
  );
  readonly total = signal(knowledgeDocumentFixtures.length);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly pages: number[] = [];
  retries = 0;
}

describe('DocumentList', () => {
  let host: Host;
  let el: HTMLElement;
  let fixture: ReturnType<typeof TestBed.createComponent<Host>>;

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const rows = () => Array.from(el.querySelectorAll('li'));

  it('shows each document with its uploader, a status badge and the total', () => {
    expect(el.querySelector('h2')?.textContent).toBe('Tài liệu trong kho');
    expect(rows()).toHaveLength(knowledgeDocumentFixtures.length);
    const first = knowledgeDocumentFixtures[0];
    expect(rows()[0].querySelector('.doc__name')?.getAttribute('title')).toBe(
      first.fileName,
    );
    expect(rows()[0].textContent).toContain(first.uploadedBy.fullName);
    expect(rows()[0].querySelector('.badge')).not.toBeNull();
  });

  it.each([
    ['queued', 'Đang chờ'],
    ['processing', 'Đang xử lý'],
    ['ready', 'Sẵn sàng'],
    ['failed', 'Không xử lý được'],
  ] as const)('reads %s as "%s"', (status, label) => {
    host.documents.set([{ ...knowledgeDocumentFixtures[0], status }]);
    fixture.detectChanges();
    expect(rows()[0].querySelector('.badge')?.textContent?.trim()).toBe(label);
  });

  it("shows the server's reason under a failed document only", () => {
    host.documents.set([
      {
        ...knowledgeDocumentFixtures[0],
        status: 'failed',
        errorMessage: 'Tài liệu không có nội dung văn bản.',
      },
      { ...knowledgeDocumentFixtures[1], status: 'ready', errorMessage: null },
    ]);
    fixture.detectChanges();
    expect(rows()[0].textContent).toContain(
      'Tài liệu không có nội dung văn bản.',
    );
    expect(rows()[1].querySelector('.doc__error')).toBeNull();
  });

  it('shows the empty line when there are no documents', () => {
    host.documents.set([]);
    host.total.set(0);
    fixture.detectChanges();
    expect(text()).toContain(
      'Chưa có tài liệu nào. Tải lên tệp đầu tiên để bắt đầu hỏi đáp.',
    );
    expect(rows()).toEqual([]);
  });

  it('shows placeholders while the first page loads, hidden from assistive technology', () => {
    host.documents.set([]);
    host.loading.set(true);
    fixture.detectChanges();
    expect(
      el.querySelectorAll('[uiSkeleton][aria-hidden="true"]'),
    ).toHaveLength(3);
    expect(el.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
    expect(text()).not.toContain('Chưa có tài liệu nào');
  });

  it('shows an error with a retry when the list cannot be loaded', () => {
    host.failed.set(true);
    fixture.detectChanges();
    expect(text()).toContain('Không tải được danh sách tài liệu');
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Thử lại'))
      ?.click();
    expect(host.retries).toBe(1);
  });

  it('pages through the server list', () => {
    host.total.set(45);
    fixture.detectChanges();
    Array.from(el.querySelectorAll<HTMLButtonElement>('nav button'))
      .find((b) => b.textContent?.trim() === '2')
      ?.click();
    expect(host.pages).toEqual([2]);
  });
});
