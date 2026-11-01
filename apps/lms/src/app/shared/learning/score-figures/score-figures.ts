import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LearningProgressOverview } from '@lms/contracts';
import { FmtPctPipe } from '@lms/ui';
import { isAssessmentAvailable } from '../assessment-overview';

/**
 * The learner's quiz scores as two figures, label over number like the counts, each a link to the
 * progress page. Every number and verdict is the server's. Nothing is drawn while the backend has
 * no quiz in the learner's courses, and "Chưa đạt" is the only coloured text.
 */
@Component({
  selector: 'app-score-figures',
  imports: [FmtPctPipe, RouterLink],
  templateUrl: './score-figures.html',
  styleUrl: './score-figures.scss',
})
export class ScoreFigures {
  readonly summary = input.required<LearningProgressOverview>();

  protected readonly overview = computed(() => {
    const assessment = this.summary().assessment;
    return isAssessmentAvailable(assessment) ? assessment : null;
  });
}
