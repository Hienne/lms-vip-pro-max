import {
  Component,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { TranscriptLine, VideoChapter } from '@lms/contracts';
import { Button, Icon, IconButton } from '@lms/ui';
import { interval, type Subscription } from 'rxjs';
import { clock } from '../../../../../shared/learning/anchor';
import { VideoChapters } from './components/video-chapters/video-chapters';
import { VideoTranscript } from './components/video-transcript/video-transcript';

/** A playing video reports its range this often; the heartbeat keeps the media cookie alive. */
export const VIDEO_BEAT_MS = 20_000;

/**
 * A video with playback controls that expose no seek actions. The server's resume position
 * and restarting a finished video are the only deliberate changes to currentTime.
 */
@Component({
  selector: 'app-video-block',
  imports: [Button, Icon, IconButton, VideoChapters, VideoTranscript],
  templateUrl: './video-block.html',
  styleUrl: './video-block.scss',
  host: {
    '(document:fullscreenchange)': 'fullscreenChanged()',
    '[class.video-block--wide]': 'wide()',
  },
})
export class VideoBlock {
  readonly src = input.required<string>();
  readonly wide = input(false);
  /** Where the video resumes, in seconds; it never starts by itself. */
  readonly startAt = input(0);
  readonly completed = input(false);
  readonly title = input('');
  /** The chapters of the video, in time order. */
  readonly chapters = input<readonly VideoChapter[]>([]);
  /** The timed lines of the video, in time order. */
  readonly transcript = input<readonly TranscriptLine[]>([]);
  /** The second the player is at is bookmarked. */
  readonly bookmarked = input(false);
  /** A bookmark change is in flight, so the button waits. */
  readonly busy = input(false);

  readonly played = output<number>();
  readonly paused = output<number>();
  readonly beat = output<number>();
  /** The whole second the player is at, each time it changes. */
  readonly secondChange = output<number>();
  /** "Đánh dấu mốc": the whole second to turn on or off. */
  readonly bookmark = output<number>();
  /** "Thử lại": the page claims the block again, which renews the media cookie. */
  readonly retry = output<void>();

  protected readonly failed = signal(false);
  protected readonly second = signal(0);
  protected readonly duration = signal(0);
  protected readonly playing = signal(false);
  protected readonly muted = signal(false);
  protected readonly fullscreen = signal(false);
  protected readonly clock = clock;

  private readonly document = inject(DOCUMENT);
  protected readonly fullscreenAvailable = this.document.fullscreenEnabled;
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly player = viewChild<ElementRef<HTMLVideoElement>>('player');
  private beating: Subscription | undefined;
  /** The last position reached by normal playback or resume. */
  private last = 0;
  /** The jump to `startAt` is not something the learner did, so it is not reported. */
  private restoringTo: number | null = null;
  /** The player knows its length, so it can be moved. */
  private ready = false;
  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopBeat());
  }

  protected loaded(): void {
    this.ready = true;
    const video = this.player()?.nativeElement;
    if (!video) return;
    const duration = video.duration;
    this.duration.set(Number.isFinite(duration) ? duration : 0);
    const saved = Math.max(0, this.startAt());
    const atEnd = Number.isFinite(duration) && saved >= duration - 0.01;
    // A completed video left at the end should be ready to replay. Incomplete videos
    // still resume at their saved time, even if the learner skipped to the end.
    const start =
      atEnd && this.completed()
        ? 0
        : Number.isFinite(duration)
          ? Math.min(saved, duration)
          : saved;
    this.last = video.currentTime;
    if (start <= 0 || video.currentTime >= start) {
      this.seen(this.last);
      return;
    }
    this.setPosition(video, start);
  }

  protected async togglePlayback(): Promise<void> {
    const video = this.player()?.nativeElement;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    if (video.ended) this.setPosition(video, 0);
    try {
      await video.play();
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'AbortError')
        this.loadFailed();
    }
  }

  protected toggleMute(): void {
    const video = this.player()?.nativeElement;
    if (video) video.muted = !video.muted;
  }

  protected volumeChanged(): void {
    this.muted.set(this.player()?.nativeElement.muted ?? false);
  }

  protected async toggleFullscreen(): Promise<void> {
    const stage = this.stage()?.nativeElement;
    if (!stage) return;
    try {
      if (this.document.fullscreenElement === stage)
        await this.document.exitFullscreen();
      else await stage.requestFullscreen();
    } catch {
      // Playback remains available inline when the browser blocks fullscreen.
    }
  }

  protected fullscreenChanged(): void {
    this.fullscreen.set(
      this.document.fullscreenElement === this.stage()?.nativeElement,
    );
  }

  protected play(): void {
    const position = this.currentPosition() ?? this.position();
    this.playing.set(true);
    this.last = position;
    this.played.emit(position);
    this.stopBeat();
    this.beating = interval(VIDEO_BEAT_MS).subscribe(() => {
      if (this.player()?.nativeElement.seeking) return;
      this.last = this.position();
      this.beat.emit(this.last);
    });
  }

  protected pause(): void {
    this.stopBeat();
    this.playing.set(false);
    // The native player emits pause before ended when it reaches the end.
    if (this.player()?.nativeElement.ended) return;
    this.last = this.currentPosition() ?? this.position();
    this.paused.emit(this.last);
  }

  protected ended(): void {
    this.stopBeat();
    this.playing.set(false);
    const duration = this.player()?.nativeElement.duration;
    this.last =
      duration !== undefined && Number.isFinite(duration)
        ? duration
        : this.position();
    this.seen(this.last);
    this.paused.emit(this.last);
  }

  protected seeking(): void {
    const video = this.player()?.nativeElement;
    if (!video) return;
    const to = video.currentTime;
    const restoringTo = this.restoringTo;
    this.restoringTo = null;
    if (restoringTo !== null && Math.abs(to - restoringTo) < 0.01) {
      return;
    }
    if (Math.abs(to - this.last) >= 0.01) this.setPosition(video, this.last);
  }

  protected tick(): void {
    const video = this.player()?.nativeElement;
    if (!video || video.seeking || video.ended) return;
    this.last = this.position();
    this.seen(this.last);
  }

  protected bookmarkHere(): void {
    this.bookmark.emit(this.second());
  }

  protected retried(): void {
    this.failed.set(false);
    this.retry.emit();
  }

  /** Where the video is now; the page reads it when the block is closed. */
  currentPosition(): number | undefined {
    if (!this.ready) return undefined;
    const video = this.player()?.nativeElement;
    // Keep the final duration reported by ended(), including a fractional tail.
    return !video || video.ended || video.seeking
      ? this.last
      : video.currentTime;
  }

  protected loadStarted(): void {
    this.ready = false;
    this.restoringTo = null;
    this.stopBeat();
    this.playing.set(false);
    this.duration.set(0);
  }

  protected loadFailed(): void {
    if (this.beating) this.pause();
    this.ready = false;
    this.failed.set(true);
  }

  private setPosition(video: HTMLVideoElement, position: number): void {
    this.restoringTo = position;
    this.last = position;
    video.currentTime = position;
    this.seen(position);
  }

  /** Tells the page when the player enters another whole second. */
  private seen(position: number): void {
    const second = Math.floor(position);
    if (second === this.second()) return;
    this.second.set(second);
    this.secondChange.emit(second);
  }

  private position(): number {
    return this.player()?.nativeElement.currentTime ?? this.last;
  }

  private stopBeat(): void {
    this.beating?.unsubscribe();
    this.beating = undefined;
  }
}
