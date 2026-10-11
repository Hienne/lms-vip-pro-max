import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Icon,
  type BadgeTone,
  type IconName,
} from '@lms/ui';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';
import { StatusSectionStore } from './data-access/status-section.store';

/** One badge per tone, each with an icon and text so the meaning never rests on colour. */
const TONES: readonly {
  readonly tone: BadgeTone;
  readonly label: string;
  readonly icon?: IconName;
}[] = [
  { tone: 'neutral', label: 'Chưa bắt đầu' },
  { tone: 'primary', label: 'Học viên', icon: 'user' },
  { tone: 'success', label: 'Đã hoàn thành', icon: 'check' },
  { tone: 'warning', label: 'Sắp đến hạn', icon: 'clock' },
  { tone: 'danger', label: 'Chưa đạt', icon: 'x' },
  { tone: 'info', label: 'Đang học' },
  { tone: 'reward', label: '+50 điểm', icon: 'star' },
];

@Component({
  selector: 'app-status-section',
  imports: [
    DsSection,
    DsDemo,
    Badge,
    Chip,
    Card,
    CardHeader,
    CardBody,
    Icon,
    RouterLink,
  ],
  providers: [StatusSectionStore],
  templateUrl: './status-section.html',
})
export class StatusSection {
  protected readonly store = inject(StatusSectionStore);
  protected readonly tones = TONES;
}
