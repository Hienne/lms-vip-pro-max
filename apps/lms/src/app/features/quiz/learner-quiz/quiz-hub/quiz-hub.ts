import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Empty,
  ErrorState,
  FmtDatetimePipe,
  FmtScorePipe,
  Icon,
  LinkButton,
  PageHeader,
  Skeleton,
  Table,
  TableWrap,
} from '@lms/ui';
import { ATTEMPTS_PER_QUIZ, QuizHubStore } from './data-access/quiz-hub.store';

/**
 * The quiz hub (`/quiz`): the quizzes of the courses the learner is in the middle of, and the
 * attempts they made grouped by quiz. The mockup has no hub; this is the menu's landing page.
 */
@Component({
  selector: 'app-quiz-hub',
  imports: [
    Badge,
    Button,
    Card,
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
    Table,
    TableWrap,
  ],
  providers: [QuizHubStore],
  templateUrl: './quiz-hub.html',
  styleUrl: './quiz-hub.scss',
})
export class QuizHub {
  protected readonly store = inject(QuizHubStore);
  protected readonly perQuiz = ATTEMPTS_PER_QUIZ;
}
