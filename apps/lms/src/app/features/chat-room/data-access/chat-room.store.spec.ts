import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { RoomEvent } from '@lms/contracts';
import { envelopeOk } from '@lms/mocks';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import {
  EndpointClient,
  type SocketObserver,
} from '../../../core/http/endpoint-client';
import { provideEnvelopeHttpClient } from '../../../core/http/http.testing';
import { SessionStore } from '../../../core/session/session.store';
import { FakeSessionStore } from '../../../core/session/session.testing';
import { ChatRoomStore } from './chat-room.store';
import { RoomGamesStore } from './room-games.store';
import { RoomMediaStore } from './room-media.store';
import { RoomVoiceStore } from './room-voice.store';

describe('ChatRoomStore', () => {
  let store: ChatRoomStore;
  let http: HttpTestingController;
  let observer: SocketObserver<RoomEvent>;
  const send = vi.fn();
  const close = vi.fn();
  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        { provide: SessionStore, useClass: FakeSessionStore },
        ChatRoomStore,
        RoomGamesStore,
        RoomMediaStore,
        RoomVoiceStore,
      ],
    });
    vi.spyOn(TestBed.inject(EndpointClient), 'connect').mockImplementation(
      (_endpoint, _ticket, next) => {
        observer = next as SocketObserver<RoomEvent>;
        return { send, close };
      },
    );
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ChatRoomStore);
    await settle();
    http.expectOne('/api/v1/chat-room/map').flush(
      envelopeOk({
        width: 1120,
        height: 760,
        speed: 190,
        radius: 12,
        spawn: { x: 560, y: 656 },
        diceArea: { x: 900, y: 600, w: 160, h: 120 },
        caroTables: [{ desk: 0, chairs: [1, 2] }],
        objects: [
          { kind: 'desk', x: 550, y: 300, w: 170, h: 68, facing: null },
          { kind: 'chair', x: 570, y: 390, w: 44, h: 40 },
          { kind: 'chair', x: 650, y: 390, w: 44, h: 40 },
        ],
      }),
    );
    await settle();
  });
  afterEach(() => {
    store.leave();
    http.verify();
    vi.useRealTimers();
  });

  async function openSocket(): Promise<void> {
    store.join({ name: 'An', color: 'teal' });
    await settle();
    http.expectOne('/api/v1/chat-room/tickets').flush(
      envelopeOk({
        ticket: 'single-use-ticket',
        expiresAt: '2026-11-06T20:00:00Z',
      }),
    );
    await settle();
    observer.opened();
  }
  async function connect(): Promise<void> {
    await openSocket();
    observer.message({
      type: 'welcome',
      id: 'a',
      players: [{ id: 'a', name: 'An', color: 'teal', x: 446, y: 656 }],
      history: [],
    });
  }
  it('requires a ticket before joining, then exposes players and received chat', async () => {
    await connect();
    expect(send).toHaveBeenCalledWith({
      type: 'join',
      name: 'An',
      color: 'teal',
      roomGames: true,
      gestures: true,
      interactions: true,
      reactions: true,
      boardGames: true,
      presentation: true,
      voice: true,
    });
    expect(store.online$()).toBe(true);
    observer.message({
      type: 'joined',
      player: { id: 'b', name: 'Bình', color: 'blue', x: 484, y: 656 },
    });
    observer.message({
      type: 'chat',
      id: 'm',
      playerId: 'b',
      name: 'Bình',
      color: 'blue',
      text: '<b>Xin chào</b>',
      at: '2026-11-06T13:00:00Z',
    });
    expect(store.players$()).toHaveLength(2);
    expect(store.speech$()['b'].text).toBe('<b>Xin chào</b>');
    expect(store.canvas$().speech['b'].id).toBe('m');
    observer.message({ type: 'left', id: 'b', name: 'Bình' });
    expect(store.players$()).toHaveLength(1);
  });
  it('approaches the dice table from the challenge menu and opens it only after server-confirmed arrival', async () => {
    await connect();
    observer.message({ type: 'wallet', balance: 50 });
    send.mockClear();
    store.chooseChallenge('dice');
    expect(send).toHaveBeenCalledWith({ type: 'dice-approach' });
    expect(send).not.toHaveBeenCalledWith({ type: 'dice-open' });
    observer.message({
      type: 'moved',
      id: 'a',
      x: 920,
      y: 640,
      approaching: false,
    });
    expect(send).toHaveBeenCalledWith({ type: 'dice-open' });
    expect(TestBed.inject(RoomGamesStore).panel$()).toBe('dice');
  });
  it('chooses an available chair for the selected Caro table', async () => {
    await openSocket();
    observer.message({
      type: 'welcome',
      id: 'a',
      players: [{ id: 'a', name: 'An', color: 'teal', x: 446, y: 656 }],
      interactions: true,
    });
    send.mockClear();
    store.chooseChallenge('caro:0');
    expect(send).toHaveBeenCalledWith({
      type: 'seat',
      action: 'sit',
      chair: 1,
    });
    expect(send).not.toHaveBeenCalledWith({ type: 'caro-stake', stake: 10 });
  });
  it('allows only the seated presenter to send a validated YouTube video ID', async () => {
    await connect();
    const state = {
      type: 'media-state' as const,
      id: '8cb70319-38c1-4071-877d-61c5f2533642',
      controller: 'a',
      name: 'An',
      source: 'idle' as const,
      title: '',
      videoId: '',
      paused: true,
      position: 0,
      updatedAt: 0,
      serverTime: Date.now(),
      iceServers: [],
    };
    observer.message(state);
    send.mockClear();
    store.media.startYouTube('https://youtu.be/dQw4w9WgXcQ?si=test');
    expect(send).toHaveBeenCalledWith({
      type: 'media-start',
      id: expect.any(String),
      source: 'youtube',
      videoId: 'dQw4w9WgXcQ',
      title: 'YouTube',
    });
    send.mockClear();
    store.media.startYouTube(
      'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    );
    expect(send).not.toHaveBeenCalled();
    expect(store.media.error$()).toContain('hợp lệ');
    observer.message({ ...state, controller: 'b' });
    send.mockClear();
    store.media.startYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(send).not.toHaveBeenCalled();
  });
  it('sends movement and chat only while connected, with a send cooldown', async () => {
    store.move({ x: 1, y: 1 });
    expect(send).not.toHaveBeenCalled();
    await connect();
    store.move({ x: 450, y: 656 });
    expect(send).toHaveBeenCalledWith({ type: 'move', x: 450, y: 656 });
    store.send('  Chào bạn  ');
    store.send('Quá nhanh');
    expect(send).toHaveBeenCalledWith({ type: 'chat', text: 'Chào bạn' });
    expect(send).not.toHaveBeenCalledWith({ type: 'chat', text: 'Quá nhanh' });
    observer.message({ type: 'correction', x: 446, y: 656 });
    expect(store.canvas$().correction).toEqual({ x: 446, y: 656 });
  });
  it('clears stale players on disconnect and obtains a fresh ticket on retry', async () => {
    await connect();
    vi.useFakeTimers();
    observer.closed(1006);
    expect(store.status$()).toBe('reconnecting');
    expect(store.players$()).toEqual([]);
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    const request = http.expectOne('/api/v1/chat-room/tickets');
    expect(request.request.method).toBe('POST');
    request.flush(
      envelopeOk({ ticket: 'new-ticket', expiresAt: '2026-11-06T20:00:00Z' }),
    );
    await settle();
  });
  it('explains when the socket opens but the server closes before admitting the player', async () => {
    await openSocket();
    expect(store.status$()).toBe('joining');
    observer.closed(1011);
    expect(store.status$()).toBe('offline');
    expect(store.connectionIssue$()).toContain('trước khi xác nhận vào phòng');
    expect(store.connectionIssue$()).toContain('1011');
    expect(store.isConnecting$()).toBe(false);
  });
  it('keeps the room online when game storage is unavailable', async () => {
    await connect();
    observer.message({ type: 'wallet', balance: 50 });
    observer.message({
      type: 'error',
      scope: 'games',
      message: 'Ví chưa khả dụng.',
    });
    expect(store.online$()).toBe(true);
    expect(store.gamesIssue$()).toBe('Ví chưa khả dụng.');
    expect(store.connectionIssue$()).toBe('');
    expect(store.games.balance$()).toBeNull();
    store.send('Phòng vẫn mở');
    expect(send).toHaveBeenCalledWith({ type: 'chat', text: 'Phòng vẫn mở' });
    expect(store.gamesIssue$()).toBe('Ví chưa khả dụng.');
  });
  it('stops retries and ignores stale callbacks after leaving', async () => {
    await connect();
    vi.useFakeTimers();
    const old = observer;
    store.leave();
    old.message({
      type: 'joined',
      player: { id: 'ghost', name: 'Ghost', color: 'teal', x: 0, y: 0 },
    });
    old.closed(1006);
    await vi.advanceTimersByTimeAsync(10000);
    await settle();
    expect(store.players$()).toEqual([]);
    expect(store.entered$()).toBe(false);
    expect(store.status$()).toBe('offline');
    http.expectNone('/api/v1/chat-room/tickets');
  });
  it('expires speech bubbles and keeps a bounded chat log until leaving', async () => {
    await connect();
    vi.useFakeTimers();
    const chat = {
      type: 'chat' as const,
      id: 'live',
      playerId: 'a',
      name: 'An',
      color: 'teal' as const,
      text: 'Chào cả phòng',
      at: '2026-11-06T13:00:00Z',
    };
    observer.message(chat);
    expect(store.speech$()['a'].text).toBe(chat.text);
    await vi.advanceTimersByTimeAsync(5501);
    expect(store.speech$()).toEqual({});
    expect(store.messages$()).toEqual([chat]);
    observer.message({
      type: 'welcome',
      id: 'new',
      players: [],
      history: [chat],
    });
    expect(store.speech$()).toEqual({});
    expect(store.messages$()).toEqual([chat]);
    for (let i = 0; i < 51; i++) {
      observer.message({ ...chat, id: String(i) });
    }
    expect(store.messages$()).toHaveLength(50);
    expect(store.messages$()[0].id).toBe('1');
    store.leave();
    expect(store.messages$()).toEqual([]);
  });
  it('replaces and clears reactions without adding them to chat history', async () => {
    await connect();
    vi.useFakeTimers();
    observer.message({
      type: 'playground-ready',
      reactions: true,
      boardGames: true,
      floorGame: true,
    });
    store.react('love');
    expect(send).toHaveBeenCalledWith({ type: 'reaction', reaction: 'love' });
    observer.message({ type: 'reaction', playerId: 'a', reaction: 'love' });
    observer.message({ type: 'reaction', playerId: 'a', reaction: 'clap' });
    expect(store.canvas$().reactions?.['a'].reaction).toBe('clap');
    expect(store.messages$()).toEqual([]);
    await vi.advanceTimersByTimeAsync(2801);
    expect(store.canvas$().reactions).toEqual({});
    observer.message({ type: 'reaction', playerId: 'b', reaction: 'hello' });
    observer.message({ type: 'left', id: 'b', name: 'Bình' });
    expect(store.canvas$().reactions).toEqual({});
    observer.message({ type: 'reaction', playerId: 'a', reaction: 'hello' });
    store.leave();
    expect(store.canvas$().reactions).toEqual({});
  });
  it('opens chat explicitly, closes it after send, and resumes movement', async () => {
    store.openChat();
    expect(store.chatOpen$()).toBe(false);
    await connect();
    store.openChat();
    expect(store.canvas$().chatting).toBe(true);
    store.send('Xin chào');
    expect(store.chatOpen$()).toBe(false);
    expect(store.online$()).toBe(true);
    store.move({ x: 446, y: 656, facing: 'east' });
    expect(send).toHaveBeenCalledWith({
      type: 'move',
      x: 446,
      y: 656,
      facing: 'east',
    });
    observer.message({
      type: 'moved',
      id: 'a',
      x: 446,
      y: 656,
      facing: 'west',
    });
    expect(store.players$()[0].facing).toBe('west');
  });
});
