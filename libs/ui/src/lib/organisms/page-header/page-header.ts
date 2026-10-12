import { Component, input } from '@angular/core';

/**
 * Title block at the top of a page (the mockup's `UI.PageHeader`): optional eyebrow, the page's
 * `h1`, optional description, and two projection slots: `slot="breadcrumb"` (rendered above the
 * header) and `slot="actions"` (right of the title, wrapping below it on narrow widths).
 */
@Component({
  selector: 'ui-page-header',
  host: { class: 'page-header-block' },
  template: `
    <ng-content select="[slot=breadcrumb]" />
    <header class="page-header">
      <div class="page-header__title">
        @if (eyebrow(); as eyebrow) {
          <span class="page-header__eyebrow">{{ eyebrow }}</span>
        }
        <h1>{{ title() }}</h1>
        @if (description(); as description) {
          <p class="page-header__desc">{{ description }}</p>
        }
      </div>
      <div class="page-header__actions">
        <ng-content select="[slot=actions]" />
      </div>
    </header>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly eyebrow = input<string>();
  readonly description = input<string>();
}
