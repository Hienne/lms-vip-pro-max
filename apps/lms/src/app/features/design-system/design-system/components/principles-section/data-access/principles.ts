import type { IconName } from '@lms/ui';

/** Copy of the mockup's "Nguyên tắc" cards and v1 → v2 change log (pages/design-system.js). */
export const PRINCIPLES: readonly {
  readonly icon: IconName;
  readonly title: string;
  readonly description: string;
}[] = [
  {
    icon: 'target',
    title: 'Một hành động chính',
    description:
      'Mỗi màn hình chỉ một nút primary; hành động phụ dùng secondary/ghost.',
  },
  {
    icon: 'layers',
    title: 'Tối đa 2 cấp thông tin',
    description: 'Chi tiết ẩn sau click (progressive disclosure).',
  },
  {
    icon: 'eye',
    title: 'Icon luôn có nhãn',
    description: 'Icon đứng một mình phải có aria-label/tooltip.',
  },
  {
    icon: 'inbox',
    title: 'Empty state có lối đi tiếp',
    description: 'Không để màn trắng — luôn kèm hướng dẫn hành động.',
  },
  {
    icon: 'shield',
    title: 'Không có nút giả',
    description: 'Mọi nút đều gọi API thật; quyền kiểm tra ở lớp dữ liệu.',
  },
  {
    icon: 'history',
    title: 'Phản hồi mọi thao tác',
    description:
      'Đang tải → thành công/thất bại; xác nhận trước thao tác quan trọng.',
  },
];

export const CHANGE_LOG = [
  {
    issue: 'Tương phản màu',
    v1: 'Vàng #FFC62F làm chữ chỉ 1.57:1; xám #98A3A2 2.59:1',
    v2: 'Thêm --color-accent-ink (5.9:1), --color-text-muted #5F6B69 (5.5:1); mọi cặp chữ/nền ≥ 4.5:1',
  },
  {
    issue: 'Success trùng Primary',
    v1: 'Trạng thái "hoàn thành" trông như nút bấm',
    v2: 'Success = xanh lá #1B7A43, tách khỏi teal primary',
  },
  {
    issue: 'Warning gần vàng thưởng',
    v1: 'Đánh dấu xem lại & đồng hồ thi dùng vàng, phá quy tắc',
    v2: 'Warning = cam #B45309; vàng chỉ dành cho phần thưởng',
  },
  {
    issue: 'Bố cục không thống nhất',
    v1: 'Một số trang không có sidebar/header',
    v2: 'Một AppShell duy nhất cho 4 vai trò; trang học/thi dùng layout tập trung',
  },
  {
    issue: 'Thanh demo che CTA',
    v1: 'Nút nổi "Trang chủ/Màn hình" che nút Tiếp tục',
    v2: 'Chuyển vào menu "Demo" trên header — không có phần tử nổi che nội dung',
  },
  {
    issue: 'Chỉ chạy desktop',
    v1: 'Tràn chữ, mất sidebar ở 375px',
    v2: 'Responsive: sidebar → drawer < 1024px, bảng → thẻ < 720px',
  },
  {
    issue: 'Thiếu dark mode, title, lang',
    v1: '<title> rỗng, không lang="vi"',
    v2: 'Dark mode theo hệ thống + công tắc; title theo trang; lang="vi"; skip-link',
  },
  {
    issue: 'Thiếu component nghiệp vụ',
    v1: 'Không có bảng, form lỗi, upload, PDF viewer, cây…',
    v2: 'Bổ sung ~40 component: DataTable, Field+lỗi, Dropzone, PdfViewer, VideoPlayer, Tree, Stepper, Drawer, Radar…',
  },
] as const;
