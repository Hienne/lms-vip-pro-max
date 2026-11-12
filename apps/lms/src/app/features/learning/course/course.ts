import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Alert,
  Breadcrumb,
  Button,
  Empty,
  ErrorState,
  FmtDatePipe,
  FmtMinutesPipe,
  List,
  ListItem,
  PageHeader,
  SectionCard,
  Skeleton,
  Stat,
  StatStrip,
  type BreadcrumbItem,
} from '@lms/ui';
import { DueDate } from '../../../shared/course/due-date';
import { RequiredMark } from '../../../shared/course/required-mark';
import { coverSrc } from '../../../shared/course/cover-image';
import { QuizCard } from '../../../shared/quiz/quiz-card/quiz-card';
import { CourseOutline } from './components/course-outline/course-outline';
import { CourseStore } from './data-access/course.store';

/** The final exam's state in the learner's words; `NOT_REQUIRED` shows no figure. */
const FINAL_EXAM_LABEL = {
  NOT_TAKEN: 'Chưa thi',
  NOT_PASSED: 'Chưa đạt',
  PASSED: 'Đã đạt',
} as const;

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
    CourseOutline,
    DueDate,
    Empty,
    ErrorState,
    FmtDatePipe,
    FmtMinutesPipe,
    List,
    ListItem,
    NgTemplateOutlet,
    PageHeader,
    QuizCard,
    RequiredMark,
    RouterLink,
    SectionCard,
    Skeleton,
    Stat,
    StatStrip,
  ],
  providers: [CourseStore],
  templateUrl: './course.html',
  styleUrl: './course.scss',
})
export class Course {
  protected readonly store = inject(CourseStore);
  protected readonly coverSrc = computed(() => coverSrc(this.store.cover$()));

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

  /** The server's required-lesson progress, rounded for the figure; 100 does not mean completed. */
  protected readonly progress = computed(() =>
    Math.round(this.store.card$()?.progressPercent ?? 0),
  );

  /**
   * Required lessons done out of required: the enrolment's evaluation when the server sent one,
   * else the card's count; null when neither carries it.
   */
  protected readonly required = computed(() => {
    const completion = this.store.detail$()?.completion;
    if (completion) {
      return {
        done: completion.completedRequiredLessons,
        total: completion.requiredLessons,
        satisfied: completion.lessonsSatisfied,
      };
    }
    const card = this.store.card$();
    if (typeof card?.requiredLessonCount !== 'number') return null;
    const done = card.completedRequiredLessonCount ?? 0;
    return {
      done,
      total: card.requiredLessonCount,
      satisfied: done >= card.requiredLessonCount,
    };
  });

  /** The final exam figure, from the server's evaluation only; null when none is required or sent. */
  protected readonly finalExam = computed(() => {
    const status = this.store.detail$()?.completion?.finalExamStatus;
    if (!status || status === 'NOT_REQUIRED') return null;
    const pass = this.store.finalExam$()?.quiz.passPercent;
    return {
      label: FINAL_EXAM_LABEL[status],
      failed: status === 'NOT_PASSED',
      note: pass == null ? undefined : `Điểm đạt ≥ ${pass}%`,
    };
  });

  protected readonly summary = computed(
    () => this.store.content$()?.revision.summary?.trim() || '',
  );

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
