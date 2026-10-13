import { Directive } from '@angular/core';

/**
 * The look of a checkbox on a native `<input type="checkbox">`: a real checkbox, so Space toggles
 * it and form binding works. Wrap it with its text in a `<label>`; the label's layout is the
 * consumer's own BEM class (`ui.row` in its stylesheet):
 * `<label class="quiz-form__option"><input type="checkbox" uiCheckbox /> Trộn đáp án</label>`.
 */
@Directive({
  selector: 'input[type=checkbox][uiCheckbox]',
  host: { class: 'check' },
})
export class Checkbox {}
