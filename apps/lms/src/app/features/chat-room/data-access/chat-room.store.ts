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
  type RoomGesture,
  type RoomGestureKind,
  type RoomHighFive,
  type RoomHighFiveInvite,
  type RoomInteractionCommand,
  type RoomIdentity,
  type RoomMovement,
  type RoomPlayer,
} from '@lms/contracts';
import { retry, tap, throwError, timer } from 'rxjs';
import { serverData } from '../../../core/data-access/server-data';
import { serverMutation } from '../../../core/data-access/server-mutation';
import {
  EndpointClient,
  SOCKET_INVALID_RESPONSE,
  type SocketConnection,
} from '../../../core/http/endpoint-client';
import { SessionStore } from '../../../core/session/session.store';
import { toAppError } from '../../../core/errors/app-error';
import type {
  RoomCanvasState,
  RoomInvitationView,
  RoomSpeech,
  TimedRoomGesture,
} from './chat-room.model';
import { inRoomArea } from './chat-room.model';
import { RoomGamesStore } from './room-games.store';
import { copyText } from '../../../core/browser/secure-context';

type ConnectionStatus =
  | 'offline'
  | 'connecting'
  | 'joining'
  | 'online'
  | 'reconnecting';
type SocketFailure = number | 'join-timeout' | 'heartbeat-timeout';
const SPEECH_DURATION_MS = 5500;

