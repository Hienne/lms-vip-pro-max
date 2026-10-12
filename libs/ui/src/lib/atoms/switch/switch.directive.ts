import { Directive } from '@angular/core';

/**
 * A toggle switch on a native `<input type="checkbox">`: still a checkbox for the keyboard and
 * forms, exposed to assistive technology as `role="switch"`. Wrap it with its text in a `<label>`:
 * `<label class="inline-flex items-center gap-3 text-sm"><input type="checkbox" uiSwitch /> Nhắc học trước hạn</label>`.
 */
@Directive({
  selector: 'input[type=checkbox][uiSwitch]',
  host: { class: 'switch', role: 'switch' },
})
export class Switch {}
