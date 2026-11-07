import {
  Component,
  DestroyRef,
  DOCUMENT,
  inject,
  Renderer2,
} from '@angular/core';
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
        [focusPolicy]="store.focusPolicy$()"
        (answerSelected)="
          store.chooseOption($event.questionId, $event.optionId, $event.checked)
        "
        (flagged)="store.toggleFlag($event)"
        (goto)="store.goto($event)"
        (retrySave)="store.retrySave()"
        (retrySubmit)="store.retryForcedSubmit()"
        (submitted)="store.submit()"
      />
    } @else {
      <div class="take__loading" aria-busy="true">
        <div uiSkeleton variant="block"></div>
      </div>
    }
  `,
  styleUrl: './quiz-take.scss',
  host: {
    '(document:keydown)': 'store.handleKey($event)',
    '(document:visibilitychange)': "store.setPresence('hidden', page.hidden)",
    '(window:blur)': "store.setPresence('unfocused', true)",
    '(window:focus)': "store.setPresence('unfocused', false)",
    '(window:online)': 'store.retryForcedSubmit()',
  },
})
export class QuizTake {
  protected readonly store = inject(QuizTakeStore);
  protected readonly page = inject(DOCUMENT);

  constructor() {
    const renderer = inject(Renderer2);
    const destroy = inject(DestroyRef);
    // The document root includes the exam and its overlays. Touch lifts are not mouse exits.
    for (const [event, away] of [
      ['pointerleave', true],
      ['pointerenter', false],
    ] as const) {
      const stop = renderer.listen(
        this.page.documentElement,
        event,
        (pointer: PointerEvent) => {
          if (pointer.pointerType === 'mouse')
            this.store.setPresence('pointer', away);
        },
      );
      destroy.onDestroy(stop);
    }
  }

  /** The leave guard asks before the learner walks away from a running attempt. */
  hasUnsavedChanges(): boolean {
    return this.store.inProgress$();
  }
}
