import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  agentEndpoints,
  type AgentCommand,
  type AgentStreamEvent,
  type PendingAction,
} from '@lms/contracts';
import { finalize, type Subscription } from 'rxjs';
import { toAppError } from '../errors/app-error';
import { EndpointClient } from '../http/endpoint-client';
import { NetworkStore } from '../network/network.store';
import { SessionStore } from '../session/session.store';
import type { ActionCard, AgentReply, AgentTurn } from './agent-chat.model';
import { AgentChatStorage } from './agent-chat.storage';
import { toolStatusText } from './agent-status';

/**
 * Finished turns sent back with a question. The backend takes at most 20 messages, so nine
 * question and answer pairs leave room for the new question.
 */
export const HISTORY_TURNS = 9;

export const OFFLINE_MESSAGE =
  'Mất kết nối — không gửi được câu hỏi. Thử lại khi có mạng.';
export const CUT_OFF_MESSAGE = 'Kết nối bị ngắt khi đang trả lời.';
export const GENERIC_ERROR =
  'Trợ lý chưa xử lý được yêu cầu này. Bạn thử lại nhé.';
export const EXPIRED_MESSAGE =
  'Yêu cầu này đã hết hạn hoặc đã được xử lý. Vui lòng yêu cầu lại trợ lý.';
const CANCELLED_MESSAGE = 'Đã huỷ thay đổi.';
const NOT_FOUND_CODE = 'ASSISTANT-ACTION_NOT_FOUND';

const WAITING: AgentReply = {
  status: 'waiting',
  toolName: null,
  text: '',
  citations: [],
  navigatedTo: null,
  action: null,
  error: null,
};

/**
 * The quick assistant: the conversation (kept in this tab's `sessionStorage`), the panel's open
 * state and the card of a proposed change. Every answer, source, navigation target and action is
 * the server's; this store streams them in, refuses a navigation outside the user's own menu, and
 * only confirms a change when the user asks. It starts working when something first injects it,
 * and everything resets when the user changes or signs out.
 */
