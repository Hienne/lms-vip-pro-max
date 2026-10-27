import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button, Card, Progress } from '@lms/ui';
import type { ContinueView } from '../../data-access/learn.store';

/**
 * Where the learner resumes: the last lesson, its chapter and course, the course's progress and one
 * primary link. With nothing in progress it points to the catalogue instead.
 */
@Component({
  selector: 'app-continue-card',
  imports: [Button, Card, Progress, RouterLink],
  templateUrl: './continue-card.html',
  styleUrl: './continue-card.scss',
})
export class ContinueCard {
  /** The course to resume, or `null` when none is in progress. */
  readonly resume = input.required<ContinueView | null>();
}
