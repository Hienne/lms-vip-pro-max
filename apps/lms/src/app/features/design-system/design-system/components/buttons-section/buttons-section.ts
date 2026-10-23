import { Component } from '@angular/core';
import {
  Badge,
  Button,
  Icon,
  IconButton,
  LinkButton,
  type ButtonVariant,
  Table,
  TableWrap,
  Tooltip,
} from '@lms/ui';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

/** The mockup's rows: one variant each, with its sample label and icon. */
const ROWS: readonly {
  readonly variant: ButtonVariant;
  readonly label: string;
  readonly icon: 'play' | 'trash-2';
}[] = [
  { variant: 'primary', label: 'Bắt đầu học', icon: 'play' },
  { variant: 'secondary', label: 'Xem chi tiết', icon: 'play' },
  { variant: 'ghost', label: 'Bỏ qua', icon: 'play' },
  { variant: 'danger', label: 'Xóa khóa học', icon: 'trash-2' },
  { variant: 'danger-ghost', label: 'Xóa', icon: 'trash-2' },
];

@Component({
  selector: 'app-buttons-section',
  imports: [
    DsSection,
    DsDemo,
    Badge,
    Button,
    Icon,
    IconButton,
    LinkButton,
    Table,
    TableWrap,
    Tooltip,
  ],
  templateUrl: './buttons-section.html',
  styleUrl: './buttons-section.scss',
})
export class ButtonsSection {
  protected readonly rows = ROWS;
}
