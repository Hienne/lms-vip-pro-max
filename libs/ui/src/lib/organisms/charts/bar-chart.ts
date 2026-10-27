import { Component, computed, input } from '@angular/core';

export interface BarDatum {
  readonly label: string;
  readonly value: number;
}
@Component({
  selector: 'ui-bar-chart',
  templateUrl: './bar-chart.html',
  styleUrl: './charts.scss',
})
export class BarChart {
  readonly data = input.required<readonly BarDatum[]>();
  readonly label = input('Biểu đồ cột');
  readonly unit = input('');
  readonly max = input<number>();
  protected readonly bars = computed(() => {
    const data = this.data(),
      max = Math.max(1, this.max() ?? Math.max(...data.map((d) => d.value))),
      width = 472 / Math.max(1, data.length);
    return data.map((d, i) => ({
      ...d,
      x: 24 + i * width + width * 0.2,
      y: 158 - (118 * d.value) / max,
      height: (118 * d.value) / max,
      width: width * 0.6,
      center: 24 + (i + 0.5) * width,
      last: i === data.length - 1,
    }));
  });
}
