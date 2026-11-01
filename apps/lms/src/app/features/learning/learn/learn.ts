import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Button,
  Empty,
  ErrorState,
  FmtDatePipe,
  PageHeader,
  Skeleton,
  Tabs,
  TabPanel,
  type TabItem,
} from '@lms/ui';
import { CourseCard } from '../../../shared/course/course-card';
import { DueDate } from '../../../shared/course/due-date';
import { CompetencyView } from '../../../shared/learning/competency/competency-view';
import { ProgressCounts } from '../../../shared/learning/progress-counts/progress-counts';
import { ReminderItem } from '../../../shared/learning/reminder-item/reminder-item';
import { ScoreFigures } from '../../../shared/learning/score-figures/score-figures';
import { UnavailableNote } from '../../../shared/learning/unavailable-note/unavailable-note';
import { ContinueCard } from './components/continue-card/continue-card';
import { LearnStore, type LearnTab } from './data-access/learn.store';

const TAB_LABEL: Record<LearnTab, string> = {
  in_progress: 'Đang học',
  not_started: 'Chưa bắt đầu',
  completed: 'Đã hoàn thành',
  mandatory: 'Bắt buộc',
  assigned: 'Được giao',
};

/** The learner's home (the mockup's `dashboard` page, F.1): what to do next, then where they stand. */
@Component({
  selector: 'app-learn',
  imports: [
    Button,
    CompetencyView,
    ContinueCard,
    CourseCard,
    DueDate,
    Empty,
    ErrorState,
    PageHeader,
    ProgressCounts,
    ReminderItem,
    RouterLink,
    ScoreFigures,
    Skeleton,
    TabPanel,
    Tabs,
    UnavailableNote,
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
