import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Button } from '@lms/ui';
import { interval, type Subscription } from 'rxjs';

/** A playing video reports its range this often; the heartbeat keeps the media cookie alive. */
export const VIDEO_BEAT_MS = 10_000;

export interface VideoSeek {
  readonly from: number;
  readonly to: number;
  readonly playing: boolean;
}

/**
 * A `video` block: the native player on the block's content URL. It only reports what the learner
 * does (play, pause, a beat every 10 s while playing, seeks); the store decides what to send.
 */
@Component({
  selector: 'app-video-block',
  imports: [Button],
  templateUrl: './video-block.html',
  styleUrl: './video-block.scss',
})
export class VideoBlock {
  readonly src = input.required<string>();
  /** Where the video resumes, in seconds; it never starts by itself. */
  readonly startAt = input(0);
  readonly title = input('');

  readonly played = output<number>();
  readonly paused = output<number>();
  readonly beat = output<number>();
  readonly jumped = output<VideoSeek>();
  /** "Thử lại": the page claims the block again, which renews the media cookie. */
  readonly retry = output<void>();

  protected readonly failed = signal(false);

  private readonly player = viewChild<ElementRef<HTMLVideoElement>>('player');
  private beating: Subscription | undefined;
  /** The last position this component knows, the start of the next seek. */
  private last = 0;
  /** The jump to `startAt` is not something the learner did, so it is not reported. */
  private restoring = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopBeat());
  }

  protected loaded(): void {
    const video = this.player()?.nativeElement;
    const start = this.startAt();
    if (!video || start <= 0 || video.currentTime >= start) return;
    this.restoring = true;
    video.currentTime = start;
    this.last = start;
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
    this.last = this.position();
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
  }

  protected tick(): void {
    this.last = this.position();
  }

  protected retried(): void {
    this.failed.set(false);
    this.retry.emit();
  }

  private position(): number {
    return this.player()?.nativeElement.currentTime ?? 0;
  }

  private stopBeat(): void {
    this.beating?.unsubscribe();
    this.beating = undefined;
  }
}
