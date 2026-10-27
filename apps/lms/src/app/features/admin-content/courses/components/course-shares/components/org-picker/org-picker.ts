import {
  Combobox,
  ComboboxPopup,
  ComboboxWidget,
} from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Field, Input } from '@lms/ui';
import type { OrgOption } from '../../data-access/course-shares.store';

/** Pause after the last keystroke before the search is asked for. */
const SEARCH_PAUSE_MS = 300;

/**
 * Picks one unit by searching: a text box and, under it, the units that match. It is the
 * `@angular/aria` combobox over a listbox, so the arrow keys move through the units, Enter picks
 * one and a screen reader hears a combobox with options. It owns no data: the owner reads the
 * units for each query it is told about and hands them back as `options`.
 */
@Component({
  selector: 'app-org-picker',
  imports: [
    Combobox,
    ComboboxPopup,
    ComboboxWidget,
    Field,
    Input,
    Listbox,
    Option,
  ],
  templateUrl: './org-picker.html',
  styleUrl: './org-picker.scss',
})
export class OrgPicker {
  readonly options = input.required<readonly OrgOption[]>();
  /** The unit picked, or none. */
  readonly selected = input<OrgOption | null>(null);
  readonly busy = input(false);
  /** Why the units could not be read. */
  readonly error = input<string>();

  /** The query, once typing has paused. */
  readonly queried = output<string>();
  /** A unit, or `null` once the text no longer names the one picked. */
  readonly picked = output<OrgOption | null>();

  protected readonly text = signal('');
  protected readonly chosen = computed(() => {
    const id = this.selected()?.id;
    return id === undefined ? [] : [id];
  });

  private pending: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.pending));
  }

  protected typed(text: string): void {
    this.text.set(text);
    const selected = this.selected();
    if (selected && selected.name !== text) this.picked.emit(null);
    clearTimeout(this.pending);
    this.pending = setTimeout(() => this.queried.emit(text), SEARCH_PAUSE_MS);
  }

  protected choose(ids: readonly number[]): void {
    const option = this.options().find((o) => o.id === ids.at(-1));
    if (!option) return;
    clearTimeout(this.pending);
    this.text.set(option.name);
    this.picked.emit(option);
  }
}
