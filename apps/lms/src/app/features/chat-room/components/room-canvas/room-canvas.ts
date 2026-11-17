import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type {
  RoomGestureKind,
  RoomInteractionCommand,
  RoomMap,
  RoomMovement,
  RoomReactionId,
} from '@lms/contracts';
import { Button } from '@lms/ui';
import { ROOM_REACTIONS } from '@lms/contracts';
import type {
  RoomCanvasState,
  RoomInvitationView,
} from '../../data-access/chat-room.model';

interface RoomRenderer {
  setTouch(x: number, y: number): void;
  setPortrait(portrait: boolean): void;
  chairAt(clientX: number, clientY: number): number | undefined;
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
  readonly gesturesEnabled = input(false);
  readonly interactionsEnabled = input(false);
  readonly reactionsEnabled = input(false);
  readonly reacted = output<RoomReactionId>();
  protected readonly reactions = ROOM_REACTIONS;
  readonly invitation = input<RoomInvitationView | null>(null);
  readonly gestureNotice = input('');
  readonly moved = output<RoomMovement>();
  readonly gestured = output<RoomGestureKind>();
  readonly interacted = output<RoomInteractionCommand>();
  readonly ready = output<boolean>();
  readonly failed = output<string>();
  protected readonly portrait = signal(false);
  protected readonly seated = computed(() => {
    const view = this.view();
    return (
      view.players.find((player) => player.id === view.me)?.seat !== undefined
    );
  });
  private readonly mount =
    viewChild.required<ElementRef<HTMLDivElement>>('mount');
  private scene?: RoomRenderer;
  private chairPointer?: { id: number; x: number; y: number };
  protected chooseReaction(
    reaction: RoomReactionId,
    picker: HTMLDetailsElement,
  ): void {
    this.reacted.emit(reaction);
    picker.removeAttribute('open');
    picker.querySelector('summary')?.focus();
  }

  constructor() {
    afterRenderEffect((onCleanup) => {
      const map = this.map();
      const mount = this.mount().nativeElement;
      let cancelled = false;
      let destroy: (() => void) | undefined;
      untracked(() => {
        void this.createGame(map, mount, () => cancelled).then((cleanup) => {
          if (cancelled) cleanup();
          else destroy = cleanup;
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
    } catch {
      if (!cancelled())
        this.failed.emit(
          'Không khởi tạo được phòng 3D. Hãy tải lại trang hoặc kiểm tra hỗ trợ WebGL.',
        );
      return () => undefined;
    }
  }
  protected focus(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest('button, summary')) return;
    if (
      event.button === 0 &&
      event.target instanceof HTMLCanvasElement &&
      this.interactionsEnabled()
    ) {
      this.chairPointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
    }
    (event.currentTarget as HTMLElement).focus({ preventScroll: true });
  }
  protected trackChairPointer(event: PointerEvent): void {
    const pointer = this.chairPointer;
    if (
      pointer?.id === event.pointerId &&
      Math.hypot(pointer.x - event.clientX, pointer.y - event.clientY) > 7
    ) {
      this.chairPointer = undefined;
    }
  }
  protected pickChair(event: PointerEvent): void {
    const pointer = this.chairPointer;
    this.chairPointer = undefined;
    if (
      pointer?.id !== event.pointerId ||
      this.view().chatting ||
      this.seated()
    )
      return;
    const chair = this.scene?.chairAt(event.clientX, event.clientY);
    if (chair !== undefined)
      this.interacted.emit({ type: 'seat', action: 'sit', chair });
  }
  protected togglePortrait(): void {
    this.portrait.update((enabled) => !enabled);
    this.scene?.setPortrait(this.portrait());
  }
  protected performGesture(kind: RoomGestureKind, event: MouseEvent): void {
    this.gestured.emit(kind);
    if (event.detail > 0) this.focusRoom();
  }
  protected interact(command: RoomInteractionCommand, event: MouseEvent): void {
    this.interacted.emit(command);
    if (event.detail > 0) this.focusRoom();
  }
  focusRoom(): void {
    this.mount().nativeElement.parentElement?.focus({ preventScroll: true });
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
