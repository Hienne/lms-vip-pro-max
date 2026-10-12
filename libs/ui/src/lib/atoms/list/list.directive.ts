import { Directive } from '@angular/core';

/**
 * A vertical list of rows, usually inside a card: `<ul uiList uiCard>`. Each row is a `uiListItem`,
 * either the `<li>` itself or a link/button inside it.
 */
@Directive({ selector: 'ul[uiList], ol[uiList]', host: { class: 'list' } })
export class List {}
