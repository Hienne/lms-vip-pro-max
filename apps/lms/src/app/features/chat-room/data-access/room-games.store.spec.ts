import { TestBed } from '@angular/core/testing';
import type { RoomBoardState } from '@lms/contracts';
import { RoomGamesStore } from './room-games.store';

describe('RoomGamesStore playground', () => {
  let store: RoomGamesStore;
  const send = vi.fn();
  const table: RoomBoardState = {
    type: 'board-state',
    table: 'chess-1',
    kind: 'chess',
    name: 'Cờ vua 1',
    points: 10,
    seated: false,
    ready: false,
    players: ['', ''],
    readyNames: [],
    baseMillis: 300000,
    incrementMillis: 3000,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10000);
    send.mockClear();
    TestBed.configureTestingModule({ providers: [RoomGamesStore] });
    store = TestBed.inject(RoomGamesStore);
    store.connect(send);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('opens a requested table and a newly seated table without reopening closed spectator panels', () => {
    store.watchBoard(table.table);
    expect(send).toHaveBeenLastCalledWith({
      type: 'board-watch',
      table: table.table,
    });
    store.receive(table);
    expect(store.panel$()).toBe('board');
    store.close();
    store.receive(table);
    expect(store.panel$()).toBeNull();
    store.receive({ ...table, seated: true });
    expect(store.panel$()).toBe('board');
    store.readyBoard(10);
    expect(send).toHaveBeenLastCalledWith({
      type: 'board-ready',
      table: table.table,
      points: 10,
    });
    store.reset();
    expect(store.board$()).toBeNull();
    expect(store.boardTables$()).toEqual([]);
  });

  it('counts the floor deadline using server time despite local clock skew and clears it on reset', () => {
    store.receive({
      type: 'floor-state',
      id: 'bfb32f1e-6002-4f1f-95eb-a5bbb8bc15e9',
      phase: 'running',
      round: 1,
      target: 'mint',
      serverTime: 50000,
      deadline: 55000,
      players: ['An', 'Bình'],
      queued: 0,
      joined: false,
      alive: true,
      eliminated: false,
      winners: [],
    });
    expect(store.floorSeconds$()).toBe(5);
    vi.advanceTimersByTime(2000);
    expect(store.floorSeconds$()).toBe(3);
    vi.advanceTimersByTime(4000);
    expect(store.floorSeconds$()).toBe(0);
    store.reset();
    expect(store.floor$()).toBeNull();
  });

  it('keeps selection and promotions in the store and sends only server-listed moves with the current version', () => {
    const match: NonNullable<RoomBoardState['match']> = {
      id: 'bfb32f1e-6002-4f1f-95eb-a5bbb8bc15e9',
      board: '.'.repeat(64),
      side: 0,
      turn: 0,
      version: 0,
      players: ['An', 'Bình'],
      clocks: [300000, 300000],
      serverTime: 10000,
      check: false,
      history: [],
      legal: [{ from: 52, to: 36, promotion: '' }],
      result: 'playing',
      reason: '',
      drawOffer: -1,
      mustChange: -1,
      lastCells: [],
    };
    store.receive({ ...table, seated: true, match });
    store.chooseBoardCell(52);
    expect(store.boardSelected$()).toBe(52);
    store.chooseBoardCell(35);
    expect(send).not.toHaveBeenCalled();
    store.chooseBoardCell(36);
    expect(send).toHaveBeenLastCalledWith({
      type: 'board-move',
      table: table.table,
      matchId: match.id,
      version: 0,
      from: 52,
      to: 36,
      promotion: '',
    });
    const legal = (['q', 'r', 'b', 'n'] as const).map((promotion) => ({
      from: 8,
      to: 0,
      promotion,
    }));
    store.receive({
      ...table,
      seated: true,
      match: { ...match, version: 1, legal },
    });
    expect(store.boardSelected$()).toBeNull();
    store.chooseBoardCell(8);
    store.chooseBoardCell(0);
    expect(store.boardPromotion$()).toHaveLength(4);
    store.toggleBoardClaimPlanned();
    store.chooseBoardMove(legal[3]);
    expect(send).toHaveBeenLastCalledWith({
      type: 'board-action',
      table: table.table,
      matchId: match.id,
      version: 1,
      action: 'claim-draw',
      from: 8,
      to: 0,
      promotion: 'n',
    });
    expect(store.boardPromotion$()).toEqual([]);
    expect(store.boardClaimPlanned$()).toBe(false);
    store.reset();
    expect(store.boardSelected$()).toBeNull();
  });
});
