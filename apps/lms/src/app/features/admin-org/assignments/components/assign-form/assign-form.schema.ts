import type { SchemaPathTree } from '@angular/forms/signals';
import {
  max,
  maxLength,
  min,
  required,
  validate,
} from '@angular/forms/signals';
import {
  ASSIGNMENT_LIMITS,
  type EnrollmentMode,
  type Requirement,
} from '@lms/contracts';
import type {
  AssignRequest,
  TargetPick,
} from '../../data-access/assignments.store';

export interface AssignFormValue {
  /** Select value: a course id, or '' for none. */
  courseId: string;
  title: string;
  targets: TargetPick[];
  /** `yyyy-mm-dd`, the date input's value. */
  startDate: string;
  dueDate: string;
  requirement: Requirement;
  enrollmentMode: EnrollmentMode;
  reminderEnabled: boolean;
  reminderDaysBefore: number;
}

const DAY = 86_400_000;
/** The mockup's defaults: start today, due in 30 days, remind 3 days before. */
const DUE_IN_DAYS = 30;
const REMIND_DAYS = 3;
/** A due date ends at the close of the working day, as in the mockup. */
const DUE_TIME = 'T17:00:00';

const dateInput = (time: number): string => {
  const date = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** A local date and time as an ISO instant, which the backend reads with its offset. */
const toInstant = (date: string, time: string): string =>
  new Date(`${date}${time}`).toISOString();

export function newAssignFormValue(
  courseId: number | undefined,
  now: number,
): AssignFormValue {
  return {
    courseId: courseId ? String(courseId) : '',
    title: '',
    targets: [],
    startDate: dateInput(now),
    dueDate: dateInput(now + DUE_IN_DAYS * DAY),
    requirement: 'mandatory',
    enrollmentMode: 'continue',
    reminderEnabled: true,
    reminderDaysBefore: REMIND_DAYS,
  };
}

export function assignFormSchema(path: SchemaPathTree<AssignFormValue>): void {
  required(path.courseId, { message: 'Chọn khóa học.' });
  maxLength(path.title, ASSIGNMENT_LIMITS.title, {
    message: `Tên đợt giao tối đa ${ASSIGNMENT_LIMITS.title} ký tự.`,
  });
  validate(path.targets, ({ value }) =>
    value().length === 0
      ? { kind: 'targets', message: 'Thêm ít nhất một đối tượng.' }
      : value().length > ASSIGNMENT_LIMITS.targets
        ? {
            kind: 'targets',
            message: `Tối đa ${ASSIGNMENT_LIMITS.targets} đối tượng mỗi lượt giao.`,
          }
        : undefined,
  );
  required(path.startDate, { message: 'Chọn ngày bắt đầu.' });
  required(path.dueDate, { message: 'Chọn hạn hoàn thành.' });
  validate(path.dueDate, ({ value, valueOf }) =>
    value() && valueOf(path.startDate) && value() < valueOf(path.startDate)
      ? { kind: 'dueAfterStart', message: 'Hạn phải sau ngày bắt đầu.' }
      : undefined,
  );
  min(path.reminderDaysBefore, 0, { message: 'Số ngày không âm.' });
  max(path.reminderDaysBefore, ASSIGNMENT_LIMITS.reminderDaysBefore, {
    message: `Tối đa ${ASSIGNMENT_LIMITS.reminderDaysBefore} ngày.`,
  });
}

export function toAssignRequest(value: AssignFormValue): AssignRequest {
  const title = value.title.trim();
  return {
    courseId: Number(value.courseId),
    ...(title ? { title } : {}),
    startAt: toInstant(value.startDate, 'T00:00:00'),
    dueAt: toInstant(value.dueDate, DUE_TIME),
    requirement: value.requirement,
    enrollmentMode: value.enrollmentMode,
    reminderEnabled: value.reminderEnabled,
    ...(value.reminderEnabled
      ? { reminderDaysBefore: Math.round(value.reminderDaysBefore) }
      : {}),
    targets: value.targets.map(({ label: _label, ...target }) => target),
  };
}
