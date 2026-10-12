import { Component, computed, input } from '@angular/core';
import { Icon, Mai } from '@lms/ui';

export interface JourneyStop {
  readonly name: string;
  /** Progress through the stop's courses, 0 to 100. */
  readonly pct: number;
  /** Number of courses in the stop. */
  readonly courses: number;
}

type StopState = 'done' | 'current' | 'upcoming';

interface StopView extends JourneyStop {
  readonly state: StopState;
  readonly number: number;
  readonly progressText: string;
}

/**
 * The learner's route through a program (the mockup's `UI.Journey`): one stop per step with its
 * name and progress always visible. A stop is done at 100%; it is current when it has started, or
 * when every stop before it is done. The mai flower marks a current stop.
 */
@Component({
  selector: 'app-journey',
  imports: [Icon, Mai],
  templateUrl: './journey.html',
  styleUrl: './journey.scss',
})
export class Journey {
  readonly stops = input.required<readonly JourneyStop[]>();

  protected readonly items = computed((): readonly StopView[] =>
    this.stops().map((stop, index, all) => {
      const done = stop.pct >= 100;
      const earlierDone = all
        .slice(0, index)
        .every((other) => other.pct >= 100);
      const state: StopState = done
        ? 'done'
        : earlierDone || stop.pct > 0
          ? 'current'
          : 'upcoming';
      return {
        ...stop,
        state,
        number: index + 1,
        progressText: done
          ? 'Hoàn thành'
          : stop.pct > 0
            ? `${stop.pct}%`
            : 'Chưa bắt đầu',
      };
    }),
  );
}
