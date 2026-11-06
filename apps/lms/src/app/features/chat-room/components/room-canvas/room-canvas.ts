import {
  afterRenderEffect,
  Component,
  ElementRef,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import type { RoomMap } from '@lms/contracts';
import { Button } from '@lms/ui';
import type { RoomScene } from './rendering/room.scene';
import type { RoomCanvasState } from '../../data-access/chat-room.model';

@Component({
  selector: 'app-room-canvas',
  imports: [Button],
  templateUrl: './room-canvas.html',
  styleUrl: './room-canvas.scss',
  host: { '(window:keydown)': 'preventScroll($event)' },
})
export class RoomCanvas {
  readonly map = input.required<RoomMap>();
  readonly view = input.required<RoomCanvasState>();
  readonly moved = output<{ x: number; y: number }>();
  readonly ready = output<boolean>();
  readonly failed = output<string>();
  private readonly mount =
    viewChild.required<ElementRef<HTMLDivElement>>('mount');
  private scene?: RoomScene;

  constructor() {
    afterRenderEffect((onCleanup) => {
      const map = this.map();
      const mount = this.mount().nativeElement;
      let cancelled = false;
      let destroy: (() => void) | undefined;
      untracked(() => {
        void this.createGame(map, mount, () => cancelled).then((cleanup) => {
          destroy = cleanup;
        });
      });
      onCleanup(() => {
        cancelled = true;
        destroy?.();
      });
    });
  }
  private async createGame(
    map: RoomMap,
    mount: HTMLDivElement,
    cancelled: () => boolean,
  ): Promise<() => void> {
    try {
      const [engine, renderer] = await Promise.all([
        import('phaser'),
        import('./rendering/room.scene'),
      ]);
      if (cancelled()) return () => undefined;
      this.scene = new renderer.RoomScene(
        map,
        () => this.view(),
        (x, y) => this.moved.emit({ x, y }),
      );
      const game = new engine.default.Game({
        type: engine.default.AUTO,
        parent: mount,
        backgroundColor: '#e3eae4',
        scale: {
          mode: engine.default.Scale.RESIZE,
          width: '100%',
          height: '100%',
        },
        scene: [this.scene],
        render: { roundPixels: true },
        audio: { noAudio: true },
        callbacks: {
          postBoot: () => {
            if (!cancelled()) this.ready.emit(true);
          },
        },
      });
      return () => {
        game.destroy(true);
        this.scene = undefined;
      };
    } catch {
      if (!cancelled())
        this.failed.emit(
          'Không khởi tạo được phòng 2D. Hãy tải lại bản đồ hoặc trình duyệt.',
        );
      return () => undefined;
    }
  }
  protected focus(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).focus();
  }
  protected preventScroll(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (
      this.view().online &&
      target.closest('app-room-canvas') &&
      event.key.startsWith('Arrow')
    )
      event.preventDefault();
  }
  protected touch(event: PointerEvent, x: number, y: number): void {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    (document.activeElement as HTMLElement)?.blur();
    this.scene?.setTouch(x, y);
  }
  protected stopTouch(): void {
    this.scene?.setTouch(0, 0);
  }
}
