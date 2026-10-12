import {
  Component,
  DestroyRef,
  inject,
  input,
  numberAttribute,
  output,
} from '@angular/core';
import { Icon } from '../../atoms/icon/icon';
import { Input } from '../../atoms/input/input.directive';

/**
 * Search box (the mockup's `UI.Search`): a native `input type="search"` with a decorative search
 * icon. `query` fires once per typing pause (`debounce` ms) and immediately on Enter or when the
 * box is emptied, so a store receives one query per intent.
 */
@Component({
  selector: 'ui-search',
  imports: [Icon, Input],
  host: {
    class: 'input-icon search',
    '[style.width]': '"min(100%, " + width() + ")"',
  },
  template: `
    <ui-icon name="search" />
    <input
      uiInput
      type="search"
      [attr.aria-label]="label()"
      [placeholder]="placeholder()"
      [value]="value()"
      (input)="typed($event)"
      (keydown.enter)="flush($event)"
    />
  `,
})
export class Search {
  /** Accessible name of the input. */
  readonly label = input('Tìm kiếm');
  readonly placeholder = input('Tìm kiếm…');
  /** Initial text, e.g. the query restored from the route. */
  readonly value = input('');
  /** Any CSS length; the box never exceeds its container. */
  readonly width = input('280px');
  /** Pause in milliseconds before typing is emitted. */
  readonly debounce = input(300, { transform: numberAttribute });
  readonly query = output<string>();

  private pending: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  protected typed(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.cancel();
    if (text === '') {
      this.query.emit(text);
      return;
    }
    this.pending = setTimeout(() => {
      this.pending = undefined;
      this.query.emit(text);
    }, this.debounce());
  }

  protected flush(event: Event): void {
    this.cancel();
    this.query.emit((event.target as HTMLInputElement).value);
  }

  private cancel(): void {
    clearTimeout(this.pending);
    this.pending = undefined;
  }
}
