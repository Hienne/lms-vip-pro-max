import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { DocumentScope } from '@lms/contracts';
import type { Upload } from '../../data-access/assistant.model';
import { DocumentUpload } from './document-upload';

@Component({
  imports: [DocumentUpload],
  template: `<app-document-upload
    [uploads]="uploads()"
    [canShareGlobally]="admin()"
    [(scope)]="scope"
    [(title)]="title"
    (files)="added.push($event)"
    (dismiss)="dismissed.push($event)"
    (showExisting)="shown.push($event)"
  />`,
})
class Host {
  readonly uploads = signal<readonly Upload[]>([]);
  readonly admin = signal(false);
  readonly scope = signal<DocumentScope>('unit');
  readonly title = signal('');
  readonly shown: number[] = [];
  readonly added: File[][] = [];
  readonly dismissed: number[] = [];
}

const upload = (over: Partial<Upload>): Upload => ({
  id: 1,
  file: new File(['x'], 'a.md'),
  name: 'a.md',
  size: 2048,
  scope: 'unit',
  state: 'waiting',
  error: null,
  ...over,
});

describe('DocumentUpload', () => {
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

  it('explains what can be dropped and limits the picker to those types', async () => {
    expect(text()).toContain('Kéo thả tệp vào đây hoặc chọn tệp');
    expect(text()).toContain(
      'PDF, Markdown hoặc Word (.docx), tối đa 20 MB mỗi tệp.',
    );
    await fixture.whenStable();
    const input = el.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe('.pdf,.md,.docx');
    expect(input.multiple).toBe(true);
    expect(el.querySelector('label.drop')?.getAttribute('tabindex')).toBe('0');
  });

  it('passes the chosen files up', () => {
    const input = el.querySelector('input[type="file"]') as HTMLInputElement;
    const chosen = new File(['x'], 'b.pdf');
    Object.defineProperty(input, 'files', { value: [chosen] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(host.added).toEqual([[chosen]]);
  });

  const scopeLabels = () =>
    Array.from(el.querySelectorAll('[role="option"]')).map((o) =>
      o.textContent?.trim(),
    );

  it('asks who may find the document, without the whole-system choice for anyone but an admin', () => {
    expect(text()).toContain('Ai tìm thấy tài liệu này');
    expect(scopeLabels()).toEqual(['Chỉ mình tôi', 'Đơn vị của tôi']);
    expect(host.scope()).toBe('unit');
  });

  it('offers the whole system to an admin and reports the choice', () => {
    host.admin.set(true);
    fixture.detectChanges();
    expect(scopeLabels()).toEqual([
      'Chỉ mình tôi',
      'Đơn vị của tôi',
      'Toàn hệ thống',
    ]);
    (el.querySelectorAll('[role="option"]')[2] as HTMLElement).click();
    fixture.detectChanges();
    expect(host.scope()).toBe('global');
  });

  it('has a title field for the next file, empty by default, that reports what is typed', () => {
    const input = el.querySelector<HTMLInputElement>('#upload-title')!;
    expect(input.value).toBe('');
    expect(
      el.querySelector('label[for="upload-title"]')?.textContent,
    ).toContain('Tên hiển thị');
    input.value = 'Quy trình EOD';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(host.title()).toBe('Quy trình EOD');
  });

  it('tells the user a file was already uploaded and points at the existing document', () => {
    host.uploads.set([
      upload({
        id: 8,
        name: 'a.md',
        state: 'duplicate',
        existing: { id: 42, title: 'Quy trình EOD' },
      }),
    ]);
    fixture.detectChanges();
    expect(text()).toContain('Bạn đã tải tệp này rồi');
    expect(text()).toContain('Quy trình EOD');
    const buttons = Array.from(el.querySelectorAll('li button'));
    (
      buttons.find((b) =>
        b.textContent?.includes('Xem tài liệu'),
      ) as HTMLElement
    ).click();
    expect(host.shown).toEqual([42]);
    (
      el.querySelector('li [aria-label="Bỏ thông báo về a.md"]') as HTMLElement
    ).click();
    expect(host.dismissed).toEqual([8]);
  });

  it('lists nothing when the queue is empty', () => {
    expect(el.querySelector('ul')).toBeNull();
  });

  it('shows a file that waits and one that is uploading', () => {
    host.uploads.set([
      upload({ id: 1, name: 'a.md', state: 'uploading' }),
      upload({ id: 2, name: 'b.pdf', state: 'waiting' }),
    ]);
    fixture.detectChanges();
    const rows = Array.from(el.querySelectorAll('li'));
    expect(rows[0].textContent).toContain('Đang tải lên…');
    expect(rows[0].querySelector('[role="status"]')).not.toBeNull();
    expect(rows[1].textContent).toContain('Đang chờ tải lên');
  });

  it('announces a refused file with the reason and lets it be dismissed', () => {
    host.uploads.set([
      upload({
        id: 5,
        name: 'anh.png',
        state: 'error',
        error: 'Chỉ hỗ trợ tệp .pdf, .md hoặc .docx.',
      }),
    ]);
    fixture.detectChanges();
    const alert = el.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('anh.png');
    expect(alert.textContent).toContain('Chỉ hỗ trợ tệp .pdf, .md hoặc .docx.');
    const dismiss = el.querySelector('button') as HTMLButtonElement;
    expect(dismiss.getAttribute('aria-label')).toBe('Bỏ anh.png');
    dismiss.click();
    expect(host.dismissed).toEqual([5]);
  });
});
