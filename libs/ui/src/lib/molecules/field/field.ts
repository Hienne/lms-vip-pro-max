import {
  afterRenderEffect,
  booleanAttribute,
  Component,
  computed,
  contentChild,
  ElementRef,
  input,
} from '@angular/core';
import { Checkbox } from '../../atoms/checkbox/checkbox.directive';
import { Icon } from '../../atoms/icon/icon';
import { Input } from '../../atoms/input/input.directive';
import { Select } from '../../atoms/select/select.directive';
import { Textarea } from '../../atoms/textarea/textarea.directive';

let nextId = 0;

/**
 * One form row: a visible label, the projected native control (`uiInput`, `uiSelect`,
 * `uiTextarea` or `uiCheckbox`), an optional hint and the error messages.
 *
 * It wires the control for you: the label's `for` and the control's `id` (an existing id is kept),
 * `aria-describedby` (hint and errors, appended to whatever the control already referenced),
 * `aria-required` and `aria-invalid` while there are errors. The field takes plain messages and
 * knows nothing about the form library; pass the messages you want shown (for Signal Forms, only
 * once the field is touched).
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
  readonly errors = input<readonly string[]>([]);

  private readonly generatedId = `ui-field-${nextId++}`;
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
  protected readonly errorItems = computed(() =>
    this.errors().map((message, index) => ({
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
