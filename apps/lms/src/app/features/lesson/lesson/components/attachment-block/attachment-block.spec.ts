import { TestBed } from '@angular/core/testing';
import type { AssetDetail } from '@lms/contracts';
import { AttachmentBlock } from './attachment-block';

const detail = (id: number, name: string, sizeBytes: number): AssetDetail =>
  ({
    usage: { id: id * 10, blockId: 1, assetId: id, usage: 'attachment' },
    asset: { id, originalName: name, sizeBytes, mimeType: 'application/pdf' },
  }) as AssetDetail;

function render(assets: readonly AssetDetail[], busy = false) {
  const fixture = TestBed.createComponent(AttachmentBlock);
  fixture.componentRef.setInput('assets', assets);
  fixture.componentRef.setInput('busy', busy);
  const downloads: AssetDetail[] = [];
  fixture.componentInstance.download.subscribe((a) => downloads.push(a));
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, downloads };
}

describe('AttachmentBlock', () => {
  const files = [
    detail(1, 'Biểu mẫu đối soát.xlsx', 2_048),
    detail(2, 'Hướng dẫn.pdf', 3_145_728),
  ];

  it('lists each file with its name and size', () => {
    const { el } = render(files);
    const rows = Array.from(el.querySelectorAll('li'));
    expect(
      rows.map((r) => r.querySelector('.files__name')?.textContent),
    ).toEqual(['Biểu mẫu đối soát.xlsx', 'Hướng dẫn.pdf']);
    expect(
      rows.map((r) => r.querySelector('.files__size')?.textContent),
    ).toEqual(['2 KB', '3.0 MB']);
  });

  it('asks to download the file of the row that was clicked', () => {
    const { el, downloads } = render(files);
    el.querySelector<HTMLButtonElement>(
      'button[aria-label="Tải xuống Hướng dẫn.pdf"]',
    )!.click();
    expect(downloads).toEqual([files[1]]);
  });

  it('disables the buttons while a download runs', () => {
    const { el } = render(files, true);
    expect(
      Array.from(el.querySelectorAll('button')).every((b) => b.disabled),
    ).toBe(true);
  });

  it('says there is nothing to download without files', () => {
    expect(render([]).el.textContent).toContain('chưa có tệp đính kèm');
  });
});
