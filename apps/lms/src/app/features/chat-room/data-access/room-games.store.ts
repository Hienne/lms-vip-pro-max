import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import type {
  RoomCaroInvitation,
  RoomCaroState,
  RoomCaroTable,
  RoomCommand,
  RoomDiceBet,
  RoomDiceState,
  RoomEvent,
  RoomRank,
  RoomBoardState,
  RoomBoardTables,
  RoomBoardMove,
  RoomColorFloorState,
} from '@lms/contracts';

type RoomPanel = 'dice' | 'caro' | 'rank' | 'board';

@Injectable()
export class RoomGamesStore {
  private readonly state = {
    panel: signal<RoomPanel | null>(null),
    balance: signal<number | null>(null),
    dice: signal<RoomDiceState | null>(null),
    pending: signal(false),
    diceError: signal(''),
    rank: signal<readonly RoomRank[] | null>(null),
    invitation: signal<RoomCaroInvitation | null>(null),
    caro: signal<RoomCaroState | null>(null),
    caroTable: signal<RoomCaroTable | null>(null),
    caroError: signal(''),
    now: signal(Date.now()),
    board: signal<RoomBoardState | null>(null),
    boardTables: signal<RoomBoardTables>([]),
    boardError: signal(''),
    floor: signal<RoomColorFloorState | null>(null),
    boardSelected: signal<number | null>(null),
    boardPromotion: signal<RoomBoardMove[]>([]),
    boardClaimPlanned: signal(false),
    boardFlipped: signal(false),
    boardPreparing: signal(false),
  };
  private send?: (command: RoomCommand) => void;
  private clock?: ReturnType<typeof setInterval>;
  private clockOffset = 0;
  private boardRequested = false;
  readonly board$ = this.state.board.asReadonly();
  readonly boardTables$ = this.state.boardTables.asReadonly();
  readonly boardError$ = this.state.boardError.asReadonly();
  readonly floor$ = this.state.floor.asReadonly();
  readonly now$ = this.state.now.asReadonly();
  readonly boardSelected$ = this.state.boardSelected.asReadonly();
  readonly boardPromotion$ = this.state.boardPromotion.asReadonly();
  readonly boardClaimPlanned$ = this.state.boardClaimPlanned.asReadonly();
  readonly boardFlipped$ = this.state.boardFlipped.asReadonly();
  readonly boardPreparing$ = this.state.boardPreparing.asReadonly();
  readonly boardCanPlay$ = computed(() => {
    const board = this.board$();
    return (
      board?.seated &&
      board.match?.result === 'playing' &&
      board.match.side === board.match.turn
    );
  });
  readonly floorSeconds$ = computed(() =>
    this.seconds(this.floor$()?.deadline),
  );

  readonly panel$ = this.state.panel.asReadonly();
  readonly balance$ = this.state.balance.asReadonly();
  readonly dice$ = this.state.dice.asReadonly();
  readonly pending$ = this.state.pending.asReadonly();
  readonly diceError$ = this.state.diceError.asReadonly();
  readonly rank$ = this.state.rank.asReadonly();
  readonly invitation$ = this.state.invitation.asReadonly();
  readonly caro$ = this.state.caro.asReadonly();
  readonly caroTable$ = this.state.caroTable.asReadonly();
  readonly visibleCaro$ = computed(() => {
    const table = this.caroTable$();
    const game = this.caro$();
    return table && (table.playing || table.paused || game?.result)
      ? game
      : null;
  });
  readonly caroError$ = this.state.caroError.asReadonly();
  readonly latestDice$ = computed(() => this.dice$()?.history[0]);
  readonly diceSeconds$ = computed(() => this.seconds(this.dice$()?.closesAt));
  readonly caroSeconds$ = computed(() => this.seconds(this.caro$()?.expiresAt));

  constructor() {
    this.clock = setInterval(() => this.updateClock(), 250);
    inject(DestroyRef).onDestroy(() => clearInterval(this.clock));
  }

  connect(send: (command: RoomCommand) => void): void {
    this.send = send;
  }

