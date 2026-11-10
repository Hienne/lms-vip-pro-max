import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReportPicker, type ReportPickerOption } from './report-picker';

const COURSES: readonly ReportPickerOption[] = [
  { id: 1, name: 'test', meta: 'TEST-0011' },
  { id: 2, name: 'test', meta: 'TEST-0012' },
  { id: 3, name: 'Không mã' },
];

@Component({
  imports: [ReportPicker],
  template: `<app-report-picker
    label="Khóa học"
    emptyLabel="Tất cả khóa học"
    [options]="options()"
    [selected]="selected()"
    [busy]="busy()"
    [disabled]="disabled()"
    disabledReason="Chọn đơn vị trước"
    [error]="error()"
    [required]="required()"
    (picked)="picks.push($event)"
  />`,
})
class Host {
  readonly options = signal<readonly ReportPickerOption[]>(COURSES);
  readonly selected = signal<ReportPickerOption | null>(null);
  readonly busy = signal(false);
  readonly disabled = signal(false);
  readonly error = signal<string | undefined>(undefined);
  readonly required = signal(false);
  readonly picks: (ReportPickerOption | null)[] = [];
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  const root = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  await settle();
  const box = () => root.querySelector<HTMLSelectElement>('select')!;
  const choose = async (value: string) => {
    box().value = value;
    box().dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  };
  return { root, box, choose, settle, host: fixture.componentInstance };
}

describe('ReportPicker', () => {
  it('uses a labelled dropdown and offers all courses without typed input', async () => {
    const { root, box } = await render();
    expect(root.querySelector('input')).toBeNull();
    expect(box().labels?.[0]?.textContent).toContain('Khóa học');
    expect(
      Array.from(box().options).map((option) => option.textContent?.trim()),
    ).toEqual([
      'Tất cả khóa học',
      'TEST-0011 · test',
      'TEST-0012 · test',
      'Không mã',
    ]);
  });

  it('picks the option by ID and clears the choice through the first option', async () => {
    const { choose, host } = await render();
    await choose('2');
    await choose('');
    expect(host.picks).toEqual([COURSES[1], null]);
  });

  it('shows the selected option and clears the selection when its parent changes', async () => {
    const { box, host, settle } = await render();
    host.selected.set(COURSES[0]);
    await settle();
    expect(box().value).toBe('1');
    host.selected.set(null);
    host.options.set([]);
    await settle();
    expect(box().value).toBe('');
  });

  it('disables the dropdown while waiting for the parent or API response', async () => {
    const { box, root, host, settle } = await render();
    host.disabled.set(true);
    await settle();
    expect(box().disabled).toBe(true);
    expect(root.textContent).toContain('Chọn đơn vị trước');
    host.disabled.set(false);
    host.busy.set(true);
    await settle();
    expect(box().disabled).toBe(true);
    expect(root.textContent).toContain('Đang tải danh sách');
  });

  it('lets the user clear an invalid choice from a link', async () => {
    const { root, host, settle } = await render();
    host.error.set('Không tìm thấy khóa học này trong phạm vi của bạn.');
    await settle();
    expect(root.textContent).toContain('Không tìm thấy khóa học này');
    root
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Bỏ lựa chọn Khóa học"]',
      )!
      .click();
    expect(host.picks).toEqual([null]);
  });

  it('marks the field required', async () => {
    const { root, host, settle } = await render();
    host.required.set(true);
    await settle();
    expect(root.querySelector('label')?.textContent).toContain('*');
  });
});
