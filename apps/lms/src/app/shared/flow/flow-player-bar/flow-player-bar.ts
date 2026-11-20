import { Component, inject, input } from '@angular/core';
import { Icon, IconButton } from '@lms/ui';
import { FlowPlayerStore } from '../flow-player/data-access/flow-player.store';

/**
 * The player bar under a Mô phỏng luồng scene: previous, play or pause, next, replay, then
 * "Bước n/N" with the step's title and description. It drives the {@link FlowPlayerStore} its host
 * provides, so the learner's player and the author's builder share it.
 */
@Component({
  selector: 'app-flow-player-bar',
  imports: [Icon, IconButton],
  templateUrl: './flow-player-bar.html',
  styleUrl: './flow-player-bar.scss',
})
export class FlowPlayerBar {
  /** Before the first play, show the line that invites it instead of step 1 (the builder). */
  readonly waiting = input(false);

  protected readonly store = inject(FlowPlayerStore);
}
