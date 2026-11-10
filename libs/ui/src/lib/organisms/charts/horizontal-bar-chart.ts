import { Component, computed, input } from '@angular/core';
import type { BarDatum } from './bar-chart';
import { FmtNumPipe, FmtPctPipe } from '../../atoms/format/format.pipes';

/** Directly labelled comparisons that preserve long category names. */
@Component({
  selector: 'ui-horizontal-bar-chart',
  imports: [FmtNumPipe, FmtPctPipe],
  templateUrl: './horizontal-bar-chart.html',
  styleUrl: './horizontal-bar-chart.scss',
})
export class HorizontalBarChart {
  readonly data = input.required<readonly BarDatum[]>();
  readonly label = input('So sánh');
  readonly unit = input('');
  readonly max = input<number>();
  readonly danger = input(false);
  protected readonly bars = computed(() => {
    const ceiling = Math.max(
      1,
      this.max() ?? Math.max(...this.data().map((d) => d.value)),
    );
    return this.data().map((d) => ({
      ...d,
      width: Math.max(0, Math.min(100, (d.value / ceiling) * 100)),
    }));
  });
}
