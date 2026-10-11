import { Directive } from '@angular/core';

/** The look of a multi-line input on a native `<textarea>`. Invalid is styled from `aria-invalid="true"`. */
@Directive({
  selector: 'textarea[uiTextarea]',
  host: { class: 'textarea' },
})
export class Textarea {}
