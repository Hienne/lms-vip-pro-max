import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UploadItem, type UploadState } from './upload-item';

@Component({
  imports: [UploadItem],
  template: `<ui-upload-item
    name="so-tay-su-co-eod.pdf"
    [size]="size()"
    [state]="state()"
    [progress]="progress()"
    [status]="status()"
    >Sai định dạng: chỉ chấp nhận PDF.</ui-upload-item
  >`,
})
class Host {
  readonly size = signal<number | undefined>(2_621_440);
  readonly state = signal<UploadState>('done');
  readonly progress = signal<number | undefined>(undefined);
  readonly status = signal<string | undefined>(undefined);
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return { fixture, root, host: fixture.componentInstance };
}

const text = (el: Element | null) =>
  el?.textContent?.replace(/\s+/g, ' ').trim();

describe('UploadItem', () => {
  it('shows the name and the byte size like the mockup (MB with one decimal)', () => {
    const { root } = render();
    expect(text(root.querySelector('.upload-item__name'))).toBe(
      'so-tay-su-co-eod.pdf',
    );
    expect(text(root.querySelector('.upload-item__size'))).toBe('2.5 MB');
  });

  it.each([
    [500, '1 KB'],
    [2048, '2 KB'],
    [1_048_576, '1024 KB'],
    [1_048_577, '1.0 MB'],
  ])('formats %i bytes as %s', (bytes, expected) => {
    const { fixture, root, host } = render();
    host.size.set(bytes);
    fixture.detectChanges();
    expect(text(root.querySelector('.upload-item__size'))).toBe(expected);
  });

  it('shows a progress bar only while uploading', () => {
    const { fixture, root, host } = render();
    expect(root.querySelector('ui-progress')).toBeNull();
    host.state.set('uploading');
    host.progress.set(64);
    fixture.detectChanges();
    const bar = root.querySelector('ui-progress');
    expect(bar?.getAttribute('aria-valuenow')).toBe('64');
    expect(bar?.getAttribute('aria-label')).toBe('Tiến trình tải lên');
  });

  it('says what it is doing under the name, without a bar while the server prepares the file', () => {
    const { fixture, root, host } = render();
    host.state.set('uploading');
    host.progress.set(40);
    host.status.set('Đang tải lên… 3.2 MB / 8.0 MB');
    fixture.detectChanges();
    expect(text(root.querySelector('.upload-item__status'))).toBe(
      'Đang tải lên… 3.2 MB / 8.0 MB',
    );
    expect(root.querySelector('ui-progress')).not.toBeNull();

    host.state.set('processing');
    host.status.set('Đang xử lý tệp…');
    fixture.detectChanges();
    expect(text(root.querySelector('.upload-item__status'))).toBe(
      'Đang xử lý tệp…',
    );
    expect(root.querySelector('ui-progress')).toBeNull();
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows no status line when none is given', () => {
    const { root } = render();
    expect(root.querySelector('.upload-item__status')).toBeNull();
  });

  it('is a plain item when done, with no alert and no error mark', () => {
    const { root } = render();
    expect(root.querySelector('.upload-item.is-error')).toBeNull();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(root.textContent).not.toContain('Sai định dạng');
  });

  it('is an alert with the projected message and a visible error icon on error', () => {
    const { fixture, root, host } = render();
    host.state.set('error');
    fixture.detectChanges();
    const item = root.querySelector('.upload-item.is-error');
    expect(item?.getAttribute('role')).toBe('alert');
    expect(text(item)).toContain('Sai định dạng: chỉ chấp nhận PDF.');
    expect(item?.querySelector('ui-icon')?.getAttribute('aria-label')).toBe(
      'Lỗi',
    );
  });

  it('omits the size when none is known', () => {
    const { fixture, root, host } = render();
    host.size.set(undefined);
    fixture.detectChanges();
    expect(root.querySelector('.upload-item__size')).toBeNull();
  });
});
