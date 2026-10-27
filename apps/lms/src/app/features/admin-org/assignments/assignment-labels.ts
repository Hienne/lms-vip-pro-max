import type { EnrollmentMode, TargetType } from '@lms/contracts';
import type { StatusView } from '../../../shared/status/status-view';

/** UI copy for the assignment contracts' values; the mockup's wording where it has one. */
export const TARGET_TYPE_LABEL: Record<TargetType, string> = {
  user: 'Cá nhân',
  team: 'Phòng/nhóm',
  org: 'Đơn vị',
  learning_group: 'Nhóm học tập',
};

export const ENROLLMENT_MODE_LABEL: Record<EnrollmentMode, string> = {
  continue: 'Học tiếp tiến độ cũ',
  retake: 'Học lại từ đầu',
};

/**
 * The backend's assignment and recipient statuses are plain strings; the known ones get a badge,
 * anything else shows as sent.
 */
const ASSIGNMENT_STATUS_VIEW: Readonly<Record<string, StatusView>> = {
  scheduled: { label: 'Chưa bắt đầu', tone: 'neutral', outline: true },
  active: { label: 'Đang hiệu lực', tone: 'success', dot: true },
  revoked: { label: 'Đã thu hồi', tone: 'neutral', dot: true },
  completed: { label: 'Đã hoàn thành', tone: 'neutral', dot: true },
};

export const assignmentStatusView = (status: string): StatusView =>
  ASSIGNMENT_STATUS_VIEW[status.toLowerCase()] ?? {
    label: status,
    tone: 'neutral',
    outline: true,
  };
