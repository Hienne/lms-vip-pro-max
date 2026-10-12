import { Injectable, signal } from '@angular/core';

@Injectable()
export class SpaceSectionStore {
  private readonly state = {
    /** Bumped to replay the motion samples: the template re-creates them for each value. */
    replay: signal(0),
  };

  readonly replay$ = this.state.replay.asReadonly();

  private setReplay(value: number): void {
    this.state.replay.set(value);
  }

  replayMotion(): void {
    this.setReplay(this.replay$() + 1);
  }
}
