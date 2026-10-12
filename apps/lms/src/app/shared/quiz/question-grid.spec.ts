import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QuestionGrid, type QuestionCell } from './question-grid';
import { QuestionLegend } from './question-legend';

const CELLS: readonly QuestionCell[] = Array.from({ length: 10 }, (_, i) => ({
  answered: i < 4,
  flagged: i === 2 || i === 6,
}));

@Component({
  imports: [QuestionGrid, QuestionLegend],
  template: `<app-question-grid
      [cells]="cells"
      [current]="current()"
      (goto)="visited.push($event)"
    />
    <app-question-legend />`,
})
class Host {
  readonly cells = CELLS;
  readonly current = signal(4);
  readonly visited: number[] = [];
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const cells = () =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('.q-cell'));
  return { fixture, root, cells, host: fixture.componentInstance };
}

describe('QuestionGrid', () => {
  it('has one numbered button per question', () => {
    const { cells } = render();
    expect(cells()).toHaveLength(10);
    expect(cells().map((c) => c.textContent?.trim())).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
    ]);
    expect(cells().every((c) => c.type === 'button')).toBe(true);
  });

  it('names each cell with its number, whether it is answered, and whether it is flagged', () => {
    const { cells } = render();
    const names = cells().map((c) => c.getAttribute('aria-label'));
    expect(names[0]).toBe('Câu 1, đã trả lời');
    expect(names[2]).toBe('Câu 3, đã trả lời, đã đánh dấu');
    expect(names[4]).toBe('Câu 5, chưa trả lời');
    expect(names[6]).toBe('Câu 7, chưa trả lời, đã đánh dấu');
  });

  it('marks answered and flagged cells with classes', () => {
    const { cells } = render();
    expect(cells().map((c) => c.classList.contains('is-answered'))).toEqual(
      CELLS.map((c) => c.answered),
    );
    expect(cells().map((c) => c.classList.contains('is-flagged'))).toEqual(
      CELLS.map((c) => c.flagged),
    );
  });

  it('marks only the current question with aria-current', () => {
    const { cells, fixture, host } = render();
    expect(cells().map((c) => c.getAttribute('aria-current'))).toEqual(
      CELLS.map((_, i) => (i === 4 ? 'true' : null)),
    );
    host.current.set(0);
    fixture.detectChanges();
    expect(cells()[0].getAttribute('aria-current')).toBe('true');
    expect(cells()[4].getAttribute('aria-current')).toBeNull();
  });

  it('emits the zero-based index of the clicked question', () => {
    const { cells, host } = render();
    cells()[7].click();
    cells()[0].click();
    expect(host.visited).toEqual([7, 0]);
  });
});

describe('QuestionLegend', () => {
  it('explains the four cell states in words', () => {
    const { root } = render();
    const items = Array.from(root.querySelectorAll('.q-legend span')).map((s) =>
      s.textContent?.trim(),
    );
    expect(items).toEqual([
      'Đã trả lời',
      'Chưa trả lời',
      'Đánh dấu xem lại',
      'Câu đang xem',
    ]);
  });

  it('hides its swatches from assistive technology', () => {
    const { root } = render();
    const swatches = Array.from(root.querySelectorAll('.q-legend i'));
    expect(swatches).toHaveLength(4);
    expect(
      swatches.every((i) => i.getAttribute('aria-hidden') === 'true'),
    ).toBe(true);
  });
});
