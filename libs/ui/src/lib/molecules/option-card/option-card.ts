import { Component, computed, input, booleanAttribute } from '@angular/core';
import { Badge } from '../../atoms/badge/badge.directive';
import { Icon } from '../../atoms/icon/icon';
import type { IconName } from '../../atoms/icon/icon-registry';

/** Review state of an answer row: the chosen/right answers are marked, the rest are neutral. */
export type OptionCardTone = 'correct' | 'wrong' | 'neutral';

const REVIEW_ICON: Record<OptionCardTone, IconName> = {
  correct: 'circle-check',
  wrong: 'circle-x',
  neutral: 'minus',
};

/**
 * A large, touch-friendly choice (the mockup's `.option-card` and `.answer`). Without `tone` it is
 * a `label` around the projected native radio or checkbox, so selection, keyboard and form binding
 * stay native: `<ui-option-card title="Bắt buộc"><input type="radio" name="kind" /></ui-option-card>`.
 * With `tone` it is a read-only review row: an icon and text say what happened, never colour alone.
 */
@Component({
  selector: 'ui-option-card',
  imports: [Badge, Icon],
  host: { class: 'option-card-host' },
  template: `
    @if (tone(); as tone) {
      <div class="answer" [class]="answerModifier()">
        <ui-icon
          size="sm"
          [name]="reviewIcon()"
          [label]="
            tone === 'correct'
              ? correctIconLabel()
              : tone === 'wrong'
                ? wrongIconLabel()
                : ''
          "
        />
        <span class="option-card__text">{{ title() }}</span>
        @if (chosen()) {
          <span class="answer__mark">{{ chosenLabel() }}</span>
        }
        @if (tone === 'correct') {
          <span class="answer__mark answer__mark--correct">{{
            correctLabel()
          }}</span>
        }
      </div>
    } @else {
      <!-- The associated control is the projected native input. -->
      <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
      <label class="option-card">
        <ng-content />
        @if (letter()) {
          <span uiBadge outline aria-hidden="true">{{ letter() }}</span>
        }
        <span class="option-card__text">
          <strong>{{ title() }}</strong>
          @if (description()) {
            <span class="option-card__description">{{ description() }}</span>
          }
        </span>
      </label>
    }
  `,
})
export class OptionCard {
  readonly title = input.required<string>();
  readonly description = input<string>();
  /** Optional letter badge, e.g. "A". */
  readonly letter = input<string>();
  /** Set to turn the card into a review row. */
  readonly tone = input<OptionCardTone>();
  /** Review row: the learner picked this option. */
  readonly chosen = input(false, { transform: booleanAttribute });
  readonly chosenLabel = input('Bạn chọn');
  readonly correctLabel = input('Đáp án đúng');
  readonly correctIconLabel = input('Đúng');
  readonly wrongIconLabel = input('Sai');

  protected readonly reviewIcon = computed(
    () => REVIEW_ICON[this.tone() ?? 'neutral'],
  );
  protected readonly answerModifier = computed(() => {
    const tone = this.tone();
    return tone === 'correct' || tone === 'wrong' ? `answer--${tone}` : '';
  });
}
