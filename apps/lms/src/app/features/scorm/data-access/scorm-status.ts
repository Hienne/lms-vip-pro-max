import type { ScormProgress } from '@lms/contracts';

export const SCORM_STATUS: Record<ScormProgress['lessonStatus'], string> = {
  'not attempted': 'Chưa học',
  incomplete: 'Đang học',
  passed: 'Đạt',
  failed: 'Chưa đạt',
  completed: 'Đã hoàn thành',
  browsed: 'Đã xem',
};
