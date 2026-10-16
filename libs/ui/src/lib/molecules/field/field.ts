import {
  afterRenderEffect,
  booleanAttribute,
  Component,
  computed,
  contentChild,
  ElementRef,
  input,
} from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { Checkbox } from '../../atoms/checkbox/checkbox.directive';
import { Icon } from '../../atoms/icon/icon';
import { Input } from '../../atoms/input/input.directive';
import { Select } from '../../atoms/select/select.directive';
import { Textarea } from '../../atoms/textarea/textarea.directive';

let nextId = 0;

/**
 * One form row: a visible label, the projected native control (`uiInput`, `uiSelect`,
 * `uiTextarea` or `uiCheckbox`) bound with `[formField]`, an optional hint and the control's
 * validation messages.
 *
 * It reads the Signal Forms state of the projected `[formField]` itself, so a form declares no
 * error plumbing: the validator and async-validator messages of the field show once it is touched
 * (on blur, or after `submit()`). Server refusals are not field errors; the store reports them as a
 * toast or an alert. This makes `@lms/ui` depend on `@angular/forms/signals` at runtime.
 *
 * It wires the control for you: the label's `for` and the control's `id` (an existing id is kept),
 * `aria-describedby` (hint and errors, appended to whatever the control already referenced),
 * `aria-required` and `aria-invalid` while there are errors.
 */
@Component({
  selector: 'ui-field',
  imports: [Icon],
  templateUrl: './field.html',
  host: { class: 'field' },
})
export class Field {
  readonly label = input.required<string>();
  readonly required = input(false, { transform: booleanAttribute });
  readonly hint = input('');

  private readonly generatedId = `ui-field-${nextId++}`;
  private readonly formField = contentChild(FormField);
  private readonly textInput = contentChild(Input, { read: ElementRef });
  private readonly select = contentChild(Select, { read: ElementRef });
  private readonly textarea = contentChild(Textarea, { read: ElementRef });
  private readonly checkbox = contentChild(Checkbox, { read: ElementRef });
  private readonly control = computed<HTMLElement | undefined>(
    () =>
      (this.textInput() ?? this.select() ?? this.textarea() ?? this.checkbox())
        ?.nativeElement,
  );

  protected readonly controlId = computed(
    () => this.control()?.id || this.generatedId,
  );
  protected readonly hintId = computed(() => `${this.controlId()}-hint`);
  private readonly messages = computed(() => {
    const state = this.formField()?.state();
    if (!state?.touched()) return [];
    return state
      .errors()
      .map((error) => error.message)
      .filter((message): message is string => !!message);
  });
  protected readonly errorItems = computed(() =>
    this.messages().map((message, index) => ({
      id: `${this.controlId()}-error-${index}`,
      message,
    })),
  );

  constructor() {
    afterRenderEffect(() => {
      const control = this.control();
      if (!control) return;
      const id = this.controlId();
      const own = [
        ...(this.hint() ? [this.hintId()] : []),
        ...this.errorItems().map((item) => item.id),
      ];
      control.id = id;
      setAttribute(control, 'aria-required', this.required() ? 'true' : null);
      setAttribute(
        control,
        'aria-invalid',
        this.errorItems().length > 0 ? 'true' : null,
      );
      const foreign = (control.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .filter((token) => token && !token.startsWith(`${id}-`));
      setAttribute(control, 'aria-describedby', [...foreign, ...own].join(' '));
    });
  }
}

function setAttribute(el: HTMLElement, name: string, value: string | null) {
  if (value) el.setAttribute(name, value);
  else el.removeAttribute(name);
}
