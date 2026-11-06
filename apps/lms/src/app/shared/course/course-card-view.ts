import type { CourseCard } from '@lms/contracts';
import type { CourseCardView } from './course-card';
import { coverSrc, type CoverPreview } from './cover-image';
import {
  COURSE_STATUS_LABEL,
  LEVEL_LABEL,
  toCourseStatus,
} from './course-labels';

/**
 * A server row as the course card shows it; every number is the server's. `cover` is the state of
 * the card's `coverAssetId` read: a refused cover leaves the card text only.
 */
export function toCourseCardView(
  card: CourseCard,
  cover?: CoverPreview,
): CourseCardView {
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
    bestScore: card.bestScorePercent ?? null,
    link: `/course/${card.courseId}`,
    enrolled: card.enrollmentId != null,
    hasCover: card.coverAssetId != null && cover?.state !== 'failed',
    coverUrl: cover ? coverSrc(cover) : null,
  };
}
