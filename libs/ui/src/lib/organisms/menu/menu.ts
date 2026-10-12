import { Menu as AriaMenu, MenuItem, MenuTrigger } from '@angular/aria/menu';
import {
  CdkConnectedOverlay,
  type ConnectedPosition,
} from '@angular/cdk/overlay';
import {
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import {
  Button,
  type ButtonSize,
  type ButtonVariant,
} from '../../atoms/button/button.directive';
import { Icon } from '../../atoms/icon/icon';
import type { IconName } from '../../atoms/icon/icon-registry';
import { IconButton } from '../../atoms/icon-button/icon-button.directive';

export interface MenuItemEntry<V extends string = string> {
  readonly kind: 'item';
  readonly value: V;
  readonly label: string;
  readonly icon?: IconName;
  readonly tone?: 'danger';
  readonly disabled?: boolean;
}
export interface MenuSeparatorEntry {
  readonly kind: 'separator';
}
/** A non-interactive heading above a group of items. */
export interface MenuLabelEntry {
  readonly kind: 'label';
  readonly label: string;
}
export type MenuEntry<V extends string = string> =
  | MenuItemEntry<V>
  | MenuSeparatorEntry
  | MenuLabelEntry;

/** Below the trigger, right edge aligned, flipping above when there is no room (mockup `ui.menu`). */
const POSITIONS: ConnectedPosition[] = [
  {
    originX: 'end',
    originY: 'bottom',
    overlayX: 'end',
    overlayY: 'top',
    offsetY: 6,
  },
  {
    originX: 'end',
    originY: 'top',
    overlayX: 'end',
    overlayY: 'bottom',
    offsetY: -6,
  },
  {
    originX: 'start',
    originY: 'bottom',
    overlayX: 'start',
    overlayY: 'top',
    offsetY: 6,
  },
  {
    originX: 'start',
    originY: 'top',
    overlayX: 'start',
    overlayY: 'bottom',
    offsetY: -6,
  },
];

/**
 * Dropdown menu (the mockup's `ui.menu`) on the `@angular/aria` menu pattern: the pattern owns
 * arrow/Home/End/typeahead navigation, Enter/Space, Escape and focus return to the trigger; this
 * component adds the trigger button, the overlay placement and the look.
 *
 * `label` names the menu and the trigger. With `iconOnly` the trigger is a round icon button
 * (row actions); otherwise a button showing the label. `selected` emits the chosen item's value.
 */
@Component({
  selector: 'ui-menu',
  imports: [
    AriaMenu,
    MenuItem,
    MenuTrigger,
    CdkConnectedOverlay,
    Button,
    IconButton,
    Icon,
  ],
  host: { class: 'menu-anchor' },
  templateUrl: './menu.html',
})
export class Menu<V extends string = string> {
  readonly entries = input.required<readonly MenuEntry<V>[]>();
  readonly label = input.required<string>();
  readonly icon = input<IconName>();
  readonly iconOnly = input(false, { transform: booleanAttribute });
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('md');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly selected = output<V>();

  protected readonly positions = POSITIONS;
  protected readonly menu = viewChild<AriaMenu<V>>('menuRef');
  private readonly trigger = viewChild(MenuTrigger);
  protected readonly origin = viewChild(MenuTrigger, { read: ElementRef });
  protected readonly expanded = computed(
    () => this.trigger()?.expanded() ?? false,
  );

  protected choose(value: V | undefined): void {
    if (value !== undefined) this.selected.emit(value);
    this.trigger()?.close();
  }
}
