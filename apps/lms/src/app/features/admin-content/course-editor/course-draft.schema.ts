import {
  applyEach,
  max,
  maxLength,
  min,
  required,
  type SchemaPathTree,
} from '@angular/forms/signals';
import { COURSE_LIMITS } from '@lms/contracts';
import type { CourseDraftValue } from './course-draft';

/** What the editor checks before a save; the server checks the rest on save and on publish. */
export function courseDraftSchema(
  path: SchemaPathTree<CourseDraftValue>,
): void {
  required(path.title, { message: 'Nhập tên khóa học.' });
  maxLength(path.title, COURSE_LIMITS.title, {
    message: `Tên khóa học tối đa ${COURSE_LIMITS.title} ký tự.`,
  });
  required(path.programId, { message: 'Chọn chương trình.' });
  maxLength(path.summary, COURSE_LIMITS.summary, {
    message: `Mô tả tối đa ${COURSE_LIMITS.summary} ký tự.`,
  });
  applyEach(path.objectives, (objective) => {
    maxLength(objective, COURSE_LIMITS.objective, {
      message: `Mỗi mục tiêu tối đa ${COURSE_LIMITS.objective} ký tự.`,
    });
  });
  required(path.rewardPoints, { message: 'Nhập điểm thưởng.' });
  min(path.rewardPoints, 0, { message: 'Điểm thưởng không âm.' });
  max(path.rewardPoints, COURSE_LIMITS.rewardPoints, {
    message: `Điểm thưởng tối đa ${COURSE_LIMITS.rewardPoints}.`,
  });
  applyEach(path.chapters, (chapter) => {
    required(chapter.title, { message: 'Nhập tên chương.' });
    maxLength(chapter.title, COURSE_LIMITS.title, {
      message: `Tên chương tối đa ${COURSE_LIMITS.title} ký tự.`,
    });
  });
}