  open(panel: RoomPanel): void {
    if (this.panel$() === panel) return;
    this.close();
    this.state.panel.set(panel);
    if (panel === 'dice') {
      this.state.diceError.set('');
      this.send?.({ type: 'dice-open' });
    } else if (panel === 'rank') {
      this.state.rank.set(null);
      this.send?.({ type: 'wallet-rank' });
    } else {
      this.state.caroError.set('');
    }
    this.updateClock();
  }

  close(): void {
    if (this.panel$() === 'dice') {
      this.send?.({ type: 'dice-close' });
      this.state.pending.set(false);
    }
    this.state.panel.set(null);
  }
  watchBoard(table: string): void {
    this.boardRequested = true;
    this.state.boardError.set('');
    this.send?.({ type: 'board-watch', table });
  }
  readyBoard(points: number): void {
    const board = this.board$();
    if (board?.seated) {
      this.state.boardError.set('');
      this.send?.({ type: 'board-ready', table: board.table, points });
    }
  }
  moveBoard(move: RoomBoardMove): void {
    const board = this.board$();
    if (board?.match && board.seated) {
      this.state.boardError.set('');
      this.send?.({
        type: 'board-move',
        table: board.table,
        matchId: board.match.id,
        version: board.match.version,
        ...move,
      });
    }
  }
  setBoardSelected(cell: number | null): void {
    this.state.boardSelected.set(cell);
  }
  private setBoardPromotion(moves: RoomBoardMove[]): void {
    this.state.boardPromotion.set(moves);
  }
  private setBoardClaimPlanned(value: boolean): void {
    this.state.boardClaimPlanned.set(value);
  }
  private setBoardFlipped(value: boolean): void {
    this.state.boardFlipped.set(value);
  }
  private setBoardPreparing(value: boolean): void {
    this.state.boardPreparing.set(value);
  }
  flipBoard(): void {
    this.setBoardFlipped(!this.boardFlipped$());
  }
  toggleBoardClaimPlanned(): void {
    this.setBoardClaimPlanned(!this.boardClaimPlanned$());
  }
  prepareBoard(): void {
    this.setBoardPreparing(true);
  }
  chooseBoardCell(cell: number): void {
    if (!this.boardCanPlay$()) return;
    const legal = this.board$()?.match?.legal ?? [];
    const moves = legal.filter(
      (move) => move.from === this.boardSelected$() && move.to === cell,
    );
    if (moves.length > 1) this.setBoardPromotion(moves);
    else if (moves[0]) this.chooseBoardMove(moves[0]);
    else if (legal.some((move) => move.from === cell))
      this.setBoardSelected(cell);
  }
  chooseBoardMove(move: RoomBoardMove): void {
    this.setBoardPromotion([]);
    if (this.boardClaimPlanned$()) {
      this.boardAction('claim-draw', move);
      this.setBoardClaimPlanned(false);
    } else this.moveBoard(move);
  }
  boardAction(
    action: 'resign' | 'offer-draw' | 'accept-draw' | 'claim-draw',
    planned?: RoomBoardMove,
  ): void {
    const board = this.board$();
    if (board?.match && board.seated) {
      this.state.boardError.set('');
      this.send?.({
        type: 'board-action',
        table: board.table,
        matchId: board.match.id,
        version: board.match.version,
        action,
        ...planned,
      });
    }
  }
  joinFloor(): void {
    this.send?.({ type: 'floor-join' });
  }

  bet(bet: RoomDiceBet): void {
    const dice = this.dice$();
    if (
      !dice ||
      this.panel$() !== 'dice' ||
      this.pending$() ||
      dice.bet ||
      !this.diceSeconds$()
    )
      return;
    this.state.pending.set(true);
    this.state.diceError.set('');
    this.send?.({ type: 'dice-bet', round: dice.round, ...bet });
  }

  setCaroStake(stake: number): void {
    this.state.caroError.set('');
    this.send?.({ type: 'caro-stake', stake });
  }

