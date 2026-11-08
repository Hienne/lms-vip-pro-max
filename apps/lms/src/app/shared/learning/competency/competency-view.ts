import { Component, computed, input, signal } from '@angular/core';
import type { MyCompetency } from '@lms/contracts';
import { Empty, FmtPctPipe, Progress, RadarChart, Tooltip } from '@lms/ui';
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
  imports: [Empty, FmtPctPipe, Progress, RadarChart, Tooltip],
  templateUrl: './competency-view.html',
  styleUrl: './competency-view.scss',
  host: {
    '[class.competency-view--compact]': "size() === 'compact'",
    '[class.competency-view--large]': "size() === 'large'",
    '[class.competency-view--has-radar]': 'showRadar()',
  },
})
export class CompetencyView {
  readonly rows = input.required<readonly MyCompetency[]>();
  readonly size = input<CompetencyViewSize>('compact');

  protected readonly expandedName = signal<number | null>(null);
  protected readonly digits = PERCENT_DIGITS;

  protected toggleName(id: number): void {
    this.expandedName.update((current) => (current === id ? null : id));
  }
  protected readonly rowsWithData = computed(() => withData(this.rows()));
  protected readonly showRadar = computed(
    () => this.rowsWithData().length >= MIN_RADAR_AXES,
  );
  protected readonly radarData = computed(() => toRadarData(this.rows()));
  protected readonly rankedRows = computed(() =>
    [...this.rowsWithData()].sort((a, b) => b.percent - a.percent),
  );
}
