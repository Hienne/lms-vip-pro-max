import {
  booleanAttribute,
  computed,
  Directive,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { Tooltip } from '../tooltip/tooltip.directive';

export type IconButtonVariant = 'default' | 'danger';
export type IconButtonSize = 'md' | 'sm';

/**
 * A round icon-only action on a native `<button>`. `label` is required, so an unnamed icon button
 * does not compile: it becomes the accessible name and the tooltip text. The hit area is the
 * touch minimum (44px).
 *
 * `<button uiIconButton label="Thông báo"><ui-icon name="bell" /></button>`
 *
 * It also decorates an `<a>` for an icon that navigates (`<a uiIconButton routerLink="…" label="…">`).
 */
@Directive({
  selector: 'button[uiIconButton], a[uiIconButton]',
  host: {
    class: 'icon-btn',
    '[class]': 'modifiers()',
    '[attr.type]': 'type',
    '[attr.aria-label]': 'label()',
  },
  hostDirectives: [
    { directive: Tooltip, inputs: ['uiTooltip: label', 'tooltipDisabled'] },
  ],
})
export class IconButton {
  /** `button` on a native button, none on a link. */
  protected readonly type =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.tagName ===
    'BUTTON'
      ? 'button'
      : null;

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
