import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  max,
  min,
  required,
  validate,
} from '@angular/forms/signals';
import {
  ROOM_CARO_BOARD_SIZE,
  ROOM_MAX_STAKE,
  type RoomCaroInvitation,
  type RoomCaroState,
  type RoomPlayer,
} from '@lms/contracts';
import { Button, Field, Input, SectionCard, Select } from '@lms/ui';

@Component({
  selector: 'app-room-caro',
  imports: [Button, Field, Input, SectionCard, Select, FormField, FormRoot],
  templateUrl: './room-caro.html',
  styleUrl: './room-caro.scss',
})
export class RoomCaro {
  readonly me = input.required<string>();
  readonly balance = input.required<number>();
  readonly nearby = input.required<readonly RoomPlayer[]>();
  readonly invitation = input<RoomCaroInvitation | null>(null);
  readonly state = input<RoomCaroState | null>(null);
  readonly seconds = input(0);
  readonly error = input('');
  readonly closed = output<void>();
  readonly restarted = output<void>();
  readonly challenged = output<{ target: string; stake: number }>();
  readonly replied = output<boolean>();
  readonly played = output<number>();

  private readonly viewport =
    viewChild<ElementRef<HTMLDivElement>>('boardViewport');
  private readonly gameId = computed(() => this.state()?.id);
  private drag?: {
    pointerId: number;
    x: number;
    y: number;
    left: number;
    top: number;
  };
  private dragged = false;

  protected readonly size = ROOM_CARO_BOARD_SIZE;
  protected readonly centerCell =
    Math.floor((this.size - 1) / 2) * (this.size + 1);
  protected readonly cells = computed(() => [...(this.state()?.board ?? '')]);
  protected readonly turn = computed(() =>
    (this.state()?.moves ?? 0) % 2 === 0 ? 'X' : 'O',
  );
  protected readonly canPlay = computed(
    () =>
      !this.state()?.result &&
      this.turn() === this.state()?.piece &&
      this.seconds() > 0,
  );
  private readonly challenge = signal<{ target: string; stake: number | null }>(
    { target: '', stake: 0 },
  );
  protected readonly challengeForm = form(
    this.challenge,
    (path) => {
      required(path.target, { message: 'Chọn người muốn thách đấu.' });
      required(path.stake, { message: 'Nhập mức cược.' });
      min(path.stake, 0, { message: 'Mức cược tối thiểu là 0.' });
      max(path.stake, () => Math.min(this.balance(), ROOM_MAX_STAKE), {
        message: 'Mức cược vượt số token hiện có.',
      });
      validate(path.stake, ({ value }) => {
        const stake = value();
        return stake !== null && !Number.isSafeInteger(stake)
          ? { kind: 'integer', message: 'Nhập số token nguyên.' }
          : undefined;
      });
    },
    {
      submission: {
        action: async () => {
          const { target, stake } = this.challenge();
          if (
            stake !== null &&
            this.nearby().some((player) => player.id === target)
          )
            this.challenged.emit({ target, stake });
        },
      },
    },
  );

  constructor() {
    afterRenderEffect(() => {
      if (this.gameId()) this.centerBoard();
    });
  }

  protected centerBoard(): void {
    const viewport = this.viewport()?.nativeElement;
    if (!viewport) return;
    viewport.scrollTo({
      left: (viewport.scrollWidth - viewport.clientWidth) / 2,
      top: (viewport.scrollHeight - viewport.clientHeight) / 2,
      behavior: 'instant',
    });

    const current = viewport.querySelector<HTMLButtonElement>(
      '[data-cell][tabindex="0"]',
    );
    const center = viewport.querySelector<HTMLButtonElement>(
      `[data-cell="${this.centerCell}"]`,
    );
    if (current && current !== center) current.tabIndex = -1;
    if (center) center.tabIndex = 0;
  }

  protected startPan(event: PointerEvent): void {
    this.dragged = false;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const viewport = event.currentTarget as HTMLDivElement;
    this.drag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
  }

  protected pan(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!(event.buttons & 1)) {
      this.drag = undefined;
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const viewport = event.currentTarget as HTMLDivElement;
    if (!this.dragged) {
      if (Math.hypot(dx, dy) < 6) return;
      viewport.setPointerCapture(event.pointerId);
      this.dragged = true;
    }
    viewport.scrollLeft = drag.left - dx;
    viewport.scrollTop = drag.top - dy;
  }

  protected endPan(event: PointerEvent): void {
    if (this.drag?.pointerId === event.pointerId) this.drag = undefined;
  }

  protected playCell(event: MouseEvent, index: number, piece: string): void {
    if (
      (!this.dragged || event.detail === 0) &&
      this.canPlay() &&
      piece === '.'
    ) {
      this.played.emit(index);
    }
  }

  protected cellLabel(cell: number, piece: string): string {
    const size = this.size;
    return `Hàng ${Math.floor(cell / size) + 1}, cột ${(cell % size) + 1}, ${piece === '.' ? 'trống' : piece}`;
  }

  protected moveFocus(event: KeyboardEvent): void {
    const cell = event.target as HTMLButtonElement;
    const index = Number(cell.dataset['cell']);
    if (!Number.isInteger(index)) return;
    const size = this.size;
    const offsets: Record<string, number> = {
      ArrowLeft: index % size > 0 ? -1 : 0,
      ArrowRight: index % size < size - 1 ? 1 : 0,
      ArrowUp: -size,
      ArrowDown: size,
    };
    const offset = offsets[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    const board = event.currentTarget as HTMLElement;
    const next = board.querySelector<HTMLButtonElement>(
      `[data-cell="${index + offset}"]`,
    );
    if (next && next !== cell) {
      cell.tabIndex = -1;
      next.tabIndex = 0;
      next.focus();
    }
  }
}
