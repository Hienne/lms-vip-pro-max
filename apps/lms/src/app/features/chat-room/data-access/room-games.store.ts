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
  RoomCommand,
  RoomDiceBet,
  RoomDiceState,
  RoomEvent,
  RoomRank,
} from '@lms/contracts';

type RoomPanel = 'dice' | 'caro' | 'rank';

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
    caroError: signal(''),
    now: signal(Date.now()),
  };
  private send?: (command: RoomCommand) => void;
  private clock?: ReturnType<typeof setInterval>;
  private clockOffset = 0;

  readonly panel$ = this.state.panel.asReadonly();
  readonly balance$ = this.state.balance.asReadonly();
  readonly dice$ = this.state.dice.asReadonly();
  readonly pending$ = this.state.pending.asReadonly();
  readonly diceError$ = this.state.diceError.asReadonly();
  readonly rank$ = this.state.rank.asReadonly();
  readonly invitation$ = this.state.invitation.asReadonly();
  readonly caro$ = this.state.caro.asReadonly();
  readonly caroError$ = this.state.caroError.asReadonly();
  readonly latestDice$ = computed(() => this.dice$()?.history[0]);
  readonly diceSeconds$ = computed(() => this.seconds(this.dice$()?.closesAt));
  readonly caroSeconds$ = computed(() => this.seconds(this.caro$()?.expiresAt));

  constructor() {
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
    this.clock = setInterval(() => this.updateClock(), 250);
  }

  close(): void {
    if (this.panel$() === 'dice') {
      this.send?.({ type: 'dice-close' });
      this.state.pending.set(false);
    }
    clearInterval(this.clock);
    this.state.panel.set(null);
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

  challenge(challenge: { target: string; stake: number }): void {
    this.state.caroError.set('');
    this.send?.({ type: 'caro-invite', ...challenge });
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
    if (game && !game.result && game.board[cell] === '.') {
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
        if (fresh && !event.result) this.open('caro');
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
    this.state.caroError.set('');
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
