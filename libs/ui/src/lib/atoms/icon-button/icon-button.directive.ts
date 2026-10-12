import { booleanAttribute, computed, Directive, input } from '@angular/core';

export type IconButtonVariant = 'default' | 'danger';
export type IconButtonSize = 'md' | 'sm';

/**
 * A round icon-only action on a native `<button>`. `label` is required, so an unnamed icon button
 * does not compile: it becomes the accessible name and the tooltip text. The hit area is the
 * touch minimum (44px).
 *
 * `<button uiIconButton label="Thông báo"><ui-icon name="bell" /></button>`
 */
@Directive({
  selector: 'button[uiIconButton]',
  host: {
    class: 'icon-btn',
    '[class]': 'modifiers()',
    type: 'button',
    '[attr.aria-label]': 'label()',
    '[attr.title]': 'label()',
  },
})
export class IconButton {
  /** Accessible name and tooltip text. */
  readonly label = input.required<string>();
  readonly variant = input<IconButtonVariant>('default');
  readonly size = input<IconButtonSize>('md');
  /** A small unread dot in the corner (notifications). */
  readonly dot = input(false, { transform: booleanAttribute });

  protected readonly modifiers = computed(() =>
    [
      this.variant() === 'default' ? '' : `icon-btn--${this.variant()}`,
      this.size() === 'md' ? '' : `icon-btn--${this.size()}`,
      this.dot() ? 'icon-btn--dot' : '',
    ].filter(Boolean),
  );
}
