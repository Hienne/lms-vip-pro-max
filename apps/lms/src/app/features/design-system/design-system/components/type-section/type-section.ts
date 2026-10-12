import { Component } from '@angular/core';
import { Card } from '@lms/ui';
import { DsSection } from '../section/section';

/** The type scale. Each sample's classes are written out so Tailwind finds them. */
const SAMPLES = [
  {
    label: 'Display · 36/700',
    classes: 'text-3xl font-bold',
    text: 'Chào mừng bạn gia nhập Ban!',
  },
  {
    label: 'H1 · 28/700',
    classes: 'text-2xl font-bold',
    text: 'Lộ trình đào tạo của bạn',
  },
  {
    label: 'H2 · 22/600',
    classes: 'text-xl font-semibold',
    text: 'Nghiệp vụ Core Banking nền tảng',
  },
  {
    label: 'H3 · 18/600',
    classes: 'text-lg font-semibold',
    text: 'Bài 3: Luồng giao dịch từ kênh đến sổ cái',
  },
  {
    label: 'Body · 16/400 · lh 1.5',
    classes: 'text-md font-regular',
    text: 'Mọi thao tác thay đổi dữ liệu quan trọng phải tuân thủ cơ chế kiểm soát hai lớp và được ghi nhật ký đầy đủ.',
  },
  {
    label: 'Small · 14/500',
    classes: 'text-sm font-medium',
    text: 'Cập nhật lần cuối 18/07 · 24 phút đọc',
  },
  {
    label: 'Caption · 12/600',
    classes: 'text-xs font-semibold',
    text: 'NHÃN PHỤ — KHÔNG DÙNG CHO ĐOẠN VĂN',
  },
] as const;

@Component({
  selector: 'app-type-section',
  imports: [DsSection, Card],
  templateUrl: './type-section.html',
  styleUrl: './type-section.scss',
})
export class TypeSection {
  protected readonly samples = SAMPLES;
}
