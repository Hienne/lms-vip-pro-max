import { DialogRef } from '@angular/cdk/dialog';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StartCourseStore } from './data-access/start-course.store';
import { StartCourseDialog } from './start-course-dialog';

class FakeStore {
  readonly picksUnit$ = signal(false);
  readonly units$ = signal([{ id: 4, name: 'Phòng Vận hành' }]);
  readonly programmes$ = signal([{ id: 5, name: 'Chương trình Core' }]);
  readonly competencies$ = signal([{ id: 9, name: 'Đối soát' }]);
  readonly isStarting$ = signal(false);
  readonly error$ = signal(undefined);
  readonly chooseUnit = vi.fn();
  readonly start = vi.fn();
}

describe('StartCourseDialog', () => {
  let store: FakeStore;
  const close = vi.fn();

  async function open(picksUnit = false) {
    store = new FakeStore();
    store.picksUnit$.set(picksUnit);
    TestBed.configureTestingModule({
      providers: [{ provide: DialogRef, useValue: { close } }],
    });
    TestBed.overrideComponent(StartCourseDialog, {
      set: { providers: [{ provide: StartCourseStore, useValue: store }] },
    });
    const fixture = TestBed.createComponent(StartCourseDialog);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el };
  }

  const fill = async (
    fixture: { whenStable(): Promise<unknown> },
    el: HTMLElement,
    selector: string,
    value: string,
    event = 'input',
  ) => {
    const control = el.querySelector<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(selector)!;
    control.value = value;
    control.dispatchEvent(new Event(event));
    await fixture.whenStable();
  };

  const pickFile = async (
    fixture: { whenStable(): Promise<unknown> },
    el: HTMLElement,
    file: File,
  ) => {
    const input = el.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      value: { item: () => file, length: 1 },
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };

  const startButton = (el: HTMLElement) =>
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const labels = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('label')).map((l) => l.textContent?.trim());

  beforeEach(() => close.mockClear());

  it('asks an instructor for no unit, since the course is always in their own', async () => {
    const { el } = await open(false);

    expect(labels(el).join('|')).not.toContain('Đơn vị sở hữu');
  });

  it('asks an admin which unit will own the course', async () => {
    const { el } = await open(true);

    expect(labels(el).join('|')).toContain('Đơn vị sở hữu');
    expect(el.textContent).toContain('Phòng Vận hành');
  });

  it('cannot start without a file and the fields, and not without chapters or a duration', async () => {
    const { fixture, el } = await open();
    expect(startButton(el).disabled).toBe(true);

    await pickFile(fixture, el, new File(['x'], 'quy-trinh.md'));
    await fill(fixture, el, 'textarea', 'Giao dịch viên mới');
    await fill(fixture, el, 'select[name], select', '5');
    expect(startButton(el).disabled).toBe(true);
  });

  it('refuses a file the server would not read', async () => {
    const { fixture, el } = await open();

    await pickFile(fixture, el, new File(['x'], 'anh.png'));

    expect(el.textContent).toContain('.pdf, .md hoặc .docx');
  });

  it('sends the file and the typed inputs, without a unit for an instructor', async () => {
    const { fixture, el } = await open();
    const file = new File(['x'], 'quy-trinh.md');
    await pickFile(fixture, el, file);
    await fill(fixture, el, 'textarea', 'Giao dịch viên mới');
    const selects = el.querySelectorAll<HTMLSelectElement>('select');
    // level, programme, competency (no unit picker)
    expect(selects).toHaveLength(3);
    const inputs = el.querySelectorAll<HTMLInputElement>('input:not([type])');
    inputs[0].value = '3';
    inputs[0].dispatchEvent(new Event('input'));
    await fixture.whenStable();
    for (const [select, value] of [
      [selects[1], '5'],
      [selects[2], '9'],
    ] as const) {
      select.value = value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await fixture.whenStable();

    expect(startButton(el).disabled).toBe(false);
    startButton(el).click();
    await fixture.whenStable();

    expect(store.start).toHaveBeenCalledTimes(1);
    const [request] = store.start.mock.calls[0];
    expect(request.file).toBe(file);
    expect(request.inputs).toMatchObject({
      targetLearners: 'Giao dịch viên mới',
      level: 'BEGINNER',
      chapters: 3,
      durationMinutes: null,
      programmeId: 5,
      competencyId: 9,
      ownerOrgId: null,
    });
  });
});
