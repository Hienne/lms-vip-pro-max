import {
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { TranscriptLine, VideoChapter } from '@lms/contracts';
import { Button, Icon } from '@lms/ui';
import { interval, type Subscription } from 'rxjs';
import { clock } from '../../../../../shared/learning/anchor';
import type { BlockJump } from '../pdf-block/pdf-block';
import { VideoChapters } from './components/video-chapters/video-chapters';
import { VideoTranscript } from './components/video-transcript/video-transcript';

/** A playing video reports its range this often; the heartbeat keeps the media cookie alive. */
export const VIDEO_BEAT_MS = 10_000;

export interface VideoSeek {
  readonly from: number;
  readonly to: number;
  readonly playing: boolean;
}

/**
 * A `video` block: the native player on the block's content URL. It only reports what the learner
 * does (play, pause, a beat every 10 s while playing, seeks, the whole second it is at); the store
 * decides what to send. A `jump` moves the player, which then reports it as a seek.
 */
@Component({
  selector: 'app-video-block',
  imports: [Button, Icon, VideoChapters, VideoTranscript],
  templateUrl: './video-block.html',
  styleUrl: './video-block.scss',
})
export class VideoBlock {
  readonly src = input.required<string>();
  /** Where the video resumes, in seconds; it never starts by itself. */
  readonly startAt = input(0);
  readonly title = input('');
  /** Moves the player to this second; a new object is a new request, even for the same second. */
  readonly jump = input<BlockJump | null>(null);
  /** The chapters of the video, in time order; a click on one moves the player. */
  readonly chapters = input<readonly VideoChapter[]>([]);
  /** The timed lines of the video, in time order; a click on one moves the player. */
  readonly transcript = input<readonly TranscriptLine[]>([]);
  /** The second the player is at is bookmarked. */
  readonly bookmarked = input(false);
  /** A bookmark change is in flight, so the button waits. */
  readonly busy = input(false);

  readonly played = output<number>();
  readonly paused = output<number>();
  readonly beat = output<number>();
  readonly jumped = output<VideoSeek>();
  /** The whole second the player is at, each time it changes. */
  readonly secondChange = output<number>();
  /** "Đánh dấu mốc": the whole second to turn on or off. */
  readonly bookmark = output<number>();
  /** "Thử lại": the page claims the block again, which renews the media cookie. */
  readonly retry = output<void>();

  protected readonly failed = signal(false);
  protected readonly second = signal(0);
  protected readonly clock = clock;

  private readonly player = viewChild<ElementRef<HTMLVideoElement>>('player');
  private beating: Subscription | undefined;
  /** The last position this component knows, the start of the next seek. */
  private last = 0;
  /** The jump to `startAt` is not something the learner did, so it is not reported. */
  private restoring = false;
  /** The player knows its length, so it can be moved. */
  private ready = false;
  /** The last jump carried out, so a retry's new metadata does not repeat it. */
  private jumpDone: BlockJump | null = null;

  /** A jump moves the player at once, or when its metadata arrives. */
  private readonly follow = effect(() => {
    const jump = this.jump();
    if (jump && untracked(() => this.ready)) this.moveTo(jump);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopBeat());
  }

  protected loaded(): void {
    this.ready = true;
    const jump = this.jump();
    if (jump && jump !== this.jumpDone) return this.moveTo(jump);
    const video = this.player()?.nativeElement;
    const start = this.startAt();
    if (!video || start <= 0 || video.currentTime >= start) return;
    this.restoring = true;
    video.currentTime = start;
    this.last = start;
    this.seen(start);
  }

  protected play(): void {
    const position = this.position();
    this.last = position;
    this.played.emit(position);
    this.stopBeat();
    this.beating = interval(VIDEO_BEAT_MS).subscribe(() => {
      this.last = this.position();
      this.beat.emit(this.last);
    });
  }

  protected pause(): void {
    this.stopBeat();
    // The native player emits pause before ended when it reaches the end.
    if (this.player()?.nativeElement.ended) return;
    this.last = this.position();
    this.paused.emit(this.last);
  }

  protected ended(): void {
    this.stopBeat();
    const duration = this.player()?.nativeElement.duration;
    this.last =
      duration !== undefined && Number.isFinite(duration)
        ? duration
        : this.position();
    this.seen(this.last);
    this.paused.emit(this.last);
  }

  protected seeking(): void {
    const to = this.position();
    if (this.restoring) {
      this.restoring = false;
      return;
    }
    const playing = !this.player()?.nativeElement.paused;
    this.jumped.emit({ from: this.last, to, playing });
    this.last = to;
    this.seen(to);
  }

  protected tick(): void {
    if (this.player()?.nativeElement.seeking) return;
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
  currentPosition(): number {
    return this.player()?.nativeElement.currentTime ?? this.last;
  }

  /** A chapter or transcript line moves the player, which reports it as a seek like any other. */
  protected seekTo(second: number): void {
    const video = this.player()?.nativeElement;
    if (video) video.currentTime = second;
  }

  private moveTo(jump: BlockJump): void {
    const video = this.player()?.nativeElement;
    if (!video) return;
    this.jumpDone = jump;
    video.currentTime = jump.value;
  }

  /** Tells the page when the player enters another whole second. */
  private seen(position: number): void {
    const second = Math.floor(position);
    if (second === this.second()) return;
    this.second.set(second);
    this.secondChange.emit(second);
  }

  private position(): number {
    return this.currentPosition();
  }

  private stopBeat(): void {
    this.beating?.unsubscribe();
    this.beating = undefined;
  }
}
