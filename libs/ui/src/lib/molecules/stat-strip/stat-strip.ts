import { Component } from '@angular/core';

/**
 * A row of figures as one card split into cells by 1px hairlines. Put `ui-stat` children inside.
 * Two columns on a phone, every cell in one row from `md` up; an odd last cell spans the row on
 * two columns. No icons and no tinted tiles (visual-design.md).
 */
@Component({
  selector: 'ui-stat-strip',
  host: { class: 'stat-strip' },
  template: '<ng-content />',
})
export class StatStrip {}
