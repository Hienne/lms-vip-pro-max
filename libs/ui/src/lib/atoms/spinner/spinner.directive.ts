import { Directive, input } from '@angular/core';

/** A loading spinner announced as a status; `label` is its Vietnamese accessible name. */
@Directive({
  selector: '[uiSpinner]',
  host: {
    class: 'spinner',
    role: 'status',
    '[attr.aria-label]': 'label()',
  },
})
export class Spinner {
  readonly label = input('Đang tải');
}
