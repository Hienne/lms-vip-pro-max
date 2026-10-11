import { Directive } from '@angular/core';

/** Title row of a card: title on the left, actions on the right, a border below. */
@Directive({ selector: '[uiCardHeader]', host: { class: 'card__header' } })
export class CardHeader {}
