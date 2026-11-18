import { Component, computed, input, output } from '@angular/core';
import type { DraftingCard as DraftingCardState } from '@lms/contracts';
import { Button } from '@lms/ui';

/** What the card says instead of a button, by the step's state now. */
const NOTES: Partial<Record<DraftingCardState['state'], string>> = {
  confirmed: 'Đã chốt bước này.',
  proposing: 'Trợ lý đang soạn lại bước này.',
  failed: 'Bước này chưa soạn được.',
};

/**
 * The "Đã chốt" card under a step message of a drafting session. Its state is the step's on the
 * server, read with the conversation: a step waiting for the author offers "Đã chốt", a failed one
 * "Mở trang soạn", and a settled or re-proposed one says so. It reports the click; the store
 * decides whether the open editor confirms or the editor opens.
 */
@Component({
  selector: 'app-drafting-card',
  imports: [Button],
  templateUrl: './drafting-card.html',
  styleUrl: './drafting-card.scss',
})
export class DraftingCard {
  readonly card = input.required<DraftingCardState>();
  readonly confirmed = output<DraftingCardState>();
  readonly opened = output<DraftingCardState>();

  /** The step waits for the author: the assistant proposed it, or the author fills it. */
  protected readonly confirmable = computed(() => {
    const { state } = this.card();
    return state === 'proposed' || state === 'manual';
  });

  protected readonly note = computed(() => NOTES[this.card().state] ?? null);
}
