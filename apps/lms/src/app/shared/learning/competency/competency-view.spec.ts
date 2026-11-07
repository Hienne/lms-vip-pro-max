import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { MyCompetency } from '@lms/contracts';
import { CompetencyView, type CompetencyViewSize } from './competency-view';

const row = (
  id: number,
  name: string,
  percent: number | null,
): MyCompetency => ({
  competencyId: id,
  code: `C${id}`,
  name,
  totalQuestions: percent === null ? 0 : 7,
  correctCount: percent === null ? 0 : 1,
  maxScore: percent === null ? 0 : 9,
  score: percent === null ? 0 : 1,
  percent,
});

@Component({
  imports: [CompetencyView],
  template: `<app-competency-view [rows]="rows()" [size]="size()" />`,
})
class Host {
  readonly rows = signal<readonly MyCompetency[]>([]);
  readonly size = signal<CompetencyViewSize>('compact');
}

async function render(rows: readonly MyCompetency[]) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.rows.set(rows);
  await fixture.whenStable();
  return {
    fixture,
    root: fixture.nativeElement as HTMLElement,
  };
}

describe('CompetencyView', () => {
  it('shows the inline empty state when no row has data', async () => {
    const { root } = await render([row(1, 'Rủi ro', null)]);
    expect(root.querySelector('ui-radar-chart')).toBeNull();
    expect(root.querySelector('.competency-view__list')).toBeNull();
    expect(root.querySelector('ui-empty')?.textContent).toContain(
      'Chưa có dữ liệu năng lực. Biểu đồ sẽ có sau khi bạn làm bài kiểm tra.',
    );
  });

  it('shows the empty state for no rows at all', async () => {
    const { root } = await render([]);
    expect(root.querySelector('ui-empty')).not.toBeNull();
  });

  it('lists every row as name, correct answers and percent when fewer than three have data', async () => {
    const { root } = await render([
      row(1, 'Kiến trúc', 14.29),
      row(2, 'Rủi ro', null),
      row(3, 'Vận hành', 11.11),
    ]);
    expect(root.querySelector('ui-radar-chart')).toBeNull();
    expect(root.querySelector('ui-empty')).toBeNull();
    const items = Array.from(
      root.querySelectorAll('.competency-view__item'),
    ).map((tr) => Array.from(tr.children).map((c) => c.textContent?.trim()));
    expect(items).toEqual([
      ['Kiến trúc', '1/7', '14,29%'],
      ['Rủi ro', '—', 'Chưa có dữ liệu'],
      ['Vận hành', '1/7', '11,11%'],
    ]);
  });

  it('shows the radar from three rows with data, with the every-attempt caption', async () => {
    const { root } = await render([
      row(1, 'Kiến trúc', 14.29),
      row(2, 'Vận hành', 11.11),
      row(3, 'Kiểm soát', 33.33),
    ]);
    expect(root.querySelector('.competency-view__item')).toBeNull();
    expect(root.querySelector('ui-empty')).toBeNull();
    expect(root.querySelector('.chart-view__legend')?.textContent).toContain(
      'Tỷ lệ điểm trên các lượt thi đã chấm',
    );
    expect(root.querySelectorAll('circle')).toHaveLength(3);
    const highlights = Array.from(
      root.querySelectorAll('.competency-view__disclosure tbody tr'),
    ).map((tr) => Array.from(tr.children).map((c) => c.textContent?.trim()));
    expect(highlights).toEqual([
      ['Cao nhất', 'Kiểm soát', '1/7', '33,33%'],
      ['Thấp nhất', 'Vận hành', '1/7', '11,11%'],
    ]);
  });

  it('shows the radar and the full list at the large size', async () => {
    const { fixture, root } = await render([
      row(1, 'Kiến trúc', 14.29),
      row(2, 'Vận hành', 11.11),
      row(3, 'Kiểm soát', 33.33),
    ]);
    fixture.componentInstance.size.set('large');
    await fixture.whenStable();
    expect(root.querySelector('ui-radar-chart')).not.toBeNull();
    expect(root.querySelector('.competency-view__disclosure')).toBeNull();
    expect(root.querySelectorAll('.competency-view__item')).toHaveLength(3);
  });

  it('keeps a row without data as an axis, but does not count it towards the three', async () => {
    const two = await render([
      row(1, 'A', 10),
      row(2, 'B', 20),
      row(3, 'C', null),
    ]);
    expect(two.root.querySelector('ui-radar-chart')).toBeNull();

    const three = await render([
      row(1, 'A', 10),
      row(2, 'B', 20),
      row(3, 'D', 30),
      row(4, 'C', null),
    ]);
    expect(three.root.querySelectorAll('circle')).toHaveLength(4);
    three.fixture.componentInstance.size.set('large');
    await three.fixture.whenStable();
    const list = three.root.querySelectorAll('.competency-view__item');
    expect(list).toHaveLength(4);
    expect(list[3].textContent).toContain('Chưa có dữ liệu');
  });

  it('marks its size on the host', async () => {
    const { fixture, root } = await render([row(1, 'A', 10)]);
    const host = root.querySelector('app-competency-view') as HTMLElement;
    expect(host.classList).toContain('competency-view--compact');
    fixture.componentInstance.size.set('large');
    await fixture.whenStable();
    expect(host.classList).toContain('competency-view--large');
    expect(host.classList).not.toContain('competency-view--compact');
  });
});
