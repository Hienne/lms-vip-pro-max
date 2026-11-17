import { Component, computed, inject, output, signal } from '@angular/core';
import {
  form,
  FormRoot,
  FormField,
  required,
  min,
  max,
  validate,
} from '@angular/forms/signals';
import { Button, Field, Input, SectionCard } from '@lms/ui';
import { type RoomBoardMove, ROOM_MAX_STAKE } from '@lms/contracts';
import { RoomGamesStore } from '../../data-access/room-games.store';
import { ChatRoomStore } from '../../data-access/chat-room.store';

const CHESS: Record<string, string> = {
  K: '♔',
  Q: '♕',
  R: '♖',
  B: '♗',
  N: '♘',
  P: '♙',
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};
const XIANGQI: Record<string, string> = {
  K: '帥',
  A: '仕',
  E: '相',
  H: '傌',
  R: '俥',
  C: '炮',
  P: '兵',
  k: '將',
  a: '士',
  e: '象',
  h: '馬',
  r: '車',
  c: '砲',
  p: '卒',
};
const PIECES: Record<string, string> = {
  k: 'Vua',
  q: 'Hậu',
  r: 'Xe',
  b: 'Tượng',
  n: 'Mã',
  p: 'Tốt',
  a: 'Sĩ',
  e: 'Tượng',
  h: 'Mã',
  c: 'Pháo',
};
const REASONS: Record<string, string> = {
  checkmate: 'Chiếu hết',
  stalemate: 'Hết nước hợp lệ',
  timeout: 'Hết giờ',
  resign: 'Đầu hàng',
  agreement: 'Hai bên đồng ý hòa',
  'dead-position': 'Thế không thể chiếu hết',
  threefold: 'Lặp thế ba lần',
  'fifty-moves': 'Đủ 50 nước mỗi bên',
  fivefold: 'Lặp thế năm lần',
  'seventy-five-moves': 'Đủ 75 nước mỗi bên',
  'natural-movecount': 'Đủ 100 lượt đi theo cách đếm WXF',
  repetition: 'Lặp thế hai bên',
  'invalid-claim': 'Yêu cầu xác minh sai và hết thời gian',
  'perpetual-check': 'Tiếp tục chiếu dai sau cảnh báo',
  'perpetual-chase': 'Tiếp tục đuổi dai sau cảnh báo',
};

