import { Directive, model } from '@angular/core';

/**
 * A filter chip on a native `<button>`. With `pressed` bound it is a toggle: `aria-pressed`
 * reflects the state and a click flips it (`[(pressed)]` for two-way). Without `pressed` it is a
 * plain button and carries no `aria-pressed`.
 */
@Directive({
  selector: 'button[uiChip]',
  host: {
    class: 'chip',
    type: 'button',
    '[attr.aria-pressed]': 'pressed() === undefined ? null : pressed()',
    '(click)': 'toggle()',
  },
})
export class Chip {
  readonly pressed = model<boolean | undefined>(undefined);

  protected toggle(): void {
    const pressed = this.pressed();
    if (pressed !== undefined) this.pressed.set(!pressed);
  }
}
