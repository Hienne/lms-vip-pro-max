import {
  afterRenderEffect,
  Component,
  ElementRef,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { RoomGestureKind, RoomMap, RoomMovement } from '@lms/contracts';
import { Button } from '@lms/ui';
import type {
  RoomCanvasState,
  RoomViewMode,
} from '../../data-access/chat-room.model';

interface RoomRenderer {
  setTouch(x: number, y: number): void;
  setPortrait?(portrait: boolean): void;
}

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
  readonly mode = input<RoomViewMode>('3d');
  readonly gesturesEnabled = input(false);
  readonly gestureNotice = input('');
  readonly moved = output<RoomMovement>();
  readonly gestured = output<RoomGestureKind>();
  readonly ready = output<boolean>();
  readonly failed = output<string>();
  protected readonly portrait = signal(false);
  private readonly mount =
    viewChild.required<ElementRef<HTMLDivElement>>('mount');
  private scene?: RoomRenderer;

  constructor() {
    afterRenderEffect((onCleanup) => {
      const map = this.map();
      const mode = this.mode();
      const mount = this.mount().nativeElement;
      let cancelled = false;
      let destroy: (() => void) | undefined;
      untracked(() => {
        void this.createGame(map, mode, mount, () => cancelled).then(
          (cleanup) => {
            if (cancelled) cleanup();
            else destroy = cleanup;
          },
        );
      });
      onCleanup(() => {
        cancelled = true;
        destroy?.();
      });
    });
  }
  private async createGame(
    map: RoomMap,
    mode: RoomViewMode,
    mount: HTMLDivElement,
    cancelled: () => boolean,
  ): Promise<() => void> {
    try {
      if (mode === '3d') {
        const { RoomOrbit } = await import('./rendering/room-orbit');
        if (cancelled()) return () => undefined;
        const scene = new RoomOrbit(
          map,
          mount,
          () => this.view(),
          (position) => this.moved.emit(position),
          (message) => this.failed.emit(message),
        );
        scene.setPortrait(this.portrait());
        this.scene = scene;
        this.ready.emit(true);
        return () => {
          scene.destroy();
          if (this.scene === scene) this.scene = undefined;
        };
      }
      const [engine, renderer] = await Promise.all([
        import('phaser'),
        import('./rendering/room.scene'),
      ]);
      if (cancelled()) return () => undefined;
      const scene = new renderer.RoomScene(
        map,
        () => this.view(),
        (position) => this.moved.emit(position),
      );
      this.scene = scene;
      const game = new engine.default.Game({
        type: engine.default.AUTO,
        parent: mount,
        backgroundColor: '#e3eae4',
        scale: {
          mode: engine.default.Scale.RESIZE,
          width: '100%',
          height: '100%',
        },
        scene: [scene],
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
        if (this.scene === scene) this.scene = undefined;
      };
    } catch {
      if (!cancelled())
        this.failed.emit(
          mode === '3d'
            ? 'Không khởi tạo được phòng 3D. Hãy thử lại hoặc chọn bản đồ 2D.'
            : 'Không khởi tạo được phòng 2D. Hãy tải lại bản đồ hoặc trình duyệt.',
        );
      return () => undefined;
    }
  }
  protected focus(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest('button')) return;
    (event.currentTarget as HTMLElement).focus();
  }
  protected togglePortrait(): void {
    this.portrait.update((enabled) => !enabled);
    this.scene?.setPortrait?.(this.portrait());
  }
  protected performGesture(kind: RoomGestureKind, event: MouseEvent): void {
    this.gestured.emit(kind);
    if (event.detail > 0) this.focusRoom();
  }
  focusRoom(): void {
    this.mount().nativeElement.parentElement?.focus();
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
