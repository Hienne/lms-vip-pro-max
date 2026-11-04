import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { MyPoints } from '@lms/contracts';

/**
 * The learner's points and streak as two aligned figures linking to the leaderboard.
 * Both values are the server's; only earned points use the achievement tone.
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