@Injectable({ providedIn: 'root' })
export class AgentChatStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly network = inject(NetworkStore);
  private readonly storage = inject(AgentChatStorage);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private streaming: Subscription | null = null;
  /** The confirm or cancel request on its way; at most one, since one card settles at a time. */
  private settling: Subscription | null = null;
  private lastUserId: string | undefined;

  private readonly userId = computed(() => this.session.user$()?.userId);

  // Both follow the user: a sign-out or another sign-in starts from what that user left.
  private readonly state = {
    turns: linkedSignal<string | undefined, readonly AgentTurn[]>({
      source: this.userId,
      computation: (id) => (id ? this.storage.read(id).turns : []),
    }),
    open: linkedSignal<string | undefined, boolean>({
      source: this.userId,
      computation: (id) => (id ? this.storage.read(id).open : false),
    }),
    answeringId: signal<number | null>(null),
    confirmingId: signal<number | null>(null),
  };

  readonly turns$ = this.state.turns.asReadonly();
  readonly isOpen$ = this.state.open.asReadonly();
  readonly isAnswering$ = computed(() => this.state.answeringId() !== null);
  readonly isConfirming$ = computed(() => this.state.confirmingId() !== null);
  /** The composer is off: a question could not be sent. */
  readonly isOffline$ = this.network.offline$;
  /** Signed in, with the assistant function, and not stuck on a temporary password. */
  readonly available$ = computed(
    () =>
      this.session.isSignedIn$() &&
      this.session.menus$().includes('AI_ASSISTANT') &&
      !this.session.mustChangePassword$(),
  );
  /** What a screen reader hears about the reply in progress; the streamed text itself is silent. */
  readonly announcement$ = computed(() => {
    const reply = this.turns$().at(-1)?.reply;
    switch (reply?.status) {
      case 'waiting':
      case 'working':
        return toolStatusText(reply.toolName);
      case 'composing':
        return 'Đang soạn câu trả lời…';
      case 'done':
        return `Trợ lý trả lời: ${reply.text}`;
      case 'error':
        return reply.error ?? '';
      default:
        return '';
    }
  });

  /** The chat as stored: only while nothing is streaming, so a write happens once per finished turn. */
  private readonly persisted = computed(() => {
    if (this.state.answeringId() !== null) return null;
    const userId = this.userId();
    return userId
      ? { userId, open: this.isOpen$(), turns: this.turns$() }
      : null;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.streaming?.unsubscribe());
    effect(() => {
      const chat = this.persisted();
      if (chat) untracked(() => this.persist(chat));
    });
    effect(() => {
      const userId = this.userId();
      untracked(() => this.userChanged(userId));
    });
  }

  setTurns(turns: readonly AgentTurn[]): void {
    this.state.turns.set(turns);
  }

  setOpen(open: boolean): void {
    this.state.open.set(open);
  }

  setAnsweringId(id: number | null): void {
    this.state.answeringId.set(id);
  }

  setConfirmingId(id: number | null): void {
    this.state.confirmingId.set(id);
  }

  // ---- panel -----------------------------------------------------------------------------------

  open(): void {
    this.setOpen(true);
  }

  close(): void {
    this.setOpen(false);
  }

  toggle(): void {
    this.setOpen(!this.isOpen$());
  }

  // ---- conversation ----------------------------------------------------------------------------

  /** Asks one question; ignored while another answer is on its way. */
  ask(rawQuestion: string): void {
    const question = rawQuestion.trim();
    if (!question || this.isAnswering$()) return;
    const id = Math.max(0, ...this.turns$().map((t) => t.id)) + 1;
    const command = this.commandFor(question);
    this.setTurns([...this.turns$(), { id, question, reply: WAITING }]);
    this.setAnsweringId(id);
    if (this.network.offline$()) {
      this.fail(id, OFFLINE_MESSAGE);
      return;
    }
    this.streaming = this.client
      .stream(agentEndpoints.stream, { body: command })
      .subscribe({
        next: (event) => this.apply(id, event),
        error: (error: unknown) => {
          const app = toAppError(error);
          this.fail(id, app.kind === 'offline' ? OFFLINE_MESSAGE : app.message);
        },
        complete: () => {
          const status = this.turnOf(id)?.reply.status;
          if (
            status === 'waiting' ||
            status === 'working' ||
            status === 'composing'
          ) {
            this.fail(id, CUT_OFF_MESSAGE);
          }
          this.streaming = null;
        },
      });
  }

  /** Aborts the reply in progress and keeps what has arrived, marked as stopped. */
  stop(): void {
    const id = this.state.answeringId();
    if (id === null) return;
    this.dropStream();
    this.patchReply(id, { status: 'stopped' });
    this.setAnsweringId(null);
  }

  /** Empties the conversation; refused while a reply is on its way. */
  clear(): void {
    if (this.isAnswering$()) return;
    this.setTurns([]);
  }

  // ---- a proposed change -----------------------------------------------------------------------

  // Confirm and cancel are not `serverMutation`: the card is the one place the result shows, so a
  // success toast and a failure toast would say it twice, and each outcome belongs to one turn.

  /** Runs the change the card shows, as the user. Does nothing unless the card is waiting for a click. */
  confirm(turnId: number): void {
    const card = this.pendingCard(turnId);
    if (!card || this.isConfirming$()) return;
    if (this.hasExpired(card.pending)) {
      this.patchCard(turnId, { status: 'expired', message: EXPIRED_MESSAGE });
      return;
    }
    if (this.network.offline$()) {
      this.patchCard(turnId, { message: OFFLINE_MESSAGE });
      return;
    }
    this.setConfirmingId(turnId);
    this.patchCard(turnId, { status: 'confirming', message: null });
    const userId = this.userId();
    this.settling = this.client
      .call(agentEndpoints.confirmAction, {
        params: { actionId: card.pending.id },
      })
      .pipe(
        finalize(() => this.setConfirmingId(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: this.sameUser(userId, (result) => {
          this.session.apply(result.data);
          this.patchCard(turnId, {
            status: 'confirmed',
            message: result.message,
          });
        }),
        error: this.sameUser(userId, (error: unknown) =>
          this.refused(turnId, error),
        ),
      });
  }

  /** Drops the change without running it. */
  cancel(turnId: number): void {
    const card = this.pendingCard(turnId);
    if (!card || this.isConfirming$()) return;
    if (this.network.offline$()) {
      this.patchCard(turnId, { message: OFFLINE_MESSAGE });
      return;
    }
    this.setConfirmingId(turnId);
    this.patchCard(turnId, { status: 'confirming', message: null });
    const userId = this.userId();
    this.settling = this.client
      .call(agentEndpoints.cancelAction, {
        params: { actionId: card.pending.id },
      })
      .pipe(
        finalize(() => this.setConfirmingId(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: this.sameUser(userId, () =>
          this.patchCard(turnId, {
            status: 'cancelled',
            message: CANCELLED_MESSAGE,
          }),
        ),
        error: this.sameUser(userId, (error: unknown) =>
          this.refused(turnId, error),
        ),
      });
  }

  /**
   * Runs `handle` only while the user who sent the request is still the one signed in: an answer
   * that lands after a sign-out or a switch, before the store has dropped the request, belongs to
   * nobody on screen and must not reach the session or the new user's conversation.
   */
  private sameUser<T>(
    userId: string | undefined,
    handle: (value: T) => void,
  ): (value: T) => void {
    return (value) => {
      if (this.userId() === userId) handle(value);
    };
  }

  private refused(turnId: number, error: unknown): void {
    const app = toAppError(error);
    if (app.kind === 'offline') {
      this.patchCard(turnId, { status: 'pending', message: OFFLINE_MESSAGE });
    } else if (app.messageCode === NOT_FOUND_CODE) {
      this.patchCard(turnId, { status: 'expired', message: app.message });
    } else {
      this.patchCard(turnId, { status: 'failed', message: app.message });
    }
  }

  private hasExpired(action: PendingAction): boolean {
    return Date.parse(action.expiresAt) <= Date.now();
  }

  private pendingCard(turnId: number): ActionCard | null {
    const card = this.turnOf(turnId)?.reply.action;
    return card?.status === 'pending' ? card : null;
  }

  // ---- stream events ---------------------------------------------------------------------------

  private apply(id: number, event: AgentStreamEvent): void {
    switch (event.type) {
      case 'tool':
        this.patchReply(id, { status: 'working', toolName: event.name });
        break;
      case 'delta':
        this.patchReply(id, (reply) => ({
          status: 'composing',
          text: reply.text + event.text,
        }));
        break;
      case 'navigate':
        this.navigate(id, event.path, event.title);
        break;
      case 'action_required':
        this.patchReply(id, {
          action: { pending: event.action, status: 'pending', message: null },
        });
        break;
      case 'done':
        this.patchReply(id, {
          status: 'done',
          // The server's final text wins over what was streamed.
          text: event.answer,
          citations: event.citations,
        });
        this.setAnsweringId(null);
        break;
      case 'error':
        this.fail(id, event.message);
        break;
    }
  }

  /** Only a screen in the user's own menu opens; the route guard still applies on top. */
  private navigate(id: number, path: string, title: string): void {
    const inMenu = (this.session.user$()?.nav ?? []).some((section) =>
      section.items.some((item) => item.href === path),
    );
    if (!inMenu) {
      this.dropStream();
      this.fail(id, GENERIC_ERROR);
      return;
    }
    this.patchReply(id, { navigatedTo: { path, title } });
    void this.router.navigateByUrl(path);
  }

  private fail(id: number, error: string): void {
    this.patchReply(id, { status: 'error', error });
    this.setAnsweringId(null);
  }

  private dropStream(): void {
    this.streaming?.unsubscribe();
    this.streaming = null;
  }

  // ---- history and storage ---------------------------------------------------------------------

  /** The finished turns (errored and stopped ones are left out), then the new question. */
  private commandFor(question: string): AgentCommand {
    const history = this.turns$()
      .filter((turn) => turn.reply.status === 'done')
      .slice(-HISTORY_TURNS)
      .flatMap((turn) => [
        { role: 'user' as const, content: turn.question },
        { role: 'assistant' as const, content: this.answerOf(turn) },
      ]);

    return { messages: [...history, { role: 'user', content: question }] };
  }

  /** What the assistant said, with the result of its card once the user settled it. */
  private answerOf(turn: AgentTurn): string {
    const card = turn.reply.action;
    const settled =
      card?.status === 'confirmed' || card?.status === 'cancelled';
    return settled && card.message
      ? `${turn.reply.text}\n${card.message}`
      : turn.reply.text;
  }

  private persist(chat: {
    userId: string;
    open: boolean;
    turns: readonly AgentTurn[];
  }): void {
    if (!chat.open && chat.turns.length === 0) this.storage.clear(chat.userId);
    else
      this.storage.write(chat.userId, {
        open: chat.open,
        turns: [...chat.turns],
      });
  }

  /** A sign-out, or another user signing in on this tab, leaves nothing of the old conversation. */
  private userChanged(userId: string | undefined): void {
    const previous = this.lastUserId;
    this.lastUserId = userId;
    if (previous === undefined || previous === userId) return;
    this.dropStream();
    this.settling?.unsubscribe();
    this.settling = null;
    this.setAnsweringId(null);
    this.setConfirmingId(null);
    this.storage.clear(previous);
  }

  // ---- patching --------------------------------------------------------------------------------

  private turnOf(id: number): AgentTurn | undefined {
    return this.turns$().find((turn) => turn.id === id);
  }

  private patchReply(
    id: number,
    patch: Partial<AgentReply> | ((reply: AgentReply) => Partial<AgentReply>),
  ): void {
    this.setTurns(
      this.turns$().map((turn) =>
        turn.id === id
          ? {
              ...turn,
              reply: {
                ...turn.reply,
                ...(typeof patch === 'function' ? patch(turn.reply) : patch),
              },
            }
          : turn,
      ),
    );
  }

  private patchCard(id: number, patch: Partial<ActionCard>): void {
    this.patchReply(id, (reply) => ({
      action: reply.action ? { ...reply.action, ...patch } : null,
    }));
  }
}
