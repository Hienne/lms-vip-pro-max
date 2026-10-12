import { Directive, input } from '@angular/core';
import type { ControlSize } from '../control-size';

/** The look of a dropdown on a native `<select>`. Invalid is styled from `aria-invalid="true"`. */
@Directive({
  selector: 'select[uiSelect]',
  host: { class: 'select', '[class.select--sm]': 'size() === "sm"' },
})
export class Select {
  readonly size = input<ControlSize>('md');
}
