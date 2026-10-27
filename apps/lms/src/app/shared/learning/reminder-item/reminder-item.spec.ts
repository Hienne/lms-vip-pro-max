import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { LearningReminder } from '@lms/contracts';
import { NOW } from '@lms/ui';
import { isReminderOverdue, ReminderItem } from './reminder-item';

const NOW_MS = new Date('2026-10-27T09:00:00').getTime();

const reminder = (dueAtSnapshot: string | null): LearningReminder => ({
  id: 1,
  recipientId: 41,
  scheduledAt: '2026-10-26T09:00:00',
  dueAtSnapshot,
  status: 'pending',
  rowVersion: 0,
});

@Component({
  imports: [ReminderItem],
  template: `<app-reminder-item
    [reminder]="reminder()"
    [overdue]="overdue()"
  />`,
})
class Host {
  readonly reminder = signal(reminder('2026-10-30T17:00:00'));
  readonly overdue = signal(false);
}

function render(overdue: boolean, due = '2026-10-30T17:00:00') {
  TestBed.configureTestingModule({
    providers: [{ provide: NOW, useValue: () => NOW_MS }],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.reminder.set(reminder(due));
  fixture.componentInstance.overdue.set(overdue);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ReminderItem', () => {
  it('says the course is about to fall due, with the due date and when it was sent', () => {
    const el = render(false);
    expect(el.textContent).toContain('Khóa học được giao sắp đến hạn');
    expect(el.textContent).toContain('30/10/2026');
    expect(el.textContent).toContain('nhắc lúc 1 ngày trước');
    expect(el.querySelector('.reminder-item__due--overdue')).toBeNull();
  });

  it('says it is overdue and colours only the date', () => {
    const el = render(true, '2026-10-25T17:00:00');
    expect(el.textContent).toContain('Khóa học được giao đã quá hạn');
    expect(
      el.querySelector('.reminder-item__due--overdue')?.textContent,
    ).toContain('25/10/2026');
  });
});

describe('isReminderOverdue', () => {
  it('is true only once the due date is before now', () => {
    expect(isReminderOverdue(reminder('2026-10-26T09:00:00'), NOW_MS)).toBe(
      true,
    );
    expect(isReminderOverdue(reminder('2026-10-28T09:00:00'), NOW_MS)).toBe(
      false,
    );
    expect(isReminderOverdue(reminder(null), NOW_MS)).toBe(false);
  });
});
