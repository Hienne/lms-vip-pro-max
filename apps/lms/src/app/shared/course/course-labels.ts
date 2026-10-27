import type { CourseLevel, CourseStatus, Requirement } from '@lms/contracts';

/** UI copy for the values the course contracts carry; the mockup's wording. */
export const LEVEL_LABEL: Record<CourseLevel, string> = {
  basic: 'Cơ bản',
  intermediate: 'Trung cấp',
  advanced: 'Nâng cao',
};

export const REQUIREMENT_LABEL: Record<Requirement, string> = {
  mandatory: 'Bắt buộc',
  optional: 'Tự chọn',
};

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  not_started: 'Chưa bắt đầu',
  in_progress: 'Đang học',
  completed: 'Đã hoàn thành',
  failed: 'Chưa đạt',
};

const COURSE_STATUSES = Object.keys(COURSE_STATUS_LABEL) as CourseStatus[];

/**
 * The backend's `learningStatus` (a plain string until it is enumerated) as one of the app's four
 * course states. An unknown value or none reads as not started.
 */
export function toCourseStatus(value: string | null | undefined): CourseStatus {
  const status = value?.toLowerCase() as CourseStatus | undefined;
  return status && COURSE_STATUSES.includes(status) ? status : 'not_started';
}
