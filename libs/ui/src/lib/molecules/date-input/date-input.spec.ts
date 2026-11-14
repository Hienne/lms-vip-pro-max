import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { Field } from '../field/field';
import { DateInput } from './date-input';
import { formatDateInput, parseDateInput } from './date-format';

@Component({
  imports: [DateInput, FormField, Field],
  template: `<ui-field label="Từ ngày"
    ><ui-date-input [kind]="kind()" [picker]="picker()" [formField]="f.when"
  /></ui-field>`,
})
class Host {
  readonly kind = signal<'date' | 'datetime'>('date');
  readonly picker = signal(false);
  readonly model = signal({ when: '2026-03-05' });
  readonly f = form(this.model);
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const input = root.querySelector('input') as HTMLInputElement;
  const type = (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  };
  return { fixture, input, type, host: fixture.componentInstance };
}

describe('date text', () => {
  it('formats the model value as dd/mm/yyyy, with the time for a date-time', () => {
    expect(formatDateInput('2026-03-05', 'date')).toBe('05/03/2026');
    expect(formatDateInput('2026-03-05T09:07', 'datetime')).toBe(
      '05/03/2026 09:07',
    );
    expect(formatDateInput('2026-03-05', 'datetime')).toBe('05/03/2026 00:00');
    expect(formatDateInput('', 'date')).toBe('');
  });

  it('parses typed text and rejects dates that do not exist', () => {
    expect(parseDateInput('5/3/2026', 'date')).toBe('2026-03-05');
    expect(parseDateInput('05-03-2026', 'date')).toBe('2026-03-05');
    expect(parseDateInput('05/03/2026 9:07', 'datetime')).toBe(
      '2026-03-05T09:07',
    );
    expect(parseDateInput('05/03/2026', 'datetime')).toBe('2026-03-05T00:00');
    expect(parseDateInput('30/02/2026', 'date')).toBeNull();
    expect(parseDateInput('01/13/2026', 'date')).toBeNull();
    expect(parseDateInput('01/01/2026 24:00', 'datetime')).toBeNull();
    expect(parseDateInput('2026-03-05', 'date')).toBeNull();
  });
});

describe('DateInput', () => {
  it('offers a native date-time picker while retaining the API-compatible form value', () => {
    const { fixture, host, input, type } = render();
    host.kind.set('datetime');
    host.picker.set(true);
    host.model.set({ when: '2026-11-14T09:30' });
    fixture.detectChanges();
    expect(input.type).toBe('datetime-local');
    expect(input.value).toBe('2026-11-14T09:30');
    type('2026-11-15T10:45');
    expect(host.model().when).toBe('2026-11-15T10:45');
  });
  it('shows the bound value as dd/mm/yyyy in a labelled text box', () => {
    const { input } = render();
    expect(input.type).toBe('text');
    expect(input.value).toBe('05/03/2026');
    expect(input.placeholder).toBe('dd/mm/yyyy');
    expect(input.id).not.toBe('');
    expect(input.labels?.[0]?.textContent).toBe('Từ ngày');
  });

  it('writes the native format to the form when a valid date is typed', () => {
    const { type, host } = render();
    type('12/04/2027');
    expect(host.model().when).toBe('2027-04-12');
  });

  it('clears the value and marks the box invalid for text that is not a date', () => {
    const { type, input, host } = render();
    type('31/02/2026');
    expect(host.model().when).toBe('');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.value).toBe('31/02/2026');
    type('28/02/2026');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(host.model().when).toBe('2026-02-28');
  });

  it('empties the value when the text is cleared', () => {
    const { type, host } = render();
    type('');
    expect(host.model().when).toBe('');
  });

  it('follows the model and the kind', () => {
    const { fixture, input, host } = render();
    host.model.set({ when: '2026-12-31' });
    fixture.detectChanges();
    expect(input.value).toBe('31/12/2026');
    host.kind.set('datetime');
    host.model.set({ when: '2026-12-31T18:30' });
    fixture.detectChanges();
    expect(input.value).toBe('31/12/2026 18:30');
    expect(input.placeholder).toBe('dd/mm/yyyy hh:mm');
  });

  it('reports itself touched on blur', () => {
    const fixture = TestBed.createComponent(DateInput);
    fixture.detectChanges();
    expect(fixture.componentInstance.touched()).toBe(false);
    fixture.nativeElement
      .querySelector('input')
      .dispatchEvent(new FocusEvent('blur'));
    expect(fixture.componentInstance.touched()).toBe(true);
  });
});
