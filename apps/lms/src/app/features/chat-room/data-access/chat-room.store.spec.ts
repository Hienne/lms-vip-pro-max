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
        objects: [],
      }),
    );
    await settle();
  });
  afterEach(() => {
    store.leave();
    http.verify();
    vi.useRealTimers();
  });

  async function connect(): Promise<void> {
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
      dice: true,
      gestures: true,
      interactions: true,
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
  it('expires speech instead of keeping a chat log and ignores welcome history', async () => {
    await connect();
    vi.useFakeTimers();
    const chat = {
      type: 'chat' as const,
      id: 'live',
      playerId: 'a',
      name: 'An',
      color: 'teal' as const,
      text: 'Chỉ người đang ở đây đọc được',
      at: '2026-11-06T13:00:00Z',
    };
    observer.message(chat);
    expect(store.speech$()['a'].text).toBe(chat.text);
    await vi.advanceTimersByTimeAsync(5501);
    expect(store.speech$()).toEqual({});
    observer.message({
      type: 'welcome',
      id: 'new',
      players: [],
      history: [chat],
    });
    expect(store.speech$()).toEqual({});
    expect(store.announcement$()).toBe('');
  });
  it('opens chat explicitly, closes it after send, and changes view without reconnecting', async () => {
    store.openChat();
    expect(store.chatOpen$()).toBe(false);
    await connect();
    expect(store.viewMode$()).toBe('3d');
    store.openChat();
    expect(store.canvas$().chatting).toBe(true);
    store.send('Xin chào');
    expect(store.chatOpen$()).toBe(false);
    store.changeViewMode('2d');
    expect(store.viewMode$()).toBe('2d');
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
