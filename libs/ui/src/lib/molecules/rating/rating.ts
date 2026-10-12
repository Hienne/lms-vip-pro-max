import {
  Component,
  ElementRef,
  computed,
  input,
  model,
  viewChildren,
} from '@angular/core';
import { Icon } from '../../atoms/icon/icon';

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Star rating input (the mockup's lesson rating): a radio group of five "n sao" radios with
 * roving focus. Arrow keys move and choose (wrapping at the ends), Home and End jump. `value` is
 * a two-way model, `0` meaning no choice yet.
 */
@Component({
  selector: 'ui-rating',
  imports: [Icon],
  host: { class: 'rating', role: 'radiogroup', '[attr.aria-label]': 'label()' },
  template: `
    @for (star of stars; track star) {
      <button
        #star
        type="button"
        role="radio"
        class="rating__star"
        [class.is-on]="star <= value()"
        [attr.aria-checked]="star === value()"
        [attr.aria-label]="star + ' ' + unit()"
        [tabindex]="star === tabStop() ? 0 : -1"
        (click)="choose(star)"
        (keydown)="navigate($event)"
      >
        <ui-icon name="star" />
      </button>
    }
  `,
})
export class Rating {
  /** Accessible name of the group, e.g. "Đánh giá từ 1 đến 5 sao". */
  readonly label = input.required<string>();
  /** Word after the number in each radio's name. */
  readonly unit = input('sao');
  readonly value = model(0);

  protected readonly stars = STARS;
  private readonly buttons =
    viewChildren<ElementRef<HTMLButtonElement>>('star');
  protected readonly tabStop = computed(() => this.value() || 1);

  protected choose(star: number): void {
    this.value.set(star);
  }

  protected navigate(event: KeyboardEvent): void {
    const current =
      this.buttons().findIndex((b) => b.nativeElement === event.currentTarget) +
      1;
    const next = {
      ArrowRight: (current % 5) + 1,
      ArrowDown: (current % 5) + 1,
      ArrowLeft: current <= 1 ? 5 : current - 1,
      ArrowUp: current <= 1 ? 5 : current - 1,
      Home: 1,
      End: 5,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    this.choose(next);
    this.buttons()[next - 1].nativeElement.focus();
  }
}
