import { Component, computed, input } from '@angular/core';
import type { MyCompetency } from '@lms/contracts';
import { Empty, FmtPctPipe, RadarChart } from '@lms/ui';
import { toRadarData, withData } from './competency-data';

export type CompetencyViewSize = 'compact' | 'large';

/** A radar needs at least this many axes to read as a shape. */
const MIN_RADAR_AXES = 3;
/** The server's percents have up to two decimals. */
const PERCENT_DIGITS = 2;

/**
 * The learner's competencies as the server returned them: a radar from three competencies with data,
 * a short list for one or two, and an inline empty state for none. It renders and never fetches.
 */
@Component({
  selector: 'app-competency-view',
  imports: [Empty, FmtPctPipe, RadarChart],
  templateUrl: './competency-view.html',
  styleUrl: './competency-view.scss',
  host: {
    '[class.competency-view--compact]': "size() === 'compact'",
    '[class.competency-view--large]': "size() === 'large'",
  },
})
export class CompetencyView {
  readonly rows = input.required<readonly MyCompetency[]>();
  readonly size = input<CompetencyViewSize>('compact');

  protected readonly digits = PERCENT_DIGITS;
  protected readonly rowsWithData = computed(() => withData(this.rows()));
  protected readonly showRadar = computed(
    () => this.rowsWithData().length >= MIN_RADAR_AXES,
  );
  protected readonly radarData = computed(() => toRadarData(this.rows()));
}