  reply(accept: boolean): void {
    const invitation = this.invitation$();
    if (invitation)
      this.send?.({ type: 'caro-reply', inviteId: invitation.id, accept });
  }

  newCaro(): void {
    if (this.caro$()?.result) this.state.caro.set(null);
  }

  play(cell: number): void {
    const game = this.caro$();
    if (
      this.caroTable$()?.playing &&
      game &&
      !game.result &&
      !game.waitingForReturn &&
      game.board[cell] === '.'
    ) {
      this.send?.({
        type: 'caro-move',
        gameId: game.id,
        move: game.moves,
        cell,
      });
    }
  }

  receive(event: RoomEvent): void {
    switch (event.type) {
      case 'board-state': {
        const previous = this.board$();
        if (
          event.match?.id !== previous?.match?.id ||
          event.match?.version !== previous?.match?.version ||
          event.table !== previous?.table
        ) {
          this.setBoardSelected(null);
          this.setBoardPromotion([]);
          this.setBoardClaimPlanned(false);
        }
        if (
          event.match?.id !== previous?.match?.id ||
          event.table !== previous?.table
        )
          this.setBoardPreparing(false);
        this.state.board.set(event);
        if (event.match) this.syncClock(event.match.serverTime);
        if (this.boardRequested || (event.seated && !previous?.seated)) {
          this.boardRequested = false;
          this.open('board');
        }
        break;
      }
      case 'board-tables':
        this.state.boardTables.set(event.tables);
        break;
      case 'board-error':
        this.state.boardError.set(event.message);
        break;
      case 'floor-state':
        this.syncClock(event.serverTime);
        this.state.floor.set(event);
        break;
      case 'wallet':
        this.state.balance.set(event.balance);
        break;
      case 'wallet-rank':
        this.state.rank.set(event.ranks);
        break;
      case 'dice-state':
        this.syncClock(event.serverTime);
        this.state.dice.set(event);
        this.state.pending.set(false);
        break;
      case 'dice-error':
        this.state.diceError.set(event.message);
        this.state.pending.set(false);
        break;
      case 'caro-invite':
        this.newCaro();
        this.state.invitation.set(event);
        this.open('caro');
        break;
      case 'caro-invite-end':
        if (this.invitation$()?.id === event.id)
          this.state.invitation.set(null);
        break;
      case 'caro-state': {
        this.syncClock(event.serverTime);
        const fresh = event.id !== this.caro$()?.id;
        this.state.caro.set(event);
        this.state.invitation.set(null);
        if (fresh && !event.result && this.caroTable$()) this.open('caro');
        break;
      }
      case 'caro-table': {
        const previous = this.caroTable$();
        this.state.caroTable.set(event.table ? event : null);
        if (!event.table) {
          this.state.invitation.set(null);
          if (this.panel$() === 'caro') this.close();
        } else if (event.table !== previous?.table) {
          this.newCaro();
          this.open('caro');
        }
        break;
      }
      case 'caro-error':
        this.state.caroError.set(event.message);
        break;
    }
  }

  reset(): void {
    this.close();
    this.state.balance.set(null);
    this.state.dice.set(null);
    this.state.rank.set(null);
    this.state.invitation.set(null);
    this.state.caro.set(null);
    this.state.caroTable.set(null);
    this.state.caroError.set('');
    this.state.board.set(null);
    this.state.boardTables.set([]);
    this.state.floor.set(null);
    this.state.boardError.set('');
    this.boardRequested = false;
    this.setBoardSelected(null);
    this.setBoardPromotion([]);
    this.setBoardClaimPlanned(false);
    this.setBoardFlipped(false);
    this.setBoardPreparing(false);
  }

  private seconds(deadline: number | undefined): number {
    return deadline
      ? Math.max(0, Math.ceil((deadline - this.state.now()) / 1000))
      : 0;
  }

  private syncClock(serverTime: number): void {
    this.clockOffset = serverTime - Date.now();
    this.updateClock();
  }

  private updateClock(): void {
    this.state.now.set(Date.now() + this.clockOffset);
  }
}
