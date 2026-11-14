import {
  applyEach,
  disabled,
  max,
  maxLength,
  min,
  required,
  validate,
  type SchemaPathTree,
  type SchemaPath,
} from '@angular/forms/signals';
import { COURSE_LIMITS } from '@lms/contracts';
import type { CourseDraftValue } from './course-draft';

/** Why step 1's program is locked while a final exam is attached. */
export const PROGRAM_LOCKED_HINT =
  'Gỡ bài kiểm tra cuối khóa ở bước 3 để đổi chương trình.';

function requiredText(path: SchemaPath<string>, message: string): void {
  required(path, { message });
  validate(path, ({ value }) =>
    value() && !value().trim() ? { kind: 'blank', message } : undefined,
  );
}

/** What the editor checks before a save; the server checks the rest on save and on publish. */
export function courseDraftSchema(
  path: SchemaPathTree<CourseDraftValue>,
): void {
  requiredText(path.title, 'Nhập tên khóa học.');
  maxLength(path.title, COURSE_LIMITS.title, {
    message: `Tên khóa học tối đa ${COURSE_LIMITS.title} ký tự.`,
  });
  required(path.programId, { message: 'Chọn chương trình.' });
  required(path.level, { message: 'Chọn mức độ khóa học.' });
  // The exam's pool comes from this program's bank, so the program cannot move under it.
  disabled(path.programId, {
    when: ({ valueOf }) =>
      valueOf(path.finalQuizId) !== '' ? PROGRAM_LOCKED_HINT : false,
  });
  maxLength(path.summary, COURSE_LIMITS.summary, {
    message: `Mô tả tối đa ${COURSE_LIMITS.summary} ký tự.`,
  });
  maxLength(path.objectives, COURSE_LIMITS.items, {
    message: `Tối đa ${COURSE_LIMITS.items} mục tiêu đầu ra.`,
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
  maxLength(path.chapters, COURSE_LIMITS.items, {
    message: `Tối đa ${COURSE_LIMITS.items} chương mỗi khóa.`,
  });
  applyEach(path.chapters, (chapter) => {
    requiredText(chapter.title, 'Nhập tên chương.');
    maxLength(chapter.title, COURSE_LIMITS.title, {
      message: `Tên chương tối đa ${COURSE_LIMITS.title} ký tự.`,
    });
    maxLength(chapter.lessons, COURSE_LIMITS.items, {
      message: `Tối đa ${COURSE_LIMITS.items} bài mỗi chương.`,
    });
  });
}

/**
 * The course code of a course that is being created. `taken` is the code the server refused, so
 * the message shows until the author changes the code.
 */
export function courseCodeSchema(
  path: SchemaPath<string>,
  taken: () => string | null,
): void {
  requiredText(path, 'Nhập mã khóa học.');
  maxLength(path, COURSE_LIMITS.code, {
    message: `Mã tối đa ${COURSE_LIMITS.code} ký tự.`,
  });
  validate(path, ({ value }) => {
    const refused = taken();
    return refused !== null && value().trim() === refused
      ? { kind: 'duplicate', message: 'Mã khóa học đã tồn tại.' }
      : undefined;
  });
}
