import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProgressCounts, type ProgressCountsValue } from './progress-counts';

@Component({
  imports: [ProgressCounts],
  template: `<app-progress-counts [counts]="counts()" />`,
})
class Host {
  readonly counts = signal<ProgressCountsValue>({
    total: 6,
    completed: 1,
    inProgress: 2,
    notStarted: 3,
    overdue: 1,
    assigned: 4,
    mandatory: 3,
  });
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return {
    root,
    set: (counts: ProgressCountsValue) => {
      fixture.componentInstance.counts.set(counts);
      fixture.detectChanges();
    },
  };
}

const pairs = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('dt')).map((dt) => [
    dt.textContent?.trim(),
    dt.nextElementSibling?.textContent?.trim(),
  ]);

describe('ProgressCounts', () => {
  it('shows the five server counts as label over number, in order', () => {
    expect(pairs(render().root)).toEqual([
      ['Tổng số khóa', '6'],
      ['Hoàn thành', '1'],
      ['Đang học', '2'],
      ['Chưa bắt đầu', '3'],
      ['Đang quá hạn', '1'],
    ]);
  });

  it('turns the overdue number danger only while it is above zero', () => {
    const { root, set } = render();
    const overdue = () =>
      root
        .querySelectorAll('dd')[4]
        .classList.contains('progress-counts__value--danger');
    expect(overdue()).toBe(true);
    set({
      total: 6,
      completed: 1,
      inProgress: 2,
      notStarted: 3,
      overdue: 0,
      assigned: 4,
      mandatory: 3,
    });
    expect(overdue()).toBe(false);
    expect(root.querySelectorAll('dd')[0].classList).not.toContain(
      'progress-counts__value--danger',
    );
  });
});
