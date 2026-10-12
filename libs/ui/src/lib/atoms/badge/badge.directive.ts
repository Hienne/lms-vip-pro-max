import { booleanAttribute, computed, Directive, input } from '@angular/core';

export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'reward';

/**
 * A small status label on a `<span>`: `tone` is the semantic colour, `dot` adds a leading dot,
 * `outline` swaps the fill for a border. Colour never carries the meaning alone: put the status in
 * the text, or an icon before it (`<span uiBadge tone="success"><ui-icon name="check" />Đạt</span>`).
 */
@Directive({
  selector: 'span[uiBadge]',
  host: { class: 'badge', '[class]': 'modifiers()' },
})
export class Badge {
  readonly tone = input<BadgeTone>('neutral');
  readonly dot = input(false, { transform: booleanAttribute });
  readonly outline = input(false, { transform: booleanAttribute });

  protected readonly modifiers = computed(() =>
    [
      this.tone() === 'neutral' ? '' : `badge--${this.tone()}`,
      this.dot() ? 'badge--dot' : '',
      this.outline() ? 'badge--outline' : '',
    ].filter(Boolean),
  );
}
