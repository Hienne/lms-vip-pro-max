import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { MyPoints } from '@lms/contracts';

/**
 * The learner's points as one figure, label over number like the score figures beside it, linking to
 * the leaderboard. The total and the streak are the server's.
 */
@Component({
  selector: 'app-points-figure',
  imports: [RouterLink],
  templateUrl: './points-figure.html',
  styleUrl: './points-figure.scss',
})
export class PointsFigure {
  readonly points = input.required<MyPoints>();
}
