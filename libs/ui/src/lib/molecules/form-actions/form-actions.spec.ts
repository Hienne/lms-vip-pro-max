import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormActions } from './form-actions';

@Component({
  imports: [FormActions],
  template: `
    <form id="the-form"></form>
    <ui-form-actions
      formId="the-form"
      submitLabel="Lưu lại"
      cancelLabel="Bỏ qua"
      [saving]="saving()"
      (cancel)="cancelled = cancelled + 1"
    >
      <button id="extra">Phụ</button>
    </ui-form-actions>
  `,
})
class Host {
  readonly saving = signal(false);
  cancelled = 0;
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const buttons = () =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button'));
  return { fixture, el, buttons };
}

describe('FormActions', () => {
  it('shows the labels it is given', () => {
    const { buttons } = setup();
    expect(buttons().map((b) => b.textContent?.trim())).toEqual([
      'Phụ',
      'Bỏ qua',
      'Lưu lại',
    ]);
  });

  it('makes the submit button submit the form by its id', () => {
    const { buttons } = setup();
    const submit = buttons().find((b) => b.textContent?.includes('Lưu lại'));
    expect(submit?.getAttribute('type')).toBe('submit');
    expect(submit?.getAttribute('form')).toBe('the-form');
  });

  it('disables the submit button while saving', async () => {
    const { fixture, buttons } = setup();
    const submit = () =>
      buttons().find((b) => b.textContent?.includes('Lưu lại'));
    expect(submit()?.disabled).toBe(false);

    fixture.componentInstance.saving.set(true);
    fixture.detectChanges();
    expect(submit()?.disabled).toBe(true);
  });

  it('emits cancel from the cancel button', () => {
    const { fixture, buttons } = setup();
    buttons()
      .find((b) => b.textContent?.includes('Bỏ qua'))
      ?.click();
    expect(fixture.componentInstance.cancelled).toBe(1);
  });

  it('puts projected extra actions before the cancel and submit buttons', () => {
    const { buttons } = setup();
    expect(buttons()[0].id).toBe('extra');
  });
});
