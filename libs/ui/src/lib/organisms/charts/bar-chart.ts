import { booleanAttribute, Component, computed, input } from '@angular/core';

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
  readonly compact = input(false, { transform: booleanAttribute });
  protected readonly geometry = computed(() =>
    this.compact()
      ? { width: 720, height: 116, baseline: 111, range: 87 }
      : { width: 520, height: 190, baseline: 158, range: 118 },
  );
  protected readonly bars = computed(() => {
    const data = this.data();
    const { width: plotWidth, baseline, range } = this.geometry();
    const max = Math.max(
      1,
      this.max() ?? Math.max(...data.map((d) => d.value)),
    );
    const step = (plotWidth - 48) / Math.max(1, data.length);
    const stride = Math.max(1, Math.ceil((data.length - 1) / 7));
    return data.map((d, i) => {
      const last = i === data.length - 1;
      const height = (range * d.value) / max;
      return {
        ...d,
        x: 24 + i * step + step * 0.2,
        y: baseline - height,
        height,
        width: step * 0.6,
        center: 24 + (i + 0.5) * step,
        last,
        showLabel: i === 0 || last || (i % stride === 0 && i < data.length - 2),
      };
    });
  });
}
