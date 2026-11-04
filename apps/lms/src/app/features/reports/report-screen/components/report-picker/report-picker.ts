import {
  Combobox,
  ComboboxPopup,
  ComboboxWidget,
} from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import {
  afterRenderEffect,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { Field, Icon, IconButton, Input } from '@lms/ui';

/** One entity a report can be filtered by: a unit, a team, a course or a quiz. */
export interface ReportPickerOption {
  readonly id: number;
  readonly name: string;
  /** The code shown before the name, so two courses with one name can be told apart. */
  readonly meta?: string;
}

/** Pause after the last keystroke before the search is asked for. */
const SEARCH_PAUSE_MS = 300;

let nextId = 0;

/** "code · name", or the name alone. */
export function optionLabel(option: ReportPickerOption): string {
  return option.meta ? `${option.meta} · ${option.name}` : option.name;
}

/**
 * Picks one report filter by name: a text box and, under it while open, the matches. It is the
 * `@angular/aria` combobox over a listbox (the `org-picker` pattern), so the arrow keys move,
 * Enter picks, Escape closes and "Xóa" clears the choice. It owns no data: the owner reads the
 * matches for each query it is told about and hands them back as `options`.
 */
@Component({
  selector: 'app-report-picker',
  imports: [
    Combobox,
    ComboboxPopup,
    ComboboxWidget,
    Field,
    Icon,
    IconButton,
    Input,
    Listbox,
    Option,
  ],
  templateUrl: './report-picker.html',
  styleUrl: './report-picker.scss',
})
export class ReportPicker {
  readonly label = input.required<string>();
  readonly options = input.required<readonly ReportPickerOption[]>();
  /** The option picked, or none. */
  readonly selected = input<ReportPickerOption | null>(null);
  readonly busy = input(false);
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Why the picker is disabled, shown as its hint. */
  readonly disabledReason = input('');
  /** Why the choice cannot be used, such as an id from the URL outside the user's scope. */
  readonly error = input<string>();
  readonly required = input(false, { transform: booleanAttribute });
  /** What leaving it empty means, shown in the empty box ("Tất cả khóa học"). */
  readonly emptyLabel = input('');

  /** The query, once typing has paused. */
  readonly queried = output<string>();
  /** An option, or `null` once the choice is cleared. */
  readonly picked = output<ReportPickerOption | null>();

  /** What the box shows: the picked option, until the user types over it. */
  protected readonly text = linkedSignal(() => {
    const selected = this.selected();
    return selected ? optionLabel(selected) : '';
  });
  protected readonly chosen = computed(() => {
    const id = this.selected()?.id;
    return id === undefined ? [] : [id];
  });
  /** "Xóa" clears a choice, or one reported as not found. */
  protected readonly clearable = computed(
    () => (!!this.selected() || !!this.error()) && !this.disabled(),
  );
  protected readonly label$ = optionLabel;
  protected readonly errorId = `report-picker-${nextId++}-error`;

  private readonly box = viewChild.required('box', { read: ElementRef });
  private pending: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.pending));
    // `ui-field` only links the errors of a form field, so the picker's own error is linked here,
    // after the field has written its hint and error ids (the read phase runs last).
    afterRenderEffect({
      read: () => {
        const error = this.error();
        this.disabled();
        const box = this.box().nativeElement as HTMLInputElement;
        const tokens = (box.getAttribute('aria-describedby') ?? '')
          .split(' ')
          .filter((token) => token && token !== this.errorId);
        if (error) tokens.push(this.errorId);
        setAttribute(box, 'aria-describedby', tokens.join(' '));
        setAttribute(box, 'aria-invalid', error ? 'true' : null);
      },
    });
  }

  protected typed(text: string): void {
    this.text.set(text);
    clearTimeout(this.pending);
    this.pending = setTimeout(() => this.queried.emit(text), SEARCH_PAUSE_MS);
  }

  protected choose(ids: readonly number[]): void {
    const option = this.options().find((o) => o.id === ids.at(-1));
    if (!option) return;
    clearTimeout(this.pending);
    this.text.set(optionLabel(option));
    this.picked.emit(option);
  }

  protected clear(): void {
    clearTimeout(this.pending);
    this.text.set('');
    this.picked.emit(null);
  }
}

function setAttribute(el: HTMLElement, name: string, value: string | null) {
  if (value) el.setAttribute(name, value);
  else el.removeAttribute(name);
}
