import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { Listbox, Option } from '@angular/aria/listbox';
import {
  Component,
  computed,
  ElementRef,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { Button } from '../../atoms/button/button.directive';
import { Input } from '../../atoms/input/input.directive';
import { Icon } from '../../atoms/icon/icon';

export interface SearchSelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

/** Search is inside the popup; Angular Aria owns list navigation and selection. */
@Component({
  selector: 'ui-search-select',
  imports: [
    Button,
    Input,
    Icon,
    Listbox,
    Option,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    CdkTrapFocus,
  ],
  host: { class: 'search-select' },
  template: `
    <button
      #box
      uiButton
      cdkOverlayOrigin
      #anchor="cdkOverlayOrigin"
      type="button"
      class="search-select__trigger"
      [disabled]="disabled() || readonly()"
      [attr.aria-label]="label()"
      [attr.aria-invalid]="invalid() || null"
      aria-haspopup="dialog"
      [attr.aria-expanded]="opened()"
      (blur)="touched.set(true)"
      (click)="opened.set(!opened())"
    >
      <span class="search-select__value">{{ selectedLabel() }}</span
      ><ui-icon name="chevron-down" size="sm" />
    </button>
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="anchor"
      [cdkConnectedOverlayOpen]="opened()"
      [cdkConnectedOverlayWidth]="box.offsetWidth"
      [cdkConnectedOverlayHasBackdrop]="true"
      cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
      (backdropClick)="close()"
      (detach)="close()"
    >
      <section
        class="search-select__panel"
        role="dialog"
        [attr.aria-label]="label()"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (keydown.escape)="close(); $event.stopPropagation()"
        (keydown.enter)="$event.preventDefault()"
      >
        <input
          uiInput
          type="search"
          placeholder="Tìm trong danh sách…"
          [attr.aria-label]="'Tìm ' + label()"
          [value]="query()"
          (input)="search($event)"
          (keydown.arrowdown)="focusOptions($event)"
        />
        @if (loading()) {
          <p role="status">Đang tải đầy đủ danh sách…</p>
        }
        <div
          #list
          ngListbox
          class="search-select__options"
          [attr.aria-label]="label()"
          selectionMode="explicit"
          [value]="selection()"
          (valueChange)="choose($event)"
        >
          @for (option of filtered(); track option.value) {
            <div
              ngOption
              class="search-select__option"
              [value]="option.value"
              [label]="option.label"
              [disabled]="option.disabled ?? false"
            >
              <span>{{ option.label }}</span>
              @if (value() === option.value) {
                <ui-icon name="check" size="sm" />
              }
            </div>
          }
        </div>
        @if (!loading() && !filtered().length) {
          <p>Không có lựa chọn phù hợp.</p>
        }
      </section>
    </ng-template>
  `,
})
export class SearchSelect implements FormValueControl<string> {
  readonly value = model('');
  readonly touched = model(false);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly label = input.required<string>();
  readonly options = input.required<readonly SearchSelectOption[]>();
  readonly placeholder = input('Chọn một mục');
  readonly loading = input(false);
  readonly box = viewChild<ElementRef<HTMLButtonElement>>('box');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  protected readonly opened = signal(false);
  protected readonly query = signal('');
  protected readonly selection = computed(() =>
    this.value() ? [this.value()] : [],
  );
  protected readonly selectedLabel = computed(
    () =>
      this.options().find((o) => o.value === this.value())?.label ??
      this.placeholder(),
  );
  protected readonly filtered = computed(() => {
    const fold = (text: string) =>
      text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLocaleLowerCase('vi');
    return this.options().filter((o) =>
      fold(o.label).includes(fold(this.query().trim())),
    );
  });
  protected close(): void {
    this.opened.set(false);
    this.query.set('');
    this.touched.set(true);
  }
  protected search(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
  protected focusOptions(event: Event): void {
    event.preventDefault();
    this.list()?.nativeElement.focus();
  }
  protected choose(values: readonly string[]): void {
    const value = values[0];
    if (
      value === undefined ||
      this.disabled() ||
      this.readonly() ||
      this.options().find((o) => o.value === value)?.disabled
    )
      return;
    this.value.set(value);
    this.close();
  }
}
