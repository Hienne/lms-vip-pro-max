import {
  afterRenderEffect,
  Component,
  effect,
  ElementRef,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import type { FlowObject, FlowStep } from '@lms/contracts';
import type { FlowScene, FlowSceneMode } from '../flow-scene';

/**
 * Hosts the three.js scene of a Mô phỏng luồng. three.js arrives by dynamic `import()` the first time a
 * canvas renders, so no other chunk carries it. Presentational: it draws its inputs and reports
 * pointer intents; the parent's store decides what changes.
 */
@Component({
  selector: 'app-flow-canvas',
  template: `<div #mount class="flow-canvas"></div>`,
  styles: `
    :host,
    .flow-canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class FlowCanvas {
  readonly objects = input.required<readonly FlowObject[]>();
  readonly steps = input.required<readonly FlowStep[]>();
  readonly active = input<FlowStep | null>(null);
  readonly selectedId = input<string | null>(null);
  readonly mode = input<FlowSceneMode>('learner');
  readonly reducedMotion = input(false);

  readonly selected = output<string | null>();
  readonly moved = output<{ id: string; x: number; z: number }>();
  readonly linked = output<{ from: string; to: string | null }>();
  /** The scene could not start (WebGL lost or refused); the parent shows its fallback. */
  readonly failed = output<void>();

  private readonly mount = viewChild.required<ElementRef<HTMLElement>>('mount');
  private scene: FlowScene | undefined;
  private framed = false;

  constructor() {
    // Creates the scene once the host is in the DOM and disposes it on destroy.
    afterRenderEffect((onCleanup) => {
      const host = this.mount().nativeElement;
      let cancelled = false;
      untracked(() => {
        void import('../flow-scene')
          .then(({ FlowScene }) => {
            if (cancelled) return;
            this.scene = new FlowScene(host, {
              select: (id) => this.selected.emit(id),
              move: (id, x, z) => this.moved.emit({ id, x, z }),
              link: (from, to) => this.linked.emit({ from, to }),
            });
            this.push();
          })
          .catch(() => {
            if (!cancelled) this.failed.emit();
          });
      });
      onCleanup(() => {
        cancelled = true;
        this.scene?.dispose();
        this.scene = undefined;
        this.framed = false;
      });
    });
    // Mirrors the inputs into the scene (a non-reactive three.js object).
    effect(() => {
      this.objects();
      this.steps();
      this.active();
      this.selectedId();
      this.mode();
      this.reducedMotion();
      untracked(() => this.push());
    });
  }

  /** Frames every Đối tượng again ("Về góc nhìn ban đầu"). */
  fit(): void {
    this.scene?.fit();
  }

  /** The floor cell under a screen point, for drops from the palette. */
  floorAt(clientX: number, clientY: number): { x: number; z: number } | null {
    return this.scene?.floorAt(clientX, clientY) ?? null;
  }

  private push(): void {
    const scene = this.scene;
    if (!scene) return;
    scene.setMode(this.mode());
    scene.setReducedMotion(this.reducedMotion());
    scene.setData(this.objects(), this.steps(), this.selectedId());
    scene.setActive(this.active());
    if (!this.framed) {
      scene.fit();
      this.framed = true;
    }
  }
}
