import { Component, computed, input, output } from '@angular/core';

/** What the grid shows about one question. */
export interface QuestionCell {
  readonly answered: boolean;
  readonly flagged: boolean;
}

interface CellView {
  readonly number: number;
  readonly answered: boolean;
  readonly flagged: boolean;
  readonly name: string;
}

/**
 * The quiz's question navigator (the mockup's `.q-grid`): one numbered button per question,
 * marked answered, flagged for review, and current. Each button is named "Câu 3, đã trả lời, đã
 * đánh dấu" so no state is colour alone. It holds no state: the quiz store owns the answers, and
 * `goto` reports the zero-based index to jump to.
 */
@Component({
  selector: 'app-question-grid',
  templateUrl: './question-grid.html',
  styleUrl: './question-grid.scss',
})
export class QuestionGrid {
  readonly cells = input.required<readonly QuestionCell[]>();
  /** Zero-based index of the question on screen. */
  readonly current = input.required<number>();
  readonly goto = output<number>();

  protected readonly items = computed((): readonly CellView[] =>
    this.cells().map((cell, index) => ({
      ...cell,
      number: index + 1,
      name: [
        `Câu ${index + 1}`,
        cell.answered ? 'đã trả lời' : 'chưa trả lời',
        ...(cell.flagged ? ['đã đánh dấu'] : []),
      ].join(', '),
    })),
  );
}
