import type { CourseCard } from '@lms/contracts';
import type { CourseCardView } from './course-card';
import {
  COURSE_STATUS_LABEL,
  LEVEL_LABEL,
  toCourseStatus,
} from './course-labels';

/** A server row as the course card shows it; every number is the server's. */
export function toCourseCardView(card: CourseCard): CourseCardView {
  const status = toCourseStatus(card.learningStatus);
  return {
    id: String(card.courseId),
    title: card.title || card.code,
    required: card.requirement === 'mandatory',
    domain: card.programName || 'Khóa học',
    module: card.code,
    minutes: Math.round((card.durationSeconds ?? 0) / 60),
    lessons: card.lessonCount ?? 0,
    level: card.level ? LEVEL_LABEL[card.level] : '',
    pct: Math.round(card.progressPercent ?? 0),
    status,
    statusLabel: card.enrollmentId
      ? COURSE_STATUS_LABEL[status]
      : 'Chưa đăng ký',
    overdue: card.overdue ?? false,
    failed: card.failed ?? false,
    dueAt: card.dueAt ?? null,
    link: `/course/${card.courseId}`,
  };
}
