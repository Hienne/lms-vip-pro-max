import { Component, computed, input } from '@angular/core';
import { Icon } from '../../atoms/icon/icon';

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Read-only star display (the mockup's `UI.Stars`): five star glyphs hidden from assistive
 * technology, the score with one decimal ("3,0"), an optional review count, and a visually hidden
 * sentence that carries the value.
 */
@Component({
  selector: 'ui-stars',
  imports: [Icon],
  host: { class: 'stars' },
  template: `
    <span class="stars__row" aria-hidden="true">
      @for (star of stars; track star) {
        <span class="stars__star" [class.stars__star--off]="star > rounded()">
          <ui-icon name="star" size="sm" />
        </span>
      }
    </span>
    <span class="stars__text" aria-hidden="true">
      <strong>{{ score() }}</strong>
      @if (count() !== undefined) {
        <span class="stars__count"> ({{ count() }} {{ countLabel() }})</span>
      }
    </span>
    <span class="sr-only">{{ sentence() }}</span>
  `,
})
export class Stars {
  /** Average score from 0 to 5. */
  readonly value = input.required<number>();
  readonly count = input<number>();
  /** Word after the review count. */
  readonly countLabel = input('đánh giá');
  /** Words after the score in the hidden sentence. */
  readonly scoreLabel = input('trên 5 sao');

  protected readonly stars = STARS;
  protected readonly rounded = computed(() => Math.round(this.value()));
  protected readonly sentence = computed(() => {
    const count = this.count();
    const base = `${this.score()} ${this.scoreLabel()}`;
    return count === undefined
      ? base
      : `${base}, ${count} ${this.countLabel()}`;
  });
  protected readonly score = computed(() =>
    this.value().toLocaleString('vi-VN', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  );
}
