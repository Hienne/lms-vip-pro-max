import type { BadgeTone } from '@lms/ui';
export const REVIEW_STATUS: Readonly<
  Record<string, { label: string; tone: BadgeTone }>
> = {
  draft: { label: 'Chưa mở lấy ý kiến', tone: 'neutral' },
  open: { label: 'Đang lấy ý kiến', tone: 'info' },
  concluded: { label: 'Đã kết luận', tone: 'success' },
  closed: { label: 'Đã đóng', tone: 'neutral' },
};
export const INVITATION_STATUS: Readonly<Record<string, string>> = {
  pending: 'Chờ phản hồi',
  accepted: 'Đã nhận lời',
  declined: 'Đã từ chối',
  completed: 'Đã phản biện',
  cancelled: 'Đã hủy',
};
export const INVITATION_ACTION: Readonly<Record<string, string>> = {
  accept: 'Nhận lời',
  decline: 'Từ chối',
  complete: 'Hoàn tất phản biện',
  cancel: 'Hủy lời mời',
};
