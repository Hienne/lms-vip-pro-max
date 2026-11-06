import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import {
  chatRoomEndpoints,
  chatRoomSocket,
  type RoomChat,
  type RoomCommand,
  type RoomEvent,
  type RoomIdentity,
  type RoomPlayer,
} from '@lms/contracts';
import { retry, throwError, timer } from 'rxjs';
import { serverData } from '../../../core/data-access/server-data';
import { serverMutation } from '../../../core/data-access/server-mutation';
import {
  EndpointClient,
  type SocketConnection,
} from '../../../core/http/endpoint-client';
import { SessionStore } from '../../../core/session/session.store';
import { toAppError } from '../../../core/errors/app-error';
import type { RoomCanvasState } from './chat-room.model';

type ConnectionStatus = 'offline' | 'connecting' | 'online' | 'reconnecting';

@Injectable()
export class ChatRoomStore {
  private readonly client = inject(EndpointClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(SessionStore);

  // Socket events are continuous server values; serverData owns the finite HTTP map request.
  private readonly state = {
    entered: signal(false),
    ready: signal(false),
    status: signal<ConnectionStatus>('offline'),
    players: signal<readonly RoomPlayer[]>([]),
    chats: signal<readonly RoomChat[]>([]),
    me: signal(''),
    lastChat: signal<RoomChat | null>(null),
    correction: signal<RoomCanvasState['correction']>(null),
    error: signal(''),
    copied: signal(false),
    sending: signal(false),
    tab: signal('chat'),
    renderError: signal(''),
  };
  private readonly mapData = serverData(() =>
    this.client.call(chatRoomEndpoints.map),
  );
  private readonly ticketMutation = serverMutation(
    () =>
      this.client.call(chatRoomEndpoints.ticket).pipe(
        retry({
          count: 3,
          delay: (error: unknown) =>
            ['unauthorized', 'forbidden'].includes(toAppError(error).kind)
              ? throwError(() => error)
              : timer(1500),
        }),
      ),
    {
      errors: 'alert',
      onSuccess: ({ ticket }) => {
        if (this.active) this.openSocket(ticket);
      },
    },
  );

  readonly entered$ = this.state.entered.asReadonly();
  readonly ready$ = this.state.ready.asReadonly();
  readonly status$ = this.state.status.asReadonly();
  readonly players$ = this.state.players.asReadonly();
  readonly chats$ = this.state.chats.asReadonly();
  readonly me$ = this.state.me.asReadonly();
  readonly error$ = this.state.error.asReadonly();
  readonly copied$ = this.state.copied.asReadonly();
  readonly sending$ = this.state.sending.asReadonly();
  readonly tab$ = this.state.tab.asReadonly();
  readonly renderError$ = this.state.renderError.asReadonly();
  readonly map$ = this.mapData.value;
  readonly isLoading$ = this.mapData.isLoading;
  readonly loadError$ = this.mapData.error;
  readonly ticketError$ = this.ticketMutation.error;
  readonly isConnecting$ = this.ticketMutation.isPending;
  readonly defaultName$ = computed(
    () => this.session.user$()?.fullName.slice(0, 24) ?? '',
  );
  readonly online$ = computed(() => this.status$() === 'online');
  readonly statusLabel$ = computed(
    () =>
      ({
        offline: 'Chưa vào phòng',
        connecting: 'Đang kết nối…',
        online: 'Đã kết nối',
        reconnecting: 'Đang kết nối lại…',
      })[this.status$()],
  );
  readonly tabs$ = computed(() => [
    { id: 'chat', label: 'Trò chuyện' },
    { id: 'members', label: 'Thành viên', count: this.players$().length },
  ]);
  readonly canvas$ = computed<RoomCanvasState>(() => ({
    online: this.online$(),
    me: this.me$(),
    players: this.players$(),
    lastChat: this.state.lastChat(),
    correction: this.state.correction(),
  }));

  private identity: RoomIdentity | null = null;
  private socket?: SocketConnection<RoomCommand>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private timeout?: ReturnType<typeof setTimeout>;
  private cooldown?: ReturnType<typeof setTimeout>;
  private copyTimer?: ReturnType<typeof setTimeout>;
  private active = false;
  private generation = 0;
  private attempts = 0;
  private pongAt = 0;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.leave();
      clearTimeout(this.copyTimer);
    });
  }

  setEntered(value: boolean): void {
    this.state.entered.set(value);
  }
  setReady(value: boolean): void {
    this.state.ready.set(value);
  }
  setStatus(value: ConnectionStatus): void {
    this.state.status.set(value);
  }
  setPlayers(value: readonly RoomPlayer[]): void {
    this.state.players.set(value);
  }
  setChats(value: readonly RoomChat[]): void {
    this.state.chats.set(value);
  }
  setMe(value: string): void {
    this.state.me.set(value);
  }
  setLastChat(value: RoomChat | null): void {
    this.state.lastChat.set(value);
  }
  setCorrection(value: RoomCanvasState['correction']): void {
    this.state.correction.set(value);
  }
  setError(value: string): void {
    this.state.error.set(value);
  }
  setCopied(value: boolean): void {
    this.state.copied.set(value);
  }
  setSending(value: boolean): void {
    this.state.sending.set(value);
  }
  setTab(value: string): void {
    this.state.tab.set(value);
  }
  setRenderError(value: string): void {
    this.state.renderError.set(value);
  }

  join(identity: RoomIdentity): void {
    this.leave();
    this.identity = identity;
    this.active = true;
    this.setEntered(true);
    this.setStatus('connecting');
    this.ticketMutation.run(undefined);
  }
  retryConnection(): void {
    if (!this.identity) return;
    this.stopSocket();
    this.active = true;
    this.attempts = 0;
    this.setError('');
    this.setStatus('connecting');
    this.ticketMutation.reset();
    this.ticketMutation.run(undefined);
  }
  retryMap(): void {
    this.mapData.reload();
  }
  rendererReady(): void {
    this.setRenderError('');
    this.setReady(true);
  }
  rendererFailed(message: string): void {
    this.setRenderError(message);
    this.setReady(false);
  }
  move(position: { x: number; y: number }): void {
    if (this.online$()) this.socket?.send({ type: 'move', ...position });
  }
  send(text: string): void {
    if (!this.online$() || this.sending$() || !text.trim()) return;
    this.setError('');
    this.socket?.send({ type: 'chat', text: text.trim() });
    this.setSending(true);
    this.cooldown = setTimeout(() => this.setSending(false), 800);
  }
  leave(): void {
    this.active = false;
    this.stopSocket();
    this.ticketMutation.reset();
    this.identity = null;
    clearTimeout(this.cooldown);
    this.setSending(false);
    this.setEntered(false);
    this.setStatus('offline');
    this.setPlayers([]);
    this.setChats([]);
    this.setMe('');
    this.setLastChat(null);
    this.setCorrection(null);
    this.setError('');
  }
  async share(): Promise<void> {
    try {
      await navigator.clipboard.writeText(`${location.origin}/chat-room`);
      this.setCopied(true);
      clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => this.setCopied(false), 2500);
    } catch {
      this.setError(
        'Không sao chép được. Hãy sao chép địa chỉ trên trình duyệt.',
      );
    }
  }
  private openSocket(ticket: string): void {
    this.stopSocket();
    const generation = this.generation;
    this.socket = this.client.connect(chatRoomSocket, ticket, {
      opened: () => {
        if (this.identity)
          this.socket?.send({ type: 'join', ...this.identity });
      },
      message: (event) => {
        if (generation === this.generation) this.receive(event);
      },
      closed: (code) => {
        if (generation === this.generation) this.disconnected(code);
      },
    });
    this.timeout = setTimeout(() => this.disconnected(1006), 8000);
  }
  private receive(event: RoomEvent): void {
    switch (event.type) {
      case 'welcome':
        clearTimeout(this.timeout);
        this.setStatus('online');
        this.setError('');
        this.attempts = 0;
        this.setMe(event.id);
        this.setPlayers(event.players);
        this.setChats(event.history);
        this.setLastChat(null);
        this.setCorrection(null);
        this.pongAt = Date.now();
        this.heartbeat = setInterval(() => {
          if (Date.now() - this.pongAt > 35000) this.disconnected(1006);
          else this.socket?.send({ type: 'ping' });
        }, 10000);
        break;
      case 'joined':
        if (!this.players$().some((p) => p.id === event.player.id))
          this.setPlayers([...this.players$(), event.player]);
        break;
      case 'left':
        this.setPlayers(this.players$().filter((p) => p.id !== event.id));
        break;
      case 'moved':
        this.setPlayers(
          this.players$().map((p) =>
            p.id === event.id ? { ...p, x: event.x, y: event.y } : p,
          ),
        );
        break;
      case 'correction':
        this.setCorrection({ x: event.x, y: event.y });
        break;
      case 'chat':
        this.setChats([...this.chats$(), event].slice(-100));
        this.setLastChat(event);
        break;
      case 'error':
        this.setError(event.message);
        break;
      case 'pong':
        this.pongAt = Date.now();
        break;
    }
  }
  private disconnected(code: number): void {
    this.stopSocket();
    this.setPlayers([]);
    this.setMe('');
    if (!this.active) return;
    if ([1002, 1008, 1013].includes(code) || this.attempts >= 6) {
      this.active = false;
      this.setStatus('offline');
      this.setError(
        code === 1013
          ? 'Phòng đã đầy. Hãy thử lại sau.'
          : 'Kết nối đã dừng. Hãy thử kết nối lại hoặc đăng nhập lại.',
      );
      return;
    }
    this.setStatus('reconnecting');
    this.setError('Kết nối gián đoạn. Đang thử lại…');
    this.retryTimer = setTimeout(
      () => this.ticketMutation.run(undefined),
      Math.min(10000, 1000 * 2 ** this.attempts++),
    );
  }
  private stopSocket(): void {
    this.generation++;
    clearTimeout(this.timeout);
    clearTimeout(this.retryTimer);
    clearInterval(this.heartbeat);
    this.socket?.close();
    this.socket = undefined;
  }
}
