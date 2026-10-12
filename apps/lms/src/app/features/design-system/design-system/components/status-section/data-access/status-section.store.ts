import { computed, Injectable, signal } from '@angular/core';

const CHIPS = [
  { id: 'selected', label: 'Đang chọn' },
  { id: 'ops', label: 'Vận hành' },
  { id: 'change', label: 'Quản lý thay đổi' },
] as const;

@Injectable()
export class StatusSectionStore {
  private readonly state = {
    pressedChips: signal<readonly string[]>(['selected']),
  };

  readonly pressedChips$ = this.state.pressedChips.asReadonly();

  readonly chips$ = computed(() =>
    CHIPS.map((chip) => ({
      ...chip,
      pressed: this.pressedChips$().includes(chip.id),
    })),
  );

  private setPressedChips(ids: readonly string[]): void {
    this.state.pressedChips.set(ids);
  }

  setChip(id: string, pressed: boolean | undefined): void {
    const others = this.pressedChips$().filter((chip) => chip !== id);
    this.setPressedChips(pressed ? [...others, id] : others);
  }
}
