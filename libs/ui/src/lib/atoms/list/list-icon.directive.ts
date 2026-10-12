import { Directive } from '@angular/core';

/** The square icon tile at the start of a list row: `<span uiListIcon><ui-icon name="layers" size="sm" /></span>`. */
@Directive({ selector: '[uiListIcon]', host: { class: 'list__icon' } })
export class ListIcon {}
