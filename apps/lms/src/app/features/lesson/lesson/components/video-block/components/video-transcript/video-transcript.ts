import { Component, computed, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import type { TranscriptLine } from '@lms/contracts';
import { Icon, Input } from '@lms/ui';
import { clock } from '../../../../../../../shared/learning/anchor';
import { fold, startedIndex } from '../../video-time';

/**
 * The lines of a video, closed until opened. The search box filters them by a case- and
 * accent-insensitive substring in the browser. A timed line shows its time; an untimed Transcript
 * shows plain text, with no time and no current line.
 */
@Component({
  selector: 'app-video-transcript',
  imports: [FormField, Icon, Input],
  templateUrl: './video-transcript.html',
  styleUrl: './video-transcript.scss',
})
export class VideoTranscript {
  readonly lines = input.required<readonly TranscriptLine[]>();
  /** The whole second the player is at. */
  readonly second = input(0);

  protected readonly clock = clock;

  private readonly model = signal({ query: '' });
  protected readonly searchForm = form(this.model);

  /** The line being played, among all lines (a search may hide it). */
  private readonly current = computed(() =>
    startedIndex(this.lines(), this.second()),
  );

  /**
   * The lines the search keeps, each with its place among all lines (the list key: untimed lines
   * have no time to tell them apart) and whether the player is on it. An untimed line is never
   * the one being played.
   */
  protected readonly shown = computed(() => {
    const query = fold(this.model().query.trim());
    const playing = this.current();
    return this.lines()
      .map((line, index) => ({ line, index, playing: index === playing }))
      .filter(({ line }) => !query || fold(line.text).includes(query));
  });
}
