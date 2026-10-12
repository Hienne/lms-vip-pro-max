import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface BreadcrumbItem {
  readonly label: string;
  /** Router link target. Ignored on the last item, which is the current page. */
  readonly href?: string;
}

/**
 * Trail of where the user is (the mockup's `UI.Breadcrumb`): a navigation landmark with an ordered
 * list. Every item but the last is a router link; the last is plain text marked
 * `aria-current="page"`. The `/` separators are real elements hidden from assistive technology.
 */
@Component({
  selector: 'ui-breadcrumb',
  imports: [RouterLink],
  host: { class: 'breadcrumb' },
  template: `
    <nav [attr.aria-label]="label()">
      <ol class="breadcrumb__list">
        @for (item of items(); track $index; let last = $last) {
          <li class="breadcrumb__item">
            @if (!last) {
              @if (item.href) {
                <a class="breadcrumb__link" [routerLink]="item.href">{{
                  item.label
                }}</a>
              } @else {
                <span class="breadcrumb__text">{{ item.label }}</span>
              }
              <span class="breadcrumb__sep" aria-hidden="true">/</span>
            } @else {
              <span class="breadcrumb__text" aria-current="page">{{
                item.label
              }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class Breadcrumb {
  readonly items = input.required<readonly BreadcrumbItem[]>();
  /** Accessible name of the landmark. */
  readonly label = input('Đường dẫn');
}
