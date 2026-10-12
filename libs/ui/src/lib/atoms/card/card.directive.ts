import { booleanAttribute, computed, Directive, input } from '@angular/core';

export type CardVariant = 'default' | 'tint' | 'reward';

/**
 * A surface with a border. Compose it with `uiCardHeader` and `uiCardBody`, or use `padded` for a
 * card whose content is not split into parts. `interactive` is for a whole card that is a link
 * (`<a uiCard interactive href>`): it gets hover elevation and keeps the visible focus ring.
 */
@Directive({
  selector: 'article[uiCard], section[uiCard], div[uiCard], a[uiCard]',
  host: { class: 'card', '[class]': 'modifiers()' },
})
export class Card {
  readonly variant = input<CardVariant>('default');
  readonly padded = input(false, { transform: booleanAttribute });
  readonly interactive = input(false, { transform: booleanAttribute });

  protected readonly modifiers = computed(() =>
    [
      this.variant() === 'default' ? '' : `card--${this.variant()}`,
      this.padded() ? 'card--pad' : '',
      this.interactive() ? 'card--interactive' : '',
    ].filter(Boolean),
  );
}
