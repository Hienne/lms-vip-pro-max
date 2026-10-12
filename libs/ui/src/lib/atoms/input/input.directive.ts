import { Directive, input } from '@angular/core';
import type { ControlSize } from '../control-size';

/**
 * The look of a text input on a native `<input>`: form binding, `type`, `required`, `disabled`,
 * `readonly`, `placeholder` and `aria-*` stay native. Invalid is styled from `aria-invalid="true"`.
 */
@Directive({
  selector: 'input[uiInput]',
  host: { class: 'input', '[class.input--sm]': 'size() === "sm"' },
})
export class Input {
  readonly size = input<ControlSize>('md');
}
