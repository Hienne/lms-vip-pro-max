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
    (queried)="queries.push($event)"
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
  readonly queries: string[] = [];
  readonly picks: (ReportPickerOption | null)[] = [];
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  document.body.appendChild(fixture.nativeElement);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  await settle();
  const root = fixture.nativeElement as HTMLElement;
  const box = () => root.querySelector<HTMLInputElement>('input')!;
  const key = async (name: string) => {
    box().dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true }),
    );
    await settle();
  };
  const type = async (text: string) => {
    box().value = text;
    box().dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  };
  const options = () =>
    Array.from(root.querySelectorAll<HTMLElement>('[role="option"]')).map((o) =>
      o.textContent?.replace(/\s+/g, ' ').trim(),
    );
  const text = () => root.textContent?.replace(/\s+/g, ' ') ?? '';
  return {
    fixture,
    root,
    box,
    key,
    type,
    options,
    text,
    settle,
    host: fixture.componentInstance,
  };
}

describe('ReportPicker', () => {
  afterEach(() => vi.useRealTimers());

  it('is a combobox labelled by its field, saying what an empty choice means', async () => {
    const { box, root } = await render();
    expect(box().getAttribute('role')).toBe('combobox');
    expect(box().labels?.[0]?.textContent).toContain('Khóa học');
    expect(box().placeholder).toBe('Tất cả khóa học');
    expect(root.querySelector('[role="listbox"]')).toBeNull();
  });

  it('lists the options as "code · name" once the box is opened', async () => {
    const { box, key, options } = await render();
    box().focus();
    await key('ArrowDown');
    expect(options()).toEqual([
      'TEST-0011 · test',
      'TEST-0012 · test',
      'Không mã',
    ]);
  });

  it('picks the option under the arrow with Enter', async () => {
    const { box, key, host } = await render();
    box().focus();
    await key('ArrowDown');
    await key('ArrowDown');
    await key('Enter');
    expect(host.picks).toEqual([COURSES[1]]);
  });

  it('shows the picked option and clears it with "Xóa"', async () => {
    const { box, root, host, settle } = await render();
    host.selected.set(COURSES[0]);
    await settle();
    expect(box().value).toBe('TEST-0011 · test');

    const clear = Array.from(root.querySelectorAll('button')).find((b) =>
      `${b.textContent} ${b.getAttribute('aria-label')}`.includes('Xóa'),
    );
    expect(clear?.getAttribute('aria-label')).toBe('Xóa Khóa học');
    clear!.click();
    await settle();
    expect(host.picks).toEqual([null]);
  });

  it('offers "Xóa" for a choice it reports as not found', async () => {
    const { root, host, settle } = await render();
    host.error.set('Không tìm thấy khóa học này trong phạm vi của bạn.');
    await settle();
    const clear = root.querySelector<HTMLButtonElement>(
      'button[aria-label="Xóa Khóa học"]',
    );
    clear!.click();
    expect(host.picks).toEqual([null]);
  });

  it('has no "Xóa" while nothing is picked', async () => {
    const { root } = await render();
    expect(
      Array.from(root.querySelectorAll('button')).some((b) =>
        (b.getAttribute('aria-label') ?? '').includes('Xóa'),
      ),
    ).toBe(false);
  });

  it('asks for matches only once typing pauses for 300 ms', async () => {
    vi.useFakeTimers();
    const { type, host } = await render();
    await type('t');
    await type('te');
    vi.advanceTimersByTime(299);
    expect(host.queries).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(host.queries).toEqual(['te']);
  });

  it('says why it is disabled, in the hint the box is described by', async () => {
    const { box, host, settle, text } = await render();
    host.disabled.set(true);
    await settle();
    expect(box().getAttribute('aria-disabled')).toBe('true');
    expect(text()).toContain('Chọn đơn vị trước');
    const hint = box()
      .getAttribute('aria-describedby')
      ?.split(' ')
      .map((id) => document.getElementById(id)?.textContent?.trim());
    expect(hint).toContain('Chọn đơn vị trước');
  });

  it('shows an error linked to the box', async () => {
    const { box, host, settle } = await render();
    host.error.set('Không tìm thấy khóa học này trong phạm vi của bạn.');
    await settle();
    const described = box()
      .getAttribute('aria-describedby')
      ?.split(' ')
      .map((id) => document.getElementById(id)?.textContent?.trim());
    expect(described).toContain(
      'Không tìm thấy khóa học này trong phạm vi của bạn.',
    );
  });

  it('says when the search is running or finds nothing', async () => {
    const { box, key, host, settle, text } = await render();
    box().focus();
    host.options.set([]);
    host.busy.set(true);
    await key('ArrowDown');
    expect(text()).toContain('Đang tìm…');
    host.busy.set(false);
    await settle();
    expect(text()).toContain('Không có kết quả phù hợp.');
  });

  it('marks the field required', async () => {
    const { root, host, settle } = await render();
    host.required.set(true);
    await settle();
    expect(root.querySelector('label')?.textContent).toContain('*');
  });
});
