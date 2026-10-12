import { Injectable, signal } from '@angular/core';
import type { QuestionCell } from '../../../../../../shared/quiz/question-grid';

/** Ten questions as in the mockup's demo: the first four answered, 3 and 7 flagged. */
const CELLS: readonly QuestionCell[] = Array.from({ length: 10 }, (_, i) => ({
  answered: i < 4,
  flagged: i === 2 || i === 6,
}));

@Injectable()
export class QuizDemoStore {
  private readonly state = {
    current: signal(4),
  };

  readonly cells$ = signal(CELLS).asReadonly();
  readonly current$ = this.state.current.asReadonly();

  setCurrent(index: number): void {
    this.state.current.set(index);
  }

  goto(index: number): void {
    this.setCurrent(index);
  }
}
