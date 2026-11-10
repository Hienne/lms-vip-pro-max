import {
  booleanAttribute,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { Button, Field, Select } from '@lms/ui';

/** One entity a report can be filtered by: a unit, a team, a course or a quiz. */
export interface ReportPickerOption {
  readonly id: number;
  readonly name: string;
  readonly meta?: string;
}

export function optionLabel(option: ReportPickerOption): string {
  return option.meta ? `${option.meta} · ${option.name}` : option.name;
}

@Component({
  selector: 'app-report-picker',
  imports: [Button, Field, Select],
  templateUrl: './report-picker.html',
})
export class ReportPicker {
  readonly label = input.required<string>();
  readonly emptyLabel = input.required<string>();
  readonly options = input.required<readonly ReportPickerOption[]>();
  readonly selected = input<ReportPickerOption | null>(null);
  readonly busy = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly disabledReason = input('');
  readonly error = input<string>();
  readonly loadFailed = input(false);
  readonly required = input(false, { transform: booleanAttribute });
  readonly picked = output<ReportPickerOption | null>();
  readonly retried = output<void>();

  protected readonly hint = computed(
    () =>
      this.error() ??
      (this.disabled()
        ? this.disabledReason()
        : this.loadFailed()
          ? 'Không tải được danh sách.'
          : this.busy()
            ? 'Đang tải danh sách…'
            : !this.options().length
              ? 'Không có lựa chọn trong phạm vi này.'
              : ''),
  );
  protected readonly items = computed(() => {
    const selected = this.selected();
    const options = this.options();
    return selected && !options.some((option) => option.id === selected.id)
      ? [selected, ...options]
      : options;
  });
  protected readonly optionLabel = optionLabel;

  protected choose(value: string): void {
    if (value === '') this.picked.emit(null);
    else {
      const match = this.items().find((option) => String(option.id) === value);
      if (match) this.picked.emit(match);
    }
  }
}
