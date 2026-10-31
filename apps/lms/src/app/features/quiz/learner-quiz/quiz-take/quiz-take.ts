import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button, Empty, Skeleton } from '@lms/ui';
import { AssessmentTake } from './components/assessment-take/assessment-take';
import { QuizTakeStore } from './data-access/quiz-take.store';

/** `quiz/:id/take`: starts or continues the attempt and hands the quiz to the take view. */
@Component({
  selector: 'app-quiz-take',
  imports: [AssessmentTake, Button, Empty, RouterLink, Skeleton],
  providers: [QuizTakeStore],
  template: `
    @if (store.loadError$(); as error) {
      <ui-empty
        variant="page"
        [headingLevel]="1"
        title="Chưa thể làm bài kiểm tra này"
        [description]="error.message"
      >
        @if (store.quizId$(); as quizId) {
          <a uiButton variant="primary" [routerLink]="['/quiz', quizId]"
            >Về thông tin bài kiểm tra</a
          >
        }
      </ui-empty>
    } @else if (store.session$(); as session) {
      <app-assessment-take
        [quizTitle]="session.quizTitle"
        [questions]="store.questions$()"
        [current]="store.current$()"
        [seconds]="store.seconds$()"
        [saving]="store.isSaving$()"
        [submitting]="store.isSubmitting$()"
        [saveError]="store.saveError$()"
        (answerSelected)="
          store.chooseOption($event.questionId, $event.optionId, $event.checked)
        "
        (flagged)="store.toggleFlag($event)"
        (goto)="store.goto($event)"
        (retrySave)="store.retrySave()"
        (submitted)="store.submit()"
      />
    } @else {
      <div class="take__loading" aria-busy="true">
        <div uiSkeleton variant="block"></div>
      </div>
    }
  `,
  styleUrl: './quiz-take.scss',
  host: { '(document:keydown)': 'store.handleKey($event)' },
})
export class QuizTake {
  protected readonly store = inject(QuizTakeStore);

  /** The leave guard asks before the learner walks away from a running attempt. */
  hasUnsavedChanges(): boolean {
    return this.store.inProgress$();
  }
}
