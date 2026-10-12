import { Component, input } from '@angular/core';

/**
 * An inline hint block ("Mẹo"): a quiet callout with an accent edge for advice that is not a
 * warning. Static content, so it is never a live region. Not the hover bubble: that is `uiTooltip`.
 */
@Component({
  selector: 'ui-tip',
  host: { class: 'tip-note' },
  template: `
    <strong class="tip-note__label">{{ label() }}</strong>
    <span class="tip-note__body"><ng-content /></span>
  `,
})
export class Tip {
  readonly label = input('Mẹo');
}
