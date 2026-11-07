import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { MyPoints } from '@lms/contracts';
import { PointsFigure } from './points-figure';

const POINTS: MyPoints = {
  total: 80,
  parts: {
    lessons: 30,
    quizzes: 30,
    firstTryBonus: 20,
    courses: 0,
    community: 0,
    adjustments: 0,
  },
  streakDays: 2,
};

@Component({
  imports: [PointsFigure],
  template: `<app-points-figure [points]="points()" />`,
})
class Host {
  readonly points = signal(POINTS);
}

describe('PointsFigure', () => {
  function render(points: MyPoints) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.points.set(points);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the label, the total and the streak, as a link to the leaderboard', () => {
    const root = render(POINTS);
    expect(root.querySelector('a')?.getAttribute('href')).toBe('/leaderboard');
    expect(
      Array.from(root.querySelectorAll('dt, dd')).map((node) =>
        node.textContent?.replace(/\s+/g, ' ').trim(),
      ),
    ).toEqual(['Điểm thưởng', '80', 'Chuỗi học', '2 ngày']);
  });

  it('shows a learner with nothing yet as 0 points and a streak of 0 days', () => {
    const root = render({
      total: 0,
      parts: {
        lessons: 0,
        quizzes: 0,
        firstTryBonus: 0,
        courses: 0,
        community: 0,
        adjustments: 0,
      },
      streakDays: 0,
    });
    expect(
      Array.from(root.querySelectorAll('dd')).map((node) =>
        node.textContent?.replace(/\s+/g, ' ').trim(),
      ),
    ).toEqual(['0', '0 ngày']);
  });
});
