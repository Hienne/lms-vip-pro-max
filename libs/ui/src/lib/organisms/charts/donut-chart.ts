import { Component, computed, input } from '@angular/core';
export interface DonutDatum {
  readonly label: string;
  readonly value: number;
  readonly tone: 'success' | 'primary' | 'neutral' | 'danger';
}
@Component({
  selector: 'ui-donut-chart',
  templateUrl: './donut-chart.html',
  styleUrl: './charts.scss',
})
export class DonutChart {
  readonly data = input.required<readonly DonutDatum[]>();
  readonly label = input('Trạng thái tham gia');
  protected readonly segments = computed(() => {
    const total = this.data().reduce((sum, d) => sum + d.value, 0) || 1;
    let offset = 0;
    return this.data().map((d) => {
      const length = (d.value / total) * 100;
      const item = {
        ...d,
        length,
        offset: -offset,
        percent: Math.round(length),
        css: `chart-view__segment--${d.tone}`,
      };
      offset += length;
      return item;
    });
  });
}
