/** The sections of the `/design-system` page, in the mockup's order (its section 14 is dropped). */
export const DESIGN_SYSTEM_SECTIONS = [
  { id: 'principles', number: '01', tocLabel: 'Nguyên tắc & thay đổi' },
  { id: 'color', number: '02', tocLabel: 'Màu sắc' },
  { id: 'type', number: '03', tocLabel: 'Typography' },
  { id: 'space', number: '04', tocLabel: 'Spacing · bo góc · motion' },
  { id: 'icons', number: '05', tocLabel: 'Icon' },
  { id: 'buttons', number: '06', tocLabel: 'Nút bấm' },
  { id: 'forms', number: '07', tocLabel: 'Form & nhập liệu' },
  { id: 'status', number: '08', tocLabel: 'Badge & trạng thái' },
  { id: 'data', number: '09', tocLabel: 'Hiển thị dữ liệu' },
  { id: 'nav', number: '10', tocLabel: 'Điều hướng' },
  { id: 'feedback', number: '11', tocLabel: 'Phản hồi hệ thống' },
  { id: 'learning', number: '12', tocLabel: 'Thành phần học tập' },
  { id: 'charts', number: '13', tocLabel: 'Biểu đồ' },
] as const;

export type DesignSystemSectionId =
  (typeof DESIGN_SYSTEM_SECTIONS)[number]['id'];

/** DOM id of a section's `<section>` element. */
export const sectionDomId = (id: DesignSystemSectionId): string => `ds-${id}`;

/** DOM id of a section's heading: the table of contents moves focus here. */
export const sectionHeadingId = (id: DesignSystemSectionId): string =>
  `h-${id}`;
