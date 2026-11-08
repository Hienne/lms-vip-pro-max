import { Grid, GridCell, GridRow } from '@angular/aria/grid';
import { Component, computed, inject, input } from '@angular/core';
import type { HeatmapDay } from '@lms/contracts';
import { NOW, Tooltip } from '@lms/ui';

/** The shades of the one colour: 0 is no activity, 1 to 4 grow with lessons completed plus quizzes submitted. */
export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

interface HeatmapCell {
  readonly date: string;
  readonly level: HeatmapLevel;
  readonly restDay: boolean;
  readonly label: string;
  readonly today: boolean;
}

/** The only thing the app decides: which of four shades a day's count gets. The counts are the server's. */
export function levelOf(count: number): HeatmapLevel {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return count <= 4 ? 3 : 4;
}

/** The day's text equivalent, also its tooltip: "12/10: 3 bài học, 1 bài kiểm tra". */
export function dayLabel(day: HeatmapDay): string {
  const [, month, date] = day.date.split('-').map(Number);
  const parts = [
    day.lessons > 0 ? `${day.lessons} bài học` : '',
    day.quizzes > 0 ? `${day.quizzes} bài kiểm tra` : '',
  ].filter(Boolean);
  const when = `${date}/${month}`;
  if (parts.length === 0) {
    return `${when}: ${day.restDay ? 'ngày nghỉ' : 'chưa có hoạt động'}`;
  }
  return `${when}: ${parts.join(', ')}${day.restDay ? ' (ngày nghỉ)' : ''}`;
}

/** Monday is 0, Sunday 6. */
function weekdayOf(isoDate: string): number {
  const [year, month, date] = isoDate.split('-').map(Number);
  return (new Date(Date.UTC(year, month - 1, date)).getUTCDay() + 6) % 7;
}

/**
 * The activity heatmap: one square per day, a column per week, one colour in four shades by the day's
 * count, rest days hatched. The server supplies the days and which are rest days. Every day has a text
 * label, and the grid takes one tab stop with arrow keys between days; the label also opens as a tooltip
 * on focus.
 */
@Component({
  selector: 'app-activity-heatmap',
  imports: [Grid, GridRow, GridCell, Tooltip],
  templateUrl: './activity-heatmap.html',
  styleUrl: './activity-heatmap.scss',
})
export class ActivityHeatmap {
  readonly days = input.required<readonly HeatmapDay[]>();
  /** Names the grid for assistive technology. */
  readonly label = input('Hoạt động học theo ngày');

  private readonly now = inject(NOW);
  private readonly today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(this.now());

  protected readonly firstWeekday = computed(() => this.days().length ? weekdayOf(this.days()[0].date) : 0);

  protected readonly months = computed(() => {
    const days = this.days();
    if (!days.length) return [];
    const first = new Date(days[0].date + 'T00:00:00Z');
    const start = first.getTime() - weekdayOf(days[0].date) * 86400000;
    return days.filter((day, index) => index === 0 || day.date.endsWith('-01')).map((day) => {
      const date = new Date(day.date + 'T00:00:00Z');
      return { label: 'T' + (date.getUTCMonth() + 1), column: Math.floor((date.getTime() - start) / 604800000) + 1 };
    });
  });

  /** Seven rows, Monday first; each holds that weekday of every week, oldest first. */
  protected readonly rows = computed<HeatmapCell[][]>(() => {
    const rows: HeatmapCell[][] = Array.from({ length: 7 }, () => []);
    for (const day of this.days()) {
      rows[weekdayOf(day.date)].push({
        date: day.date,
        level: levelOf(day.lessons + day.quizzes),
        restDay: day.restDay,
        label: dayLabel(day),
        today: day.date === this.today,
      });
    }
    return rows;
  });
}
