import { NgTemplateOutlet } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

export type StatTone = 'default' | 'danger';

/**
 * One cell of a `ui-stat-strip`: a value over its label, with an optional footnote and an
 * optional link. `unit` is a small suffix after the value (`%`). The footnote is the `note` input,
 * or projected as `slot="note"` when it holds mixed text. `tone="danger"` colours the value and is
 * for an overdue or failed figure only. With `link` the whole cell is one router link, so do not
 * project buttons into a linked stat; an unlinked stat may project an action as default content.
 * With `pressed` (true or false) the whole cell is a toggle button that emits `press`, for a figure
 * that filters the list below it; such a cell shows `label`, `value`, `unit` and `note` only.
 */
@Component({
  selector: 'ui-stat',
  imports: [NgTemplateOutlet, RouterLink],
  host: { class: 'stat' },
  template: `
    <ng-template #figure>
      <dl class="stat__figure">
        <dt class="stat__label">{{ label() }}</dt>
        <!-- prettier-ignore -->
        <dd class="stat__value" [class.stat__value--danger]="tone() === 'danger'">{{ value() }}@if (unit(); as unit) {<small>{{ unit }}</small>}</dd>
        @if (note(); as note) {
          <dd class="stat__note">{{ note }}</dd>
        }
        <dd class="stat__note"><ng-content select="[slot=note]" /></dd>
        <dd class="stat__extra"><ng-content /></dd>
      </dl>
    </ng-template>
    @if (pressed() !== undefined) {
      <button
        type="button"
        class="stat__cell stat__cell--toggle"
        [attr.aria-pressed]="pressed()"
        (click)="press.emit()"
      >
        <span class="stat__figure">
          <span class="stat__label">{{ label() }}</span>
          <!-- prettier-ignore -->
          <span class="stat__value" [class.stat__value--danger]="tone() === 'danger'">{{ value() }}@if (unit(); as unit) {<small>{{ unit }}</small>}</span>
          @if (note(); as note) {
            <span class="stat__note">{{ note }}</span>
          }
        </span>
      </button>
    } @else if (link(); as target) {
      <a class="stat__cell" [routerLink]="target" [queryParams]="queryParams()">
        <ng-container *ngTemplateOutlet="figure" />
      </a>
    } @else {
      <div class="stat__cell">
        <ng-container *ngTemplateOutlet="figure" />
      </div>
    }
  `,
})
export class Stat {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly unit = input<string>();
  readonly note = input<string>();
  readonly tone = input<StatTone>('default');
  /** In-app router path; makes the whole cell a link. */
  readonly link = input<string | readonly unknown[]>();
  readonly queryParams = input<Record<string, string>>();
  /** Makes the whole cell a toggle button; `true` while its filter is the one applied. */
  readonly pressed = input<boolean>();
  /** The toggle cell was pressed. */
  readonly press = output<void>();
}
