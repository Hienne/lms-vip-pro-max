import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { Component, computed, input, model, signal } from '@angular/core';
import { Button } from '../../atoms/button/button.directive';
import { Checkbox } from '../../atoms/checkbox/checkbox.directive';
import { Icon } from '../../atoms/icon/icon';
import { Input } from '../../atoms/input/input.directive';

export interface MultiSelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}
let nextId = 0;

/** A dropdown of native checkboxes; the CDK contains keyboard focus and restores it on close. */
@Component({
  selector: 'ui-multi-select',
  imports: [
    Button,
    Checkbox,
    Icon,
    Input,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    CdkTrapFocus,
  ],
  host: { class: 'multi-select' },
  template: `
    <button
      #trigger
      cdkOverlayOrigin
      #anchor="cdkOverlayOrigin"
      uiButton
      type="button"
      class="multi-select__trigger"
      [disabled]="disabled()"
      [attr.aria-label]="label()"
      aria-haspopup="dialog"
      [attr.aria-expanded]="opened()"
      [attr.aria-controls]="opened() ? panelId : null"
      (click)="toggle()"
    >
      <span class="multi-select__value">{{ summary() }}</span
      ><ui-icon name="chevron-down" size="sm" />
    </button>
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="anchor"
      [cdkConnectedOverlayOpen]="opened()"
      [cdkConnectedOverlayWidth]="trigger.offsetWidth"
      [cdkConnectedOverlayHasBackdrop]="true"
      cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
      (backdropClick)="close()"
      (detach)="close()"
    >
      <section
        class="multi-select__panel"
        role="dialog"
        [id]="panelId"
        [attr.aria-label]="label()"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (keydown.escape)="close(); $event.stopPropagation()"
      >
        <input
          uiInput
          type="search"
          placeholder="Tìm trong danh sách…"
          [attr.aria-label]="'Tìm ' + label()"
          [value]="query()"
          (input)="search($event)"
          (keydown.enter)="$event.preventDefault()"
        />
        <div
          class="multi-select__options"
          role="group"
          [attr.aria-label]="label()"
        >
          @for (option of filtered(); track option.value) {
            <label class="multi-select__option"
              ><input
                uiCheckbox
                type="checkbox"
                [checked]="value().includes(option.value)"
                [disabled]="
                  option.disabled ||
                  (value().length >= limit() && !value().includes(option.value))
                "
                (change)="choose(option, $event)"
              /><span>{{ option.label }}</span></label
            >
          } @empty {
            <p>Không có lựa chọn phù hợp.</p>
          }
        </div>
        <button uiButton type="button" size="sm" (click)="close()">
          Xong · {{ value().length }} đã chọn
        </button>
      </section>
    </ng-template>
  `,
})
export class MultiSelect {
  readonly label = input.required<string>();
  readonly options = input.required<readonly MultiSelectOption[]>();
  readonly value = model<readonly string[]>([]);
  readonly placeholder = input('Chọn nhiều mục');
  readonly disabled = input(false);
  readonly limit = input(Number.MAX_SAFE_INTEGER);
  protected readonly panelId = `multi-select-${++nextId}`;
  protected readonly opened = signal(false);
  protected readonly query = signal('');
  protected readonly filtered = computed(() =>
    this.options().filter((option) =>
      option.label
        .toLocaleLowerCase('vi')
        .includes(this.query().trim().toLocaleLowerCase('vi')),
    ),
  );
  protected readonly summary = computed(() => {
    if (!this.value().length) return this.placeholder();
    const names = this.options()
      .filter((option) => this.value().includes(option.value))
      .map((option) => option.label);
    return names.length === 1 ? names[0] : `${this.value().length} đã chọn`;
  });
  protected toggle(): void {
    if (!this.disabled()) this.opened.update((open) => !open);
  }
  protected close(): void {
    this.opened.set(false);
    this.query.set('');
  }
  protected search(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
  protected choose(option: MultiSelectOption, event: Event): void {
    if (option.disabled || this.disabled()) return;
    const selected = new Set(this.value());
    if ((event.target as HTMLInputElement).checked) {
      if (selected.size >= this.limit()) return;
      selected.add(option.value);
    } else selected.delete(option.value);
    this.value.set([...selected]);
  }
}
