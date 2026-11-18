import { Component, input } from '@angular/core';
import type { CompetencyReview } from '@lms/contracts';
import { FmtPctPipe, List, ListRow } from '@lms/ui';

/** Each item opens its lesson with the quick questions already showing. */
export const REVIEW_LINK_QUERY = { checkpoint: '1' } as const;

/**
 * "Ôn lại" for weak competencies: per competency, the lessons its mistakes come from. Every lesson
 * opens with `?checkpoint=1`, so the learner lands on recall questions rather than rereading. It
 * renders what the server returned and never fetches.
 */
@Component({
  selector: 'app-review-suggestions',
  imports: [FmtPctPipe, List, ListRow],
  templateUrl: './review-suggestions.html',
  styleUrl: './review-suggestions.scss',
})
export class ReviewSuggestions {
  readonly items = input.required<readonly CompetencyReview[]>();
  /** Shows each competency's name and percent above its lessons; off when the card names it already. */
  readonly named = input(true);

  protected readonly query = REVIEW_LINK_QUERY;
}
