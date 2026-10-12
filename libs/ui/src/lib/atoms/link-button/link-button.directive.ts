import { Directive } from '@angular/core';

/**
 * A text action that looks like a link, on a native `<button>` or `<a>`:
 * `<button uiLinkButton>Xem thêm <ui-icon name="arrow-right" size="sm" /></button>`.
 */
@Directive({
  selector: 'button[uiLinkButton], a[uiLinkButton]',
  host: { class: 'link-btn' },
})
export class LinkButton {}
