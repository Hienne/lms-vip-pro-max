import { Directive } from '@angular/core';

/** Padded content area of a card. */
@Directive({ selector: '[uiCardBody]', host: { class: 'card__body' } })
export class CardBody {}
