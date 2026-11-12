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
    [canRemove]="canRemove"
    [canEdit]="canEdit"
    [highlightId]="highlightId()"
    (remove)="removed.push($event.id)"
    (renamed)="renames.push([$event.document.id, $event.title])"
    (replaced)="replacements.push([$event.document.id, $event.file.name])"
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
  readonly removed: number[] = [];
  readonly highlightId = signal<number | null>(null);
  readonly renames: [number, string][] = [];
  readonly replacements: [number, string][] = [];
  readonly canRemove = (d: KnowledgeDocument) =>
    d.uploadedBy.userId === '000005';
  readonly canEdit = (d: KnowledgeDocument) => d.uploadedBy.userId === '000005';
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

  it('shows each document with its uploader and a status badge, under no card', () => {
    expect(el.querySelector('.card')).toBeNull();
    expect(rows()).toHaveLength(knowledgeDocumentFixtures.length);
    const first = knowledgeDocumentFixtures[0];
    expect(rows()[0].querySelector('.doc__name')?.getAttribute('title')).toBe(
      first.fileName,
    );
    expect(rows()[0].textContent).toContain(first.uploadedBy.fullName);
    expect(rows()[0].querySelector('.badge')).not.toBeNull();
  });

  it('says who can find each document', () => {
    const scopes = rows().map((row) =>
      row.querySelector('.doc__meta')?.textContent?.replace(/\s+/g, ' '),
    );
    expect(scopes[0]).toContain('Đơn vị của tôi');
    expect(scopes[1]).toContain('Đơn vị của tôi');
    expect(scopes[2]).toContain('Toàn hệ thống');
  });

  it('offers delete only where allowed and reports which document', () => {
    const buttons = rows().map((row) =>
      row.querySelector<HTMLElement>('.doc__remove'),
    );
    expect(buttons[0]).toBeNull();
    expect(buttons[1]?.getAttribute('aria-label')).toBe(
      `Xoá ${knowledgeDocumentFixtures[1].title}`,
    );
    buttons[1]?.click();
    expect(host.removed).toEqual([knowledgeDocumentFixtures[1].id]);
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
    expect(el.querySelector('.docs')?.getAttribute('aria-busy')).toBe('true');
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

  describe('rename, replace and the notices on a row', () => {
    const menuTrigger = (row: HTMLElement) =>
      row.querySelector<HTMLButtonElement>('ui-menu button');

    async function choose(row: HTMLElement, label: string): Promise<void> {
      menuTrigger(row)?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      const item = Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ).find((i) => i.textContent?.trim() === label);
      item?.click();
      fixture.detectChanges();
      await fixture.whenStable();
    }

    afterEach(() => {
      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((c) => (c.innerHTML = ''));
    });

    it('shows the title as the name and the file name beside it when they differ', () => {
      host.documents.set([
        {
          ...knowledgeDocumentFixtures[1],
          title: 'Quy trình ECR',
          fileName: 'ecr-v3.docx',
        },
      ]);
      fixture.detectChanges();
      expect(rows()[0].querySelector('.doc__name')?.textContent).toBe(
        'Quy trình ECR',
      );
      expect(rows()[0].querySelector('.doc__meta')?.textContent).toContain(
        'ecr-v3.docx',
      );
    });

    it('offers the row menu where the caller may change the document only', () => {
      // Fixtures 1 and 2 belong to 000005 and 000004 respectively.
      expect(menuTrigger(rows()[0])).toBeNull();
      expect(menuTrigger(rows()[1])?.getAttribute('aria-label')).toBe(
        `Thao tác với ${knowledgeDocumentFixtures[1].title}`,
      );
    });

    it('renames in place with Enter and reports the new title once', async () => {
      await choose(rows()[1], 'Đổi tên');
      const editor = el.querySelector<HTMLInputElement>('.doc__editor');
      expect(editor?.value).toBe(knowledgeDocumentFixtures[1].title);
      editor!.value = '  Quy trình ECR mới  ';
      editor!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      fixture.detectChanges();
      expect(host.renames).toEqual([
        [knowledgeDocumentFixtures[1].id, 'Quy trình ECR mới'],
      ]);
      expect(el.querySelector('.doc__editor')).toBeNull();
    });

    it('sends nothing when the name is left as it was, empty, or cancelled with Escape', async () => {
      await choose(rows()[1], 'Đổi tên');
      const editor = el.querySelector<HTMLInputElement>('.doc__editor')!;
      editor.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      fixture.detectChanges();
      await choose(rows()[1], 'Đổi tên');
      const again = el.querySelector<HTMLInputElement>('.doc__editor')!;
      again.value = '   ';
      again.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      fixture.detectChanges();
      await choose(rows()[1], 'Đổi tên');
      el.querySelector<HTMLInputElement>('.doc__editor')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      fixture.detectChanges();
      expect(host.renames).toEqual([]);
      expect(el.querySelector('.doc__editor')).toBeNull();
    });

    it('opens the file picker for "Thay bản mới" and reports the chosen file with its document', async () => {
      const picker = el.querySelector<HTMLInputElement>(
        'input[type="file"][hidden]',
      )!;
      expect(picker.accept).toBe('.pdf,.md,.docx');
      const open = vi.spyOn(picker, 'click');
      await choose(rows()[1], 'Thay bản mới');
      expect(open).toHaveBeenCalledTimes(1);
      const chosen = new File(['x'], 'moi.pdf');
      Object.defineProperty(picker, 'files', { value: [chosen] });
      picker.dispatchEvent(new Event('change', { bubbles: true }));
      expect(host.replacements).toEqual([
        [knowledgeDocumentFixtures[1].id, 'moi.pdf'],
      ]);
    });

    it('says the old version still answers while a replacement is processed, and why a failed one is refused', () => {
      host.documents.set([
        {
          ...knowledgeDocumentFixtures[2],
          replacement: {
            status: 'processing',
            fileName: 'moi.pdf',
            errorMessage: null,
          },
        },
        {
          ...knowledgeDocumentFixtures[2],
          id: 50,
          replacement: {
            status: 'failed',
            fileName: 'hong.pdf',
            errorMessage: 'Tài liệu không có nội dung văn bản.',
          },
        },
      ]);
      fixture.detectChanges();
      expect(rows()[0].querySelector('.doc__note')?.textContent).toContain(
        'bản cũ vẫn trả lời',
      );
      const failure = rows()[1].querySelector('.doc__error')?.textContent;
      expect(failure).toContain('bản cũ vẫn được dùng');
      expect(failure).toContain('Tài liệu không có nội dung văn bản.');
    });

    it('marks the row an upload repeated', () => {
      host.highlightId.set(knowledgeDocumentFixtures[1].id);
      fixture.detectChanges();
      expect(
        rows().map((row) => row.classList.contains('doc--highlight')),
      ).toEqual([false, true, false]);
    });
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
