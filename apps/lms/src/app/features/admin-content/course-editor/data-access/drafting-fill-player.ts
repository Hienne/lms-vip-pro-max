import { DRAFTING_FIELD_DELAY_MS, type DraftingPatch } from './drafting-fill';

/**
 * Plays a step's writes one at a time, {@link DRAFTING_FIELD_DELAY_MS} apart, so the author watches
 * the step fill: the first write at once, `done` right after the last one. It holds only its timer;
 * what each write does is the caller's. A new `play` or `cancel` drops the writes still waiting.
 */
export class FillPlayer {
  private timer: ReturnType<typeof setTimeout> | undefined;

  play(
    patches: readonly DraftingPatch[],
    write: (patch: DraftingPatch) => void,
    done: () => void,
  ): void {
    this.cancel();
    const waiting = [...patches];
    const next = (): void => {
      this.timer = undefined;
      const patch = waiting.shift();
      if (patch) write(patch);
      if (waiting.length)
        this.timer = setTimeout(next, DRAFTING_FIELD_DELAY_MS);
      else done();
    };
    next();
  }

  cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
