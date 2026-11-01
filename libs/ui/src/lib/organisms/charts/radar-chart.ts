import { Component, computed, input } from '@angular/core';
import { FmtPctPipe } from '../../atoms/format/format.pipes';
import { Table } from '../../atoms/table/table.directive';

export interface RadarDatum {
  readonly name: string;
  readonly value: number | null;
}

/** SVG counterpart of the mockup radar; missing values stay explicit in the data table. */
@Component({
  selector: 'ui-radar-chart',
  imports: [FmtPctPipe, Table],
  templateUrl: './radar-chart.html',
  styleUrl: './charts.scss',
})
export class RadarChart {
  readonly data = input.required<readonly RadarDatum[]>();
  readonly label = input('Biểu đồ năng lực');
  readonly seriesLabel = input('Của bạn (lần thi tốt nhất)');
  /** Decimals kept in a value: the server's percents have up to two. */
  protected readonly digits = 2;
  protected readonly geometry = computed(() => {
    const data = this.data();
    const point = (i: number, value: number) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(data.length, 1);
      return {
        x: 220 + (Math.cos(angle) * 98 * value) / 100,
        y: 156 + (Math.sin(angle) * 98 * value) / 100,
      };
    };
    const polygon = (values: readonly number[]) =>
      values
        .map((v, i) => {
          const p = point(i, v);
          return `${p.x},${p.y}`;
        })
        .join(' ');
    return {
      rings: [25, 50, 75, 100].map((v) => polygon(data.map(() => v))),
      polygon: polygon(data.map((d) => d.value ?? 0)),
      axes: data.map((d, i) => {
        const end = point(i, 100),
          text = point(i, 120),
          dot = point(i, d.value ?? 0);
        const words = d.name.split(' '),
          split = Math.ceil(words.length / 2);
        return {
          ...d,
          end,
          text,
          dot,
          lines:
            d.name.length > 14
              ? [words.slice(0, split).join(' '), words.slice(split).join(' ')]
              : [d.name],
          anchor:
            Math.abs(text.x - 220) < 10
              ? 'middle'
              : text.x > 220
                ? 'start'
                : 'end',
        };
      }),
    };
  });
}
