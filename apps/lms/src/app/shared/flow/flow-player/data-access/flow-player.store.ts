import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import type { FlowModel } from '@lms/contracts';
import { FLOW_REDUCED_MOTION, FLOW_WEBGL } from '../../flow-support';

/** How long each Bước chuyển stays on screen while playing. */
export const FLOW_STEP_MS = 3000;

const EMPTY: FlowModel = { version: 1, objects: [], steps: [] };

/** Playback of one Mô phỏng luồng: which step is shown and whether it moves on by itself. */
@Injectable()
export class FlowPlayerStore {
  private readonly state = {
    flow: signal<FlowModel>(EMPTY),
    index: signal(0),
    playing: signal(false),
    sceneFailed: signal(false),
  };

  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly flow$ = this.state.flow.asReadonly();
  readonly index$ = this.state.index.asReadonly();
  readonly playing$ = this.state.playing.asReadonly();
  readonly reducedMotion$ = computed(() => this.reducedMotion);
  readonly showScene$ = computed(() => this.webgl && !this.state.sceneFailed());
  readonly total$ = computed(() => this.state.flow().steps.length);
  readonly step$ = computed(
    () => this.state.flow().steps[this.state.index()] ?? null,
  );
  readonly atEnd$ = computed(() => this.state.index() >= this.total$() - 1);
  readonly counter$ = computed(() =>
    this.total$() ? `Bước ${this.state.index() + 1}/${this.total$()}` : '',
  );

  private readonly webgl = inject(FLOW_WEBGL);
  private readonly reducedMotion = inject(FLOW_REDUCED_MOTION);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearTimer());
  }

  setFlow(flow: FlowModel): void {
    this.state.flow.set(flow);
    if (this.state.index() >= flow.steps.length) this.setIndex(0);
  }

  setIndex(index: number): void {
    this.state.index.set(index);
  }

  setPlaying(playing: boolean): void {
    this.state.playing.set(playing);
  }

  setSceneFailed(failed: boolean): void {
    this.state.sceneFailed.set(failed);
  }

  /** Plays from the current step; from the last step it starts over. Reduced motion never auto-advances. */
  play(): void {
    if (!this.total$() || this.reducedMotion$()) return;
    if (this.atEnd$()) this.setIndex(0);
    this.setPlaying(true);
    this.schedule();
  }

  pause(): void {
    this.setPlaying(false);
    this.clearTimer();
  }

  toggle(): void {
    if (this.state.playing()) this.pause();
    else this.play();
  }

  next(): void {
    this.seek(this.state.index() + 1);
  }

  prev(): void {
    this.seek(this.state.index() - 1);
  }

  replay(): void {
    this.seek(0);
    this.play();
  }

  /** Jumps to a step (a list click, prev or next); playing keeps playing from there. */
  seek(index: number): void {
    const last = this.total$() - 1;
    if (last < 0) return;
    this.setIndex(Math.max(0, Math.min(index, last)));
    if (this.state.playing()) this.schedule();
  }

  sceneFailed(): void {
    this.setSceneFailed(true);
  }

  private schedule(): void {
    this.clearTimer();
    this.timer = setTimeout(() => this.advance(), FLOW_STEP_MS);
  }

  private advance(): void {
    this.timer = undefined;
    if (this.atEnd$()) {
      this.pause();
      return;
    }
    this.setIndex(this.state.index() + 1);
    if (this.atEnd$()) this.pause();
    else this.schedule();
  }

  private clearTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
