import { Component, computed, input, output } from '@angular/core';
import type { VideoChapter } from '@lms/contracts';
import { Chip } from '@lms/ui';
import { clock } from '../../../../../../../shared/learning/anchor';
import { startedIndex } from '../../video-time';

/** The chapters of a video as a row of buttons; a click asks the player to move there. */
@Component({
  selector: 'app-video-chapters',
  imports: [Chip],
  templateUrl: './video-chapters.html',
  styleUrl: './video-chapters.scss',
})
export class VideoChapters {
  readonly chapters = input.required<readonly VideoChapter[]>();
  /** The whole second the player is at. */
  readonly second = input(0);

  /** The second to move the player to. */
  readonly seek = output<number>();

  protected readonly clock = clock;
  protected readonly current = computed(() =>
    startedIndex(this.chapters(), this.second()),
  );
}
