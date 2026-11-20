import {
  Component,
  effect,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import type { FlowModel } from '@lms/contracts';
import { Button, Card, Icon, IconButton } from '@lms/ui';
import { FlowCanvas } from '../flow-canvas/flow-canvas';
import { FlowPlayerStore } from './data-access/flow-player.store';

/**
 * Plays a Mô phỏng luồng back: the 3D scene with the player bar under it and the step list beside it
 * (under it on narrow screens). Without WebGL the numbered list stands in for the scene. The step list
 * is the accessible content; the canvas is `aria-hidden`.
 */
@Component({
  selector: 'app-flow-player',
  imports: [FlowCanvas, Button, Card, Icon, IconButton],
  providers: [FlowPlayerStore],
  templateUrl: './flow-player.html',
  styleUrl: './flow-player.scss',
})
export class FlowPlayer {
  readonly flow = input.required<FlowModel>();

  protected readonly store = inject(FlowPlayerStore);
  private readonly canvas = viewChild(FlowCanvas);

  constructor() {
    // The document is an input; the store owns playback over it.
    effect(() => {
      const flow = this.flow();
      untracked(() => this.store.setFlow(flow));
    });
  }

  protected reframe(): void {
    this.canvas()?.fit();
  }
}
