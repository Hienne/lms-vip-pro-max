import {
  Component,
  computed,
  ElementRef,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { Input } from '../../atoms/input/input.directive';
import {
  formatDateInput,
  parseDateInput,
  type DateInputKind,
} from './date-format';

/**
 * A date or date-time box that reads `dd/mm/yyyy` (`dd/mm/yyyy hh:mm`), unlike the native
 * `type="date"` input, which follows the browser's locale. It is a Signal Forms value control:
 * `<ui-date-input [formField]="form.from" />`. The model value keeps the native format
 * (`yyyy-MM-dd`, or `yyyy-MM-ddTHH:mm` for `kind="datetime"`; empty string for no value), so a
 * schema written for a native input keeps working. Text that is not a real date leaves the value
 * empty and marks the box invalid until it is fixed.
 */
@Component({
  selector: 'ui-date-input',
  imports: [Input],
  host: { class: 'date-input' },
  template: `
    <input
      #box
      uiInput
      type="text"
      inputmode="numeric"
      autocomplete="off"
      [attr.aria-label]="label()"
      [attr.aria-invalid]="invalid() || malformed() ? 'true' : null"
      [placeholder]="placeholder()"
      [disabled]="disabled()"
      [readOnly]="readonly()"
      [value]="shown()"
      (input)="typed($event)"
      (blur)="blurred()"
    />
  `,
})
export class DateInput implements FormValueControl<string> {
  readonly value = model('');
  readonly touched = model(false);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  /** `date` for a day, `datetime` for a day and a time (24-hour). */
  readonly kind = input<DateInputKind>('date');
  /** Accessible name when no `<label for>` points at the box. */
  readonly label = input<string | null>(null);
  /** The native box; `ui-field` reads it to wire its label, hint and errors. */
  readonly box = viewChild<ElementRef<HTMLInputElement>>('box');

  /** What the person typed while it is not yet a valid date; `null` shows the model value. */
  private readonly draft = signal<string | null>(null);

  protected readonly placeholder = computed(() =>
    this.kind() === 'date' ? 'dd/mm/yyyy' : 'dd/mm/yyyy hh:mm',
  );
  protected readonly shown = computed(
    () => this.draft() ?? formatDateInput(this.value(), this.kind()),
  );
  protected readonly malformed = computed(() => this.draft() !== null);

  protected typed(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    if (text.trim() === '') {
      this.draft.set(null);
      this.value.set('');
      return;
    }
    const parsed = parseDateInput(text, this.kind());
    if (parsed === null) {
      this.draft.set(text);
      this.value.set('');
      return;
    }
    this.draft.set(null);
    this.value.set(parsed);
  }

  protected blurred(): void {
    this.touched.set(true);
  }
}