@Component({
  selector: 'app-room-board',
  imports: [Button, Field, Input, SectionCard, FormRoot, FormField],
  templateUrl: './room-board.html',
  styleUrl: './room-board.scss',
})
export class RoomBoard {
  protected readonly Math = Math;
  protected readonly games = inject(RoomGamesStore);
  protected readonly room = inject(ChatRoomStore);
  readonly closed = output<void>();
  protected readonly board = this.games.board$;
  protected readonly match = computed(() => this.board()?.match);
  protected readonly preparing = this.games.boardPreparing$;
  protected readonly width = computed(() =>
    this.board()?.kind === 'xiangqi' ? 9 : 8,
  );
  protected readonly height = computed(() =>
    this.board()?.kind === 'xiangqi' ? 10 : 8,
  );
  protected readonly selected = this.games.boardSelected$;
  protected readonly promotion = this.games.boardPromotion$;
  protected readonly claimPlanned = this.games.boardClaimPlanned$;
  protected readonly flipped = this.games.boardFlipped$;
  protected readonly cells = computed(() => {
    const match = this.match();
    const indexes = Array.from(
      { length: this.width() * this.height() },
      (_, i) => i,
    );
    return (match?.side === 1) !== this.flipped() ? indexes.reverse() : indexes;
  });
  protected readonly canPlay = computed(() => {
    const match = this.match();
    return (
      this.board()?.seated &&
      match?.result === 'playing' &&
      match.side === match.turn
    );
  });
  protected readonly destinations = computed(
    () =>
      new Set(
        this.match()
          ?.legal.filter((move) => move.from === this.selected())
          .map((move) => move.to),
      ),
  );
  private readonly contribution = signal<{ points: number | null }>({
    points: 10,
  });
  protected readonly readyForm = form(
    this.contribution,
    (path) => {
      required(path.points, { message: 'Nhập số CPoint góp.' });
      min(path.points, 10, { message: 'Mỗi bạn góp ít nhất 10 CPoint.' });
      max(
        path.points,
        () => Math.min(ROOM_MAX_STAKE, this.games.balance$() ?? 0),
        { message: 'Bạn chưa đủ CPoint.' },
      );
      validate(path.points, ({ value }) =>
        value() !== null && !Number.isSafeInteger(value())
          ? { kind: 'integer', message: 'Nhập số nguyên.' }
          : undefined,
      );
    },
    {
      submission: {
        action: async () => {
          const board = this.board();
          const points = board?.readyNames.length
            ? board.points
            : this.contribution().points;
          if (points !== null && points !== undefined)
            this.games.readyBoard(points);
        },
      },
    },
  );
  protected readyWithPoints(): void {
    const points = this.board()?.points;
    if (points !== undefined) this.games.readyBoard(points);
  }
  protected sit(): void {
    const map = this.room.map$();
    const table = map?.boardTables.find(
      (table) => table.id === this.board()?.table,
    );
    const side = this.match()?.side ?? -1;
    const occupied = new Set(this.room.players$().map((player) => player.seat));
    const chair =
      side >= 0
        ? table?.chairs[side]
        : table?.chairs.find((chair) => !occupied.has(chair));
    if (chair !== undefined)
      this.room.interact({ type: 'seat', action: 'sit', chair });
  }
  protected choose(cell: number): void {
    this.games.chooseBoardCell(cell);
  }
  protected sendMove(move: RoomBoardMove): void {
    this.games.chooseBoardMove(move);
  }
  protected glyph(cell: number): string {
    const piece = this.match()?.board[cell] ?? '.';
    return (this.board()?.kind === 'xiangqi' ? XIANGQI : CHESS)[piece] ?? '';
  }
  protected label(cell: number): string {
    const piece = this.match()?.board[cell] ?? '.';
    const xiangqi = this.board()?.kind === 'xiangqi';
    const pieceName =
      xiangqi && piece.toLowerCase() === 'k'
        ? 'Tướng'
        : PIECES[piece.toLowerCase()];
    const square =
      String.fromCharCode(97 + (cell % this.width())) +
      (this.height() - Math.floor(cell / this.width()));
    return (
      square +
      (piece === '.'
        ? ', trống'
        : ', ' +
          pieceName +
          (piece === piece.toUpperCase()
            ? xiangqi
              ? ', đỏ'
              : ', trắng'
            : ', đen'))
    );
  }
  protected clock(side: number): string {
    const match = this.match();
    const millis = Math.max(
      0,
      (match?.clocks[side] ?? 0) -
        (match?.result === 'playing' && match.turn === side
          ? this.games.now$() - match.serverTime
          : 0),
    );
    const seconds = Math.ceil(millis / 1000);
    return (
      Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')
    );
  }
  protected reason(): string {
    return REASONS[this.match()?.reason ?? ''] ?? '';
  }
  protected key(event: KeyboardEvent): void {
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -this.width(),
      ArrowDown: this.width(),
    };
    const delta = offsets[event.key];
    if (delta === undefined) return;
    const current = event.target as HTMLButtonElement;
    const parent = event.currentTarget as HTMLElement;
    const cells = [
      ...parent.querySelectorAll<HTMLButtonElement>('[data-board-cell]'),
    ];
    const index = cells.indexOf(current);
    const nextIndex = index + delta;
    if (
      index < 0 ||
      nextIndex < 0 ||
      nextIndex >= cells.length ||
      (Math.abs(delta) === 1 &&
        Math.floor(index / this.width()) !==
          Math.floor(nextIndex / this.width()))
    )
      return;
    event.preventDefault();
    current.tabIndex = -1;
    cells[nextIndex].tabIndex = 0;
    cells[nextIndex].focus();
  }
}
