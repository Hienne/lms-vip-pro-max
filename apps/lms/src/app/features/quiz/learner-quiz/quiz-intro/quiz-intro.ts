import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  CardBody,
  CardHeader,
  Empty,
  ErrorState,
  FmtDatetimePipe,
  FmtScorePipe,
  Icon,
  LinkButton,
  PageHeader,
  Skeleton,
  type BreadcrumbItem,
} from '@lms/ui';
import { QuizIntroStore } from './data-access/quiz-intro.store';

/** The screen before a quiz (the mockup's `quizIntro`): the rules, the learner's results, the start. */
@Component({
  selector: 'app-quiz-intro',
  imports: [
    Alert,
    Breadcrumb,
    Button,
    Card,
    CardBody,
    CardHeader,
    Empty,
    ErrorState,
    FmtDatetimePipe,
    FmtScorePipe,
    Icon,
    LinkButton,
    PageHeader,
    RouterLink,
    Skeleton,
  ],
  providers: [QuizIntroStore],
  templateUrl: './quiz-intro.html',
  styleUrl: './quiz-intro.scss',
})
export class QuizIntro {
  protected readonly store = inject(QuizIntroStore);

  protected readonly crumbs = computed((): readonly BreadcrumbItem[] => {
    const intro = this.store.intro$();
    return intro
      ? [
          { label: intro.course.title, href: `/course/${intro.course.id}` },
          { label: 'Bài kiểm tra' },
        ]
      : [{ label: 'Bài kiểm tra' }];
  });

  /** The one line under the title: size, time and pass mark, where the mockup had four KPI cards. */
  protected readonly facts = computed(() => {
    const quiz = this.store.intro$()?.quiz;
    if (!quiz) return '';
    return [
      `${quiz.questionCount} câu`,
      `${quiz.timeLimitMinutes} phút`,
      `Điểm đạt ≥ ${quiz.passPercent}%`,
      quiz.hasMultipleChoice ? 'Có câu nhiều đáp án' : 'Một đáp án mỗi câu',
    ].join(' · ');
  });
}
