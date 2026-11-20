import { Component, computed, input, output } from '@angular/core';
import type { VideoChapter } from '@lms/contracts';
import { clock } from '../../../../../../../shared/learning/anchor';
import { startedIndex } from '../../video-time';

/** Chapter timestamps, with the currently playing chapter highlighted. */
@Component({
  selector: 'app-video-chapters',
  templateUrl: './video-chapters.html',
  styleUrl: './video-chapters.scss',
})
export class VideoChapters {
  readonly chapters = input.required<readonly VideoChapter[]>();
  /** The whole second the player is at. */
  readonly second = input(0);
  /** A chapter can be clicked to jump to its time; otherwise it only highlights. */
  readonly seekable = input(false);
  /** The second of the chapter the learner clicked. */
  readonly jump = output<number>();

  protected readonly clock = clock;
  protected readonly current = computed(() =>
    startedIndex(this.chapters(), this.second()),
  );
}
