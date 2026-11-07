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
  type RoomCommand,
  type RoomEvent,
  type RoomIdentity,
  type RoomMovement,
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
import type {
  RoomCanvasState,
  RoomSpeech,
  RoomViewMode,
} from './chat-room.model';

type ConnectionStatus = 'offline' | 'connecting' | 'online' | 'reconnecting';
const SPEECH_DURATION_MS = 5500;

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
    me: signal(''),
    speech: signal<Readonly<Record<string, RoomSpeech>>>({}),
    chatOpen: signal(false),
    viewMode: signal<RoomViewMode>('3d'),
    correction: signal<RoomCanvasState['correction']>(null),
    error: signal(''),
    copied: signal(false),
    sending: signal(false),
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
  readonly speech$ = this.state.speech.asReadonly();
  readonly chatOpen$ = this.state.chatOpen.asReadonly();
  readonly viewMode$ = this.state.viewMode.asReadonly();
  readonly me$ = this.state.me.asReadonly();
  readonly error$ = this.state.error.asReadonly();
  readonly copied$ = this.state.copied.asReadonly();
  readonly sending$ = this.state.sending.asReadonly();
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
  readonly announcement$ = computed(() => {
    const speech = Object.values(this.speech$()).sort(
      (a, b) => b.expiresAt - a.expiresAt,
    )[0];
    return speech ? `${speech.name}: ${speech.text}` : '';
  });
  readonly canvas$ = computed<RoomCanvasState>(() => ({
    online: this.online$(),
    me: this.me$(),
    players: this.players$(),
    chatting: this.chatOpen$(),
    speech: this.speech$(),
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
  private readonly speechTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

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
  setSpeech(value: Readonly<Record<string, RoomSpeech>>): void {
    this.state.speech.set(value);
  }
  setMe(value: string): void {
    this.state.me.set(value);
  }
  setChatOpen(value: boolean): void {
    this.state.chatOpen.set(value);
  }
  setViewMode(value: RoomViewMode): void {
    this.state.viewMode.set(value);
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
  changeViewMode(mode: RoomViewMode): void {
    if (mode === this.viewMode$()) return;
    this.closeChat();
    this.setReady(false);
    this.setRenderError('');
    this.setViewMode(mode);
  }
  openChat(): void {
    if (this.online$()) this.setChatOpen(true);
  }
  closeChat(): void {
    this.setChatOpen(false);
  }
  move(position: RoomMovement): void {
    if (this.online$()) this.socket?.send({ type: 'move', ...position });
  }
  send(text: string): void {
    if (!this.online$() || this.sending$() || !text.trim()) return;
    this.setError('');
    this.socket?.send({ type: 'chat', text: text.trim() });
    this.closeChat();
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
    this.clearSpeech();
    this.setMe('');
    this.closeChat();
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
        this.clearSpeech();
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
        this.clearSpeech(event.id);
        break;
      case 'moved':
        this.setPlayers(
          this.players$().map((p) =>
            p.id === event.id
              ? {
                  ...p,
                  x: event.x,
                  y: event.y,
                  facing: event.facing ?? p.facing,
                }
              : p,
          ),
        );
        break;
      case 'correction':
        this.setCorrection({ x: event.x, y: event.y });
        break;
      case 'chat':
        this.setSpeech({
          ...this.speech$(),
          [event.playerId]: {
            ...event,
            expiresAt: Date.now() + SPEECH_DURATION_MS,
          },
        });
        clearTimeout(this.speechTimers.get(event.playerId));
        this.speechTimers.set(
          event.playerId,
          setTimeout(
            () => this.clearSpeech(event.playerId),
            SPEECH_DURATION_MS,
          ),
        );
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
    this.clearSpeech();
    this.closeChat();
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
  private clearSpeech(playerId?: string): void {
    if (playerId) {
      clearTimeout(this.speechTimers.get(playerId));
      this.speechTimers.delete(playerId);
      const remaining = { ...this.speech$() };
      delete remaining[playerId];
      this.setSpeech(remaining);
    } else {
      this.speechTimers.forEach((timer) => clearTimeout(timer));
      this.speechTimers.clear();
      this.setSpeech({});
    }
  }
}
