import { Directive } from '@angular/core';

/**
 * The look of a checkbox on a native `<input type="checkbox">`: a real checkbox, so Space toggles
 * it and form binding works. Wrap it with its text in a `<label>`:
 * `<label class="inline-flex items-start gap-2 text-sm"><input type="checkbox" uiCheckbox /> Trộn đáp án</label>`.
 */
@Directive({
  selector: 'input[type=checkbox][uiCheckbox]',
  host: { class: 'check' },
})
export class Checkbox {}
