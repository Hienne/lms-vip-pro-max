import { Component, computed, input } from '@angular/core';
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

  protected readonly clock = clock;
  protected readonly current = computed(() =>
    startedIndex(this.chapters(), this.second()),
  );
}