@Injectable()
export class ChatRoomStore {
  private readonly client = inject(EndpointClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(SessionStore);
  readonly games = inject(RoomGamesStore);

  // Socket events are continuous server values; serverData owns the finite HTTP map request.
  private readonly state = {
    entered: signal(false),
    ready: signal(false),
    status: signal<ConnectionStatus>('offline'),
    players: signal<readonly RoomPlayer[]>([]),
    me: signal(''),
    speech: signal<Readonly<Record<string, RoomSpeech>>>({}),
    gestures: signal<Readonly<Record<string, TimedRoomGesture>>>({}),
    gesturesEnabled: signal(false),
    interactionsEnabled: signal(false),
    invitation: signal<RoomHighFiveInvite | null>(null),
    gestureNotice: signal(''),
    chatOpen: signal(false),
    correction: signal<RoomCanvasState['correction']>(null),
    error: signal(''),
    connectionIssue: signal(''),
    gamesIssue: signal(''),
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
        tap({
          error: () => {
            if (this.active) this.stopConnecting();
          },
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
  readonly gesturesEnabled$ = this.state.gesturesEnabled.asReadonly();
  readonly interactionsEnabled$ = this.state.interactionsEnabled.asReadonly();
  readonly invitation$ = computed<RoomInvitationView | null>(() => {
    const invite = this.state.invitation();
    if (!invite) return null;
    const incoming = invite.to === this.me$();
    const other = this.players$().find(
      (player) => player.id === (incoming ? invite.from : invite.to),
    );
    return other ? { id: invite.id, name: other.name, incoming } : null;
  });
  readonly gestureNotice$ = this.state.gestureNotice.asReadonly();
  readonly chatOpen$ = this.state.chatOpen.asReadonly();
  readonly me$ = this.state.me.asReadonly();
  readonly error$ = this.state.error.asReadonly();
  readonly connectionIssue$ = this.state.connectionIssue.asReadonly();
  readonly gamesIssue$ = this.state.gamesIssue.asReadonly();
  readonly copied$ = this.state.copied.asReadonly();
  readonly sending$ = this.state.sending.asReadonly();
  readonly renderError$ = this.state.renderError.asReadonly();
  readonly map$ = this.mapData.value;
  readonly isLoading$ = this.mapData.isLoading;
  readonly loadError$ = this.mapData.error;
  readonly ticketError$ = this.ticketMutation.error;
  readonly isConnecting$ = computed(
    () =>
      this.status$() === 'connecting' ||
      this.status$() === 'joining' ||
      this.ticketMutation.isPending(),
  );
  readonly defaultName$ = computed(
    () => this.session.user$()?.fullName.slice(0, 24) ?? '',
  );
  readonly online$ = computed(() => this.status$() === 'online');
  readonly self$ = computed(() =>
    this.players$().find((person) => person.id === this.me$()),
  );
  readonly nearDice$ = computed(() => {
    const player = this.self$();
    return (
      this.online$() &&
      this.games.balance$() !== null &&
      !!player &&
      !player.approaching &&
      inRoomArea(this.map$()?.diceArea, player.x, player.y)
    );
  });
  readonly statusLabel$ = computed(
    () =>
      ({
        offline: this.entered$() ? 'Chưa kết nối được' : 'Chưa vào phòng',
        connecting: 'Đang kết nối…',
        joining: 'Đang chờ xác nhận vào phòng…',
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
    chatting: this.chatOpen$() || this.games.panel$() !== null,
    dice: this.games.latestDice$(),
    speech: this.speech$(),
    gestures: this.state.gestures(),
    correction: this.state.correction(),
  }));

  private identity: RoomIdentity | null = null;
  private socket?: SocketConnection<RoomCommand>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private timeout?: ReturnType<typeof setTimeout>;
  private cooldown?: ReturnType<typeof setTimeout>;
  private copyTimer?: ReturnType<typeof setTimeout>;
  private gestureNoticeTimer?: ReturnType<typeof setTimeout>;
  private invitationTimer?: ReturnType<typeof setTimeout>;
  private active = false;
  private generation = 0;
  private attempts = 0;
  private pongAt = 0;
  private readonly speechTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor() {
    this.games.connect((command) => this.socket?.send(command));
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
    this.state.connectionIssue.set('');
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
  openChat(): void {
    if (this.online$()) {
      this.games.close();
      this.setChatOpen(true);
    }
  }
  closeChat(): void {
    this.setChatOpen(false);
  }
  move(position: RoomMovement): void {
    if (this.online$()) this.socket?.send({ type: 'move', ...position });
  }
  performGesture(kind: RoomGestureKind): void {
    if (this.online$() && this.gesturesEnabled$() && !this.chatOpen$()) {
      this.socket?.send({ type: 'gesture', kind });
    }
  }
  interact(command: RoomInteractionCommand): void {
    if (this.online$() && this.interactionsEnabled$()) {
      this.socket?.send(command);
    }
  }
  cancelApproach(): void {
    if (this.self$()?.approaching)
      this.socket?.send({ type: 'approach-cancel' });
  }
  openGame(panel: NonNullable<ReturnType<RoomGamesStore['panel$']>>): void {
    if (
      !this.online$() ||
      (panel === 'dice' && !this.nearDice$()) ||
      (panel === 'caro' && !this.games.caroTable$())
    )
      return;
    this.closeChat();
    this.cancelApproach();
    this.games.open(panel);
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
    this.games.reset();
    this.clearSpeech();
    this.clearGestures();
    this.setMe('');
    this.closeChat();
    this.setCorrection(null);
    this.setError('');
    this.state.connectionIssue.set('');
    this.state.gamesIssue.set('');
  }
  async share(): Promise<void> {
    if (await copyText(`${location.origin}/chat-room`)) {
      this.setCopied(true);
      clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => this.setCopied(false), 2500);
    } else {
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
        if (generation !== this.generation) return;
        this.setStatus('joining');
        if (this.identity)
          this.socket?.send({
            type: 'join',
            ...this.identity,
            roomGames: true,
            gestures: true,
            interactions: true,
          });
      },
      message: (event) => {
        if (generation === this.generation) this.receive(event);
      },
      closed: (code) => {
        if (generation === this.generation) this.disconnected(code);
      },
    });
    this.timeout = setTimeout(() => this.disconnected('join-timeout'), 8000);
  }
  private receive(event: RoomEvent): void {
    switch (event.type) {
      case 'welcome':
        clearTimeout(this.timeout);
        this.setStatus('online');
        this.setError('');
        this.state.connectionIssue.set('');
        this.state.gamesIssue.set('');
        this.attempts = 0;
        this.setMe(event.id);
        this.setPlayers(event.players);
        this.clearSpeech();
        this.clearGestures();
        this.state.gesturesEnabled.set(event.gestures === true);
        this.state.interactionsEnabled.set(event.interactions === true);
        this.setCorrection(null);
        this.pongAt = Date.now();
        this.heartbeat = setInterval(() => {
          if (Date.now() - this.pongAt > 35000)
            this.disconnected('heartbeat-timeout');
          else this.socket?.send({ type: 'ping' });
        }, 10000);
        break;
      case 'joined':
        if (!this.players$().some((p) => p.id === event.player.id))
          this.setPlayers([...this.players$(), event.player]);
        break;
      case 'left':
        this.setPlayers(this.players$().filter((p) => p.id !== event.id));
        if (!this.invitation$()) this.clearInvitation();
        this.clearSpeech(event.id);
        this.state.gestures.update((gestures) => {
          const remaining = { ...gestures };
          delete remaining[event.id];
          return remaining;
        });
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
                  approaching: event.approaching ?? p.approaching,
                  seat:
                    event.seat === undefined
                      ? p.seat
                      : (event.seat ?? undefined),
                }
              : p,
          ),
        );
        if (
          event.id === this.me$() &&
          this.games.panel$() === 'dice' &&
          !this.nearDice$()
        )
          this.games.close();
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
      case 'gesture':
        this.receiveGesture(event);
        break;
      case 'high-five-invite':
        this.clearInvitation();
        this.state.invitation.set(event);
        this.invitationTimer = setTimeout(() => this.clearInvitation(), 10000);
        break;
      case 'high-five-end':
        if (this.state.invitation()?.id === event.id) this.clearInvitation();
        break;
      case 'high-five':
        this.receiveHighFive(event);
        break;
      case 'error':
        if (event.scope === 'games') {
          this.games.reset();
          this.state.gamesIssue.set(event.message);
        } else if (!this.online$()) {
          this.stopConnecting();
          this.state.connectionIssue.set(
            event.message || 'Máy chủ từ chối yêu cầu vào phòng.',
          );
        } else {
          this.setError(event.message);
        }
        break;
      case 'pong':
        this.pongAt = Date.now();
        break;
      default:
        if (
          (event.type === 'caro-table' &&
            event.table &&
            event.table !== this.games.caroTable$()?.table) ||
          (event.type === 'caro-invite' && event.to === this.me$())
        )
          this.closeChat();
        this.games.receive(event);
        break;
    }
  }
  private disconnected(failure: SocketFailure): void {
    const wasOnline = this.online$();
    const wasJoining = this.status$() === 'joining';
    this.stopSocket();
    this.setPlayers([]);
    this.games.reset();
    this.setMe('');
    this.clearSpeech();
    this.clearGestures();
    this.closeChat();
    this.state.gamesIssue.set('');
    if (!this.active) return;
    const detail = this.socketFailureDetail(failure, wasOnline, wasJoining);
    const terminal =
      failure === 1002 ||
      failure === SOCKET_INVALID_RESPONSE ||
      failure === 1008 ||
      failure === 1013 ||
      (failure === 1011 && !wasOnline);
    if (terminal || this.attempts >= 6) {
      this.active = false;
      this.setStatus('offline');
      this.state.connectionIssue.set(detail);
      return;
    }
    this.setStatus('reconnecting');
    this.state.connectionIssue.set(`${detail} Đang tự kết nối lại…`);
    this.retryTimer = setTimeout(
      () => this.ticketMutation.run(undefined),
      Math.min(10000, 1000 * 2 ** this.attempts++),
    );
  }
  private socketFailureDetail(
    failure: SocketFailure,
    wasOnline: boolean,
    wasJoining: boolean,
  ): string {
    switch (failure) {
      case 'join-timeout':
        return wasJoining
          ? 'WebSocket đã mở nhưng máy chủ chưa xác nhận vào phòng sau 8 giây.'
          : 'Không mở được WebSocket trong 8 giây.';
      case 'heartbeat-timeout':
        return 'Máy chủ không phản hồi kiểm tra kết nối phòng.';
      case 1002:
      case SOCKET_INVALID_RESPONSE:
        return 'Dữ liệu phòng từ máy chủ không tương thích. Hãy tải lại trang hoặc báo quản trị viên.';
      case 1008:
        return 'Máy chủ từ chối phiên kết nối phòng (1008). Hãy đăng nhập lại rồi thử.';
      case 1013:
        return 'Máy chủ đang bận hoặc phòng đã đầy (1013). Hãy thử lại sau.';
      default: {
        const step = wasOnline
          ? 'Kết nối phòng bị ngắt'
          : wasJoining
            ? 'WebSocket đã mở nhưng máy chủ đóng kết nối trước khi xác nhận vào phòng'
            : 'Không mở được WebSocket';
        return `${step} (mã ${failure}).`;
      }
    }
  }
  private stopConnecting(): void {
    this.active = false;
    this.stopSocket();
    this.setStatus('offline');
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

  private receiveGesture(event: RoomGesture): void {
    this.state.gestures.update((gestures) => ({
      ...gestures,
      [event.playerId]: { ...event, startedAt: performance.now() },
    }));
    const me = this.me$();
    let notice = '';
    if (event.playerId === me) {
      const target = this.players$().find(
        (player) => player.id === event.targetId,
      );
      notice =
        event.kind === 'jump'
          ? 'Bạn nhảy tại chỗ.'
          : target
            ? `Bạn vẫy chào ${target.name}.`
            : 'Bạn vẫy tay.';
    } else if (event.targetId === me) {
      const actor = this.players$().find(
        (player) => player.id === event.playerId,
      );
      if (actor) notice = `${actor.name} vẫy chào bạn.`;
    }
    if (notice) this.showGestureNotice(notice);
  }

  private receiveHighFive(event: RoomHighFive): void {
    const startedAt = performance.now();
    const { from, to } = event;
    this.state.gestures.update((gestures) => ({
      ...gestures,
      [from.id]: {
        kind: 'high-five',
        origin: from,
        partner: to,
        leading: true,
        startedAt,
      },
      [to.id]: {
        kind: 'high-five',
        origin: to,
        partner: from,
        leading: false,
        startedAt,
      },
    }));
    const self = [from, to].find((player) => player.id === this.me$());
    if (self) {
      this.setCorrection({ x: self.x, y: self.y });
      this.showGestureNotice('Hai bạn vừa đập tay!');
    }
  }

  private showGestureNotice(notice: string): void {
    this.state.gestureNotice.set(notice);
    clearTimeout(this.gestureNoticeTimer);
    this.gestureNoticeTimer = setTimeout(
      () => this.state.gestureNotice.set(''),
      2400,
    );
  }

  private clearGestures(): void {
    clearTimeout(this.gestureNoticeTimer);
    this.state.gestures.set({});
    this.state.gesturesEnabled.set(false);
    this.state.interactionsEnabled.set(false);
    this.state.gestureNotice.set('');
    this.clearInvitation();
  }

  private clearInvitation(): void {
    clearTimeout(this.invitationTimer);
    this.state.invitation.set(null);
  }
}
