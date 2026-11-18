import { booleanAttribute, Component, computed, input } from '@angular/core';
import { Card } from '../../atoms/card/card.directive';

let nextId = 0;

/**
 * A titled panel: a card with a header row (the section's `h2` on the left, an optional
 * `slot="action"` link or button on the right, a 1px rule below) and a body. Use it instead of
 * writing a card header by hand.
 *
 * The body is the default slot and is padded. `flush` removes the padding for content that
 * draws its own rows or edges: a `uiList` of `ui-list-row`s, a table, tabs. The card is a
 * landmark named by its title.
 */
@Component({
  selector: 'ui-section-card',
  hostDirectives: [Card],
  host: {
    class: 'section-card',
    '[class.section-card--fill]': 'fill()',
    role: 'region',
    '[attr.aria-labelledby]': 'titleId()',
  },
  template: `
    <div class="section-card__header">
      <h2 class="section-card__title" [id]="titleId()">{{ title() }}</h2>
      <div class="section-card__action">
        <ng-content select="[slot=action]" />
      </div>
    </div>
    <div class="section-card__body" [class.section-card__body--flush]="flush()">
      <ng-content />
    </div>
  `,
})
export class SectionCard {
  readonly title = input.required<string>();
  /** Fill a bounded panel while keeping its header visible. */
  readonly fill = input(false, { transform: booleanAttribute });
  /** Drop the body padding; the content spans the card edge to edge. */
  readonly flush = input(false, { transform: booleanAttribute });

  /** The heading's id, when a spec or an anchor needs a fixed one; generated otherwise. */
  readonly headingId = input<string>();

  private readonly generatedId = `section-card-${nextId++}`;
  protected readonly titleId = computed(
    () => this.headingId() ?? this.generatedId,
  );
}
