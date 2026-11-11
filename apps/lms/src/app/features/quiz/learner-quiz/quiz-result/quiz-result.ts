import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button, Empty, ErrorState, Skeleton } from '@lms/ui';
import { AssessmentResult } from './components/assessment-result/assessment-result';
import { QuizExplainStore } from './data-access/quiz-explain.store';
import { QuizResultStore } from './data-access/quiz-result.store';

/** `quiz/:id/result/:attemptId`: loads the graded attempt and hands it to the result view. */
@Component({
  selector: 'app-quiz-result',
  imports: [AssessmentResult, Button, Empty, ErrorState, RouterLink, Skeleton],
  providers: [QuizResultStore, QuizExplainStore],
  template: `
    @if (store.loadError$(); as error) {
      <ui-error-state
        title="Không tải được kết quả"
        [message]="error.message"
        (retry)="store.retry()"
      />
    } @else if (store.attemptId$() === undefined) {
      <ui-empty
        variant="page"
        [headingLevel]="1"
        title="Không tìm thấy kết quả"
        description="Lượt thi không còn mở cho bạn hoặc đường dẫn không đúng."
      >
        <a uiButton variant="primary" routerLink="/quiz">Về bài kiểm tra</a>
      </ui-empty>
    } @else if (store.result$(); as result) {
      <app-assessment-result
        [result]="result"
        [canRetry]="store.canRetry$()"
        [reviewOpen]="store.reviewOpen$()"
        (reviewOpenChange)="store.setReviewOpen($event)"
        [explainable]="explainer.available$()"
        [explanations]="explainer.all$()"
        [explainBusy]="explainer.working$() !== null"
        (explain)="explainer.explain(result.attemptId, $event)"
      />
    } @else {
      <div class="result__loading" aria-busy="true">
        <div uiSkeleton variant="text"></div>
        <div uiSkeleton variant="block"></div>
      </div>
    }
  `,
  styleUrl: './quiz-result.scss',
})
export class QuizResult {
  protected readonly store = inject(QuizResultStore);
  protected readonly explainer = inject(QuizExplainStore);
}
