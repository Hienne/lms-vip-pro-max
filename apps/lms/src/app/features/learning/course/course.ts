import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  CardBody,
  Empty,
  ErrorState,
  FmtDatePipe,
  FmtMinutesPipe,
  PageHeader,
  Ring,
  Skeleton,
  type BreadcrumbItem,
} from '@lms/ui';
import { DueDate } from '../../../shared/course/due-date';
import { RequiredMark } from '../../../shared/course/required-mark';
import { QuizCard } from '../../../shared/quiz/quiz-card/quiz-card';
import { CourseOutline } from './components/course-outline/course-outline';
import { CourseStore } from './data-access/course.store';

const ONE_DECIMAL = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** The learner's page for one course (the mockup's `course` page): outline, progress, enrolment. */
@Component({
  selector: 'app-course',
  imports: [
    Alert,
    Breadcrumb,
    Button,
    Card,
    CardBody,
    CourseOutline,
    DueDate,
    Empty,
    ErrorState,
    FmtDatePipe,
    FmtMinutesPipe,
    PageHeader,
    QuizCard,
    RequiredMark,
    Ring,
    RouterLink,
    Skeleton,
  ],
  providers: [CourseStore],
  templateUrl: './course.html',
  styleUrl: './course.scss',
})
export class Course {
  protected readonly store = inject(CourseStore);

  protected readonly crumbs = computed((): readonly BreadcrumbItem[] => {
    const card = this.store.card$();
    return [
      { label: 'Danh mục khóa học', href: '/catalog' },
      ...(card?.programName ? [{ label: card.programName }] : []),
      { label: card?.title ?? 'Khóa học' },
    ];
  });

  /** The meta line under the title: field · module, then code, level, lessons; a missing name is left out. */
  protected readonly facts = computed(() => {
    const card = this.store.card$();
    if (!card) return '';
    return [
      card.fieldName,
      card.moduleName,
      card.code,
      this.store.levelLabel$(),
      card.lessonCount != null ? `${card.lessonCount} bài` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  });

  protected readonly minutes = computed(() =>
    Math.round((this.store.card$()?.durationSeconds ?? 0) / 60),
  );

  /** The learners' rating of the course: the average to one decimal and how many rated; null until someone rates. */
  protected readonly rating = computed(() => {
    const rating = this.store.card$()?.rating;
    return rating
      ? { average: ONE_DECIMAL.format(rating.average), count: rating.count }
      : null;
  });

  /** The server's count of required lessons done; absent when the card does not carry it. */
  protected readonly requiredTally = computed(() => {
    const card = this.store.card$();
    return typeof card?.requiredLessonCount === 'number'
      ? {
          done: card.completedRequiredLessonCount ?? 0,
          required: card.requiredLessonCount,
        }
      : null;
  });

  protected readonly objectives = computed(
    () =>
      this.store
        .content$()
        ?.objectives.slice()
        .sort((a, b) => a.sortNo - b.sortNo) ?? [],
  );

  protected readonly rewardPoints = computed(
    () => this.store.content$()?.completionRule?.rewardPoints ?? 0,
  );
}
