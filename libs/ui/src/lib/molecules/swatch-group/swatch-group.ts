import { Listbox, Option } from '@angular/aria/listbox';
import { Component, computed, input, model } from '@angular/core';
import { Icon } from '../../atoms/icon/icon';

/** The two colours of a swatch, as colour token keys (`--color-<key>`), never literals. */
export interface Swatch {
  /** The dot. */
  readonly fill: string;
  /** The ring around the dot. */
  readonly base: string;
}

export interface SwatchOption<V extends string = string> {
  readonly value: V;
  readonly label: string;
  readonly swatch: Swatch;
}

/**
 * Vertical single-choice list of colour swatches, built on the `@angular/aria` listbox like
 * `ui-segmented`: one option is selected at a time, arrow keys move and select, assistive
 * technology hears a list box with the current option selected. The swatch is decorative; the
 * label names the option. `value` is a two-way model.
 */
@Component({
  selector: 'ui-swatch-group',
  imports: [Listbox, Option, Icon],
  host: { class: 'swatch-group' },
  template: `
    <div
      ngListbox
      class="swatch-group__list"
      orientation="vertical"
      selectionMode="follow"
      [attr.aria-label]="label()"
      [value]="selection()"
      (valueChange)="choose($event)"
    >
      @for (option of options(); track option.value) {
        <div
          ngOption
          class="swatch-group__option"
          [value]="option.value"
          [label]="option.label"
        >
          <span
            class="swatch-group__swatch"
            aria-hidden="true"
            [style.--swatch-fill]="tokenVar(option.swatch.fill)"
            [style.--swatch-base]="tokenVar(option.swatch.base)"
          ></span>
          <span class="swatch-group__label">{{ option.label }}</span>
          <ui-icon class="swatch-group__check" name="check" size="sm" />
        </div>
      }
    </div>
  `,
})
export class SwatchGroup<V extends string = string> {
  readonly options = input.required<readonly SwatchOption<V>[]>();
  /** Accessible name of the group, e.g. "Bảng màu". */
  readonly label = input.required<string>();
  readonly value = model.required<V>();

  protected readonly selection = computed(() => [this.value()]);

  protected tokenVar(key: string): string {
    return `var(--color-${key})`;
  }

  protected choose(values: readonly V[]): void {
    const [next] = values;
    if (next !== undefined && next !== this.value()) this.value.set(next);
  }
}
