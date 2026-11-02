import type { Anchor, AnchorCommand, CourseDetail } from '@lms/contracts';
import type { LearnerEnrollments } from './learner-enrollments';
import { refuse } from './learning-reply';

export type LessonEntry = CourseDetail['chapters'][number]['lessons'][number];

/** A lesson the caller holds through an enrolment, with the course it belongs to. */
export interface Located {
  readonly lesson: LessonEntry;
  readonly courseId: number;
  readonly courseTitle: string;
}

export const NO_ANCHOR = { blockId: null, page: null, second: null } as const;

export const sameAnchor = (a: Anchor, b: Anchor) =>
  a.type === b.type &&
  a.blockId === b.blockId &&
  a.page === b.page &&
  a.second === b.second;

/** The lesson in the revision the caller received; a course they left does not count. */
export function locateLesson(
  enrollments: LearnerEnrollments,
  userId: string,
  lessonId: number,
): Located | undefined {
  for (const record of enrollments.all()) {
    if (
      record.enrollment.userId !== userId ||
      record.enrollment.status === 'withdrawn'
    ) {
      continue;
    }
    for (const chapter of record.content.chapters) {
      const lesson = chapter.lessons.find((l) => l.lesson.id === lessonId);
      if (lesson) {
        return {
          lesson,
          courseId: record.content.course.id,
          courseTitle: record.content.revision.title ?? '',
        };
      }
    }
  }
  return undefined;
}

/** The anchor as the server stores it, after checking it against the block's ready file. */
export function resolveAnchor(
  lesson: LessonEntry,
  anchor: AnchorCommand,
): Anchor {
  if (anchor.type === 'none') return { type: 'none', ...NO_ANCHOR };
  const block = lesson.blocks.find((b) => b.block.id === anchor.blockId);
  const file = block?.assets.find((a) => a.usage.usage === 'primary')?.asset;
  if (
    !block ||
    block.block.blockType !== anchor.type ||
    file?.status !== 'ready'
  ) {
    return refuse('invalidReference');
  }
  if (anchor.type === 'pdf') {
    if (anchor.page > (file.pageCount ?? 0)) return refuse('invalidReference');
    return {
      type: 'pdf',
      blockId: anchor.blockId,
      page: anchor.page,
      second: null,
    };
  }
  if (anchor.second > Math.floor(file.durationSeconds ?? 0)) {
    return refuse('invalidReference');
  }
  return {
    type: 'video',
    blockId: anchor.blockId,
    page: null,
    second: anchor.second,
  };
}
