import { Listbox, Option } from '@angular/aria/listbox';
import { Component, computed, input, model } from '@angular/core';
import { Icon } from '../../atoms/icon/icon';
import type { IconName } from '../../atoms/icon/icon-registry';

export interface SegmentedOption<V extends string = string> {
  readonly value: V;
  readonly label: string;
  readonly icon?: IconName;
}

/**
 * Single-choice toggle (the mockup's `UI.Segmented`), built on the `@angular/aria` listbox: one
 * option is selected at a time, arrow keys move and select, assistive technology hears a list box
 * of options with the current one selected. `value` is a two-way model.
 */
@Component({
  selector: 'ui-segmented',
  imports: [Listbox, Option, Icon],
  host: { class: 'segmented' },
  template: `
    <div
      ngListbox
      class="segmented__list"
      orientation="horizontal"
      selectionMode="follow"
      [attr.aria-label]="label()"
      [value]="selection()"
      (valueChange)="choose($event)"
    >
      @for (option of options(); track option.value) {
        <div
          ngOption
          class="segmented__option"
          [value]="option.value"
          [label]="option.label"
        >
          @if (option.icon) {
            <ui-icon [name]="option.icon" size="sm" />
          }
          {{ option.label }}
        </div>
      }
    </div>
  `,
})
export class Segmented<V extends string = string> {
  readonly options = input.required<readonly SegmentedOption<V>[]>();
  /** Accessible name of the group, e.g. "Giao diện". */
  readonly label = input.required<string>();
  readonly value = model.required<V>();

  protected readonly selection = computed(() => [this.value()]);

  protected choose(values: readonly V[]): void {
    const [next] = values;
    if (next !== undefined && next !== this.value()) this.value.set(next);
  }
}
