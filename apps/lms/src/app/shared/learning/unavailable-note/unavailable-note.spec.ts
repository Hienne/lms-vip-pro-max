import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { LearningProgressOverview } from '@lms/contracts';
import { UnavailableNote } from './unavailable-note';

const summary = (
  activity: string,
  assessment = 'unavailable',
  competency = 'unavailable',
): LearningProgressOverview => ({
  serverTime: '2026-10-27T09:00:00',
  timeZone: 'Asia/Ho_Chi_Minh',
  counts: {
    total: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    overdue: 0,
    assigned: 0,
    mandatory: 0,
  },
  activity: { availability: activity },
  assessment:
    assessment === 'available'
      ? {
          availability: 'available',
          last: null,
          bestScorePercent: null,
          averageScorePercent: null,
          passedQuizCount: 0,
          quizCount: 1,
        }
      : { availability: assessment },
  competency: { availability: competency },
});

@Component({
  imports: [UnavailableNote],
  template: `<app-unavailable-note [summary]="summary()" />`,
})
class Host {
  readonly summary = signal(summary('unavailable'));
}

describe('UnavailableNote', () => {
  function render(value: LearningProgressOverview) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.summary.set(value);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent?.trim();
  }

  it('says once that hours and scores are not there yet', () => {
    expect(render(summary('unavailable'))).toBe(
      'Giờ học và điểm kiểm tra sẽ hiển thị khi hệ thống có dữ liệu.',
    );
  });

  it('keeps saying it while hours or scores are unavailable', () => {
    expect(render(summary('available', 'unavailable', 'available'))).toContain(
      'sẽ hiển thị',
    );
    expect(render(summary('unavailable', 'available', 'available'))).toContain(
      'sẽ hiển thị',
    );
  });

  it('ignores competency: unavailable competency alone shows no note', () => {
    expect(render(summary('available', 'available', 'unavailable'))).toBe('');
  });

  it('says nothing once hours and scores are available', () => {
    expect(render(summary('available', 'available', 'available'))).toBe('');
  });
});
