import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Empty,
  ErrorState,
  FmtPctPipe,
  Icon,
  List,
  ListRow,
  SectionCard,
  Skeleton,
  Tabs,
  TabPanel,
  type TabItem,
} from '@lms/ui';
import { DueDate } from '../../../shared/course/due-date';
import { ReminderItem } from '../../../shared/learning/reminder-item/reminder-item';
import { CourseTile } from './components/course-tile/course-tile';
import { LearnHero } from './components/learn-hero/learn-hero';
import { LearnKpis } from './components/learn-kpis/learn-kpis';
import { LearnStore, type LearnTab } from './data-access/learn.store';

const TAB_LABEL: Record<LearnTab, string> = {
  in_progress: 'Đang học',
  not_started: 'Chưa bắt đầu',
  completed: 'Đã hoàn thành',
  mandatory: 'Bắt buộc',
  assigned: 'Được giao',
};

/**
 * The learner's home (the mockup's `dashboard` page, F.1): the hero with what to do next, the
 * figures, then the courses by state beside what falls due and the quick tools.
 */
@Component({
  selector: 'app-learn',
  imports: [
    CourseTile,
    DueDate,
    Empty,
    ErrorState,
    FmtPctPipe,
    Icon,
    LearnHero,
    LearnKpis,
    List,
    ListRow,
    ReminderItem,
    RouterLink,
    SectionCard,
    Skeleton,
    TabPanel,
    Tabs,
  ],
  providers: [LearnStore],
  templateUrl: './learn.html',
  styleUrl: './learn.scss',
})
export class Learn {
  protected readonly store = inject(LearnStore);
  protected readonly placeholders = [1, 2, 3];

  protected readonly tabs = computed((): readonly TabItem[] =>
    (Object.keys(TAB_LABEL) as LearnTab[]).map((id) => ({
      id,
      label: TAB_LABEL[id],
      count: this.store.tabCounts$()[id],
    })),
  );
}
