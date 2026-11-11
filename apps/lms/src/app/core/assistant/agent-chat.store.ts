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
  answerFeedbackEndpoints,
  knowledgeEndpoints,
  type KnowledgeDocument,
  type RateAnswerCommand,
  type AgentCommand,
  type AgentSkill,
  type AgentStreamEvent,
  type ConversationContext,
  type LessonContext,
  type PendingAction,
} from '@lms/contracts';
import { finalize, Subscription } from 'rxjs';
import { CourseJobTrackerStore } from '../course-jobs/course-job-tracker.store';
import { DocumentTrackerStore } from '../knowledge/document-tracker.store';
import { toAppError } from '../errors/app-error';
import { EndpointClient } from '../http/endpoint-client';
import { NetworkStore } from '../network/network.store';
import { SessionStore } from '../session/session.store';
import type { ActionCard, AgentReply, AgentTurn } from './agent-chat.model';
import { AgentChatStorage } from './agent-chat.storage';
import { ConversationsStore } from './conversations.store';
import { turnFromStored } from './stored-turns';
import { toolStatusText } from './agent-status';

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
 * The quick assistant: the open conversation (its turns are the server's, read again after a
 * reload; this tab's `sessionStorage` keeps only its id), the panel's open state, the history view
 * and the card of a proposed change. Every answer, source, navigation target and action is
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
  private readonly conversations = inject(ConversationsStore);
  private readonly courseJobs = inject(CourseJobTrackerStore);
  private readonly documents = inject(DocumentTrackerStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private streaming: Subscription | null = null;
  /** The confirm or cancel request on its way; at most one, since one card settles at a time. */
  private settling: Subscription | null = null;
  /** The saved conversation being read back, if any. */
  private loading: Subscription | null = null;
  private lastUserId: string | undefined;

  private readonly userId = computed(() => this.session.user$()?.userId);

  // Both follow the user: a sign-out or another sign-in starts from what that user left.
  private readonly state = {
    turns: linkedSignal<string | undefined, readonly AgentTurn[]>({
      source: this.userId,
      computation: () => [],
    }),
    open: linkedSignal<string | undefined, boolean>({
      source: this.userId,
      computation: (id) => (id ? this.storage.read(id).open : false),
    }),
    docked: linkedSignal<string | undefined, boolean>({
      source: this.userId,
      computation: (id) =>
        id ? (this.storage.read(id).docked ?? false) : false,
    }),
    /** The server conversation the next question continues; null starts a new one. */
    conversationId: linkedSignal<string | undefined, number | null>({
      source: this.userId,
      computation: (id) =>
        id ? (this.storage.read(id).conversationId ?? null) : null,
    }),
    /** The lesson the open conversation is about; every question of it carries the lesson. */
    lesson: linkedSignal<string | undefined, ConversationContext | null>({
      source: this.userId,
      computation: () => null,
    }),
    answeringId: signal<number | null>(null),
    confirmingId: signal<number | null>(null),
    /** The turn whose rating is on its way, and the one whose last rating did not save. */
    ratingId: signal<number | null>(null),
    ratingFailedId: signal<number | null>(null),
    /** The panel shows the list of saved conversations instead of the open one. */
    history: signal(false),
    /** A saved conversation is being read from the server. */
    opening: signal(false),
    /** Why the last attempt to open a saved conversation failed; null when it did not. */
    openError: signal<string | null>(null),
  };

  readonly turns$ = this.state.turns.asReadonly();
  readonly isOpen$ = this.state.open.asReadonly();
  /**
   * The open panel is docked to the right edge, full height, and the page makes room for it. Only
   * a wide screen docks (the panel's and the shell's styles say from where); elsewhere the panel
   * floats whatever this says.
   */
  readonly isDocked$ = computed(
    () => this.available$() && this.isOpen$() && this.state.docked(),
  );
  /** The lesson the panel is about, for its label; null for a conversation about nothing in particular. */
  readonly lesson$ = this.state.lesson.asReadonly();
  readonly isAnswering$ = computed(() => this.state.answeringId() !== null);
  readonly isConfirming$ = computed(() => this.state.confirmingId() !== null);
  readonly ratingId$ = this.state.ratingId.asReadonly();
  readonly ratingFailedId$ = this.state.ratingFailedId.asReadonly();
  readonly isHistoryOpen$ = this.state.history.asReadonly();
  readonly isOpening$ = this.state.opening.asReadonly();
  readonly openError$ = this.state.openError.asReadonly();
  /** The saved conversation the panel is on; null while it holds a new one. */
  readonly conversationId$ = this.state.conversationId.asReadonly();
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

  /** What the tab keeps: where the panel is and which saved conversation is open. */
  private readonly persisted = computed(() => {
    const userId = this.userId();
    return userId
      ? {
          userId,
          open: this.isOpen$(),
          docked: this.state.docked(),
          conversationId: this.state.conversationId(),
        }
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
    // A conversation deleted from the history may be the one open here.
    this.conversations.removed
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((removed) => {
        const open = this.state.conversationId();
        if (removed === 'all' || (open !== null && removed === open)) {
          this.stop();
          this.loading?.unsubscribe();
          this.setTurns([]);
          this.setConversationId(null);
          this.state.lesson.set(null);
        }
      });
  }

  setTurns(turns: readonly AgentTurn[]): void {
    this.state.turns.set(turns);
  }

  setConversationId(id: number | null): void {
    this.state.conversationId.set(id);
  }

  setOpen(open: boolean): void {
    this.state.open.set(open);
  }

  setDocked(docked: boolean): void {
    this.state.docked.set(docked);
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

  /** Docks the panel to the right edge, or lets it float again; remembered with the chat. */
  toggleDocked(): void {
    this.setDocked(!this.state.docked());
  }

  // ---- conversation ----------------------------------------------------------------------------

  /** Asks one question; ignored while another answer is on its way. */
  ask(
    rawQuestion: string,
    skill?: AgentSkill,
    attachmentDocumentId?: number,
  ): void {
    const question = rawQuestion.trim();
    if (!question || this.isAnswering$()) return;
    const id = Math.max(0, ...this.turns$().map((t) => t.id)) + 1;
    this.setTurns([...this.turns$(), { id, question, reply: WAITING }]);
    this.stream(id, question, skill, attachmentDocumentId);
  }

  /**
   * Asks the `tao_khoa_hoc` skill about a file the user attached: the file is uploaded as their
   * own personal document first, then the question goes with its id. The server decides who may
   * use the skill and whether the file is theirs; a refusal of either shows as the reply.
   */
  askWithFile(rawQuestion: string, file: File): void {
    const question = rawQuestion.trim();
    if (!question || this.isAnswering$()) return;
    const id = Math.max(0, ...this.turns$().map((t) => t.id)) + 1;
    this.setTurns([...this.turns$(), { id, question, reply: WAITING }]);
    this.setAnsweringId(id);
    if (this.network.offline$()) {
      this.fail(id, OFFLINE_MESSAGE);
      return;
    }
    const userId = this.userId();
    const subscription = new Subscription();
    this.streaming = subscription;
    subscription.add(
      this.client
        .call(knowledgeEndpoints.uploadDocument, {
          body: { file, scope: 'personal' },
        })
        .subscribe({
          next: this.sameUser(userId, (document: KnowledgeDocument) => {
            this.documents.track(document);
            this.stream(id, question, 'tao_khoa_hoc', document.id);
          }),
          error: this.sameUser(userId, (error: unknown) => {
            const app = toAppError(error);
            this.fail(
              id,
              app.kind === 'offline' ? OFFLINE_MESSAGE : app.message,
            );
          }),
        }),
    );
  }

  /**
   * Opens the panel on a new conversation about a lesson and asks `question` in it (the server
   * checks the user may read the lesson). The conversation already open on this lesson continues;
   * any other, or one about nothing, stays in the history. Ignored while an answer is on its way.
   */
  askAboutLesson(
    lesson: ConversationContext,
    question: string,
    skill?: AgentSkill,
  ): void {
    if (this.isAnswering$()) return;
    const open = this.state.lesson();
    if (
      open?.lessonId !== lesson.lessonId ||
      open.revisionId !== lesson.revisionId
    ) {
      this.loading?.unsubscribe();
      this.state.opening.set(false);
      this.setTurns([]);
      this.setConversationId(null);
      this.state.history.set(false);
      this.state.lesson.set(lesson);
    }
    this.setOpen(true);
    this.ask(question, skill);
  }

  /**
   * Asks a failed or stopped turn's question again and replaces its reply; ignored for any other
   * turn, and while another answer is on its way.
   */
  retry(turnId: number): void {
    const turn = this.turnOf(turnId);
    if (!turn || this.isAnswering$()) return;
    if (turn.reply.status !== 'error' && turn.reply.status !== 'stopped')
      return;
    this.patchReply(turnId, WAITING);
    this.stream(turnId, turn.question);
  }

  private stream(
    id: number,
    question: string,
    skill?: AgentSkill,
    attachmentDocumentId?: number,
  ): void {
    const command = this.commandFor(question, skill, attachmentDocumentId);
    this.setAnsweringId(id);
    if (this.network.offline$()) {
      this.fail(id, OFFLINE_MESSAGE);
      return;
    }
    // A stream can close after its done line and after the next question has started: its late
    // callbacks touch only its own turn, and only while the same user is signed in.
    const userId = this.userId();
    const subscription = new Subscription();
    this.streaming = subscription;
    subscription.add(
      this.client.stream(agentEndpoints.stream, { body: command }).subscribe({
        next: this.sameUser(userId, (event: AgentStreamEvent) =>
          this.apply(id, event),
        ),
        error: this.sameUser(userId, (error: unknown) => {
          const app = toAppError(error);
          this.fail(id, app.kind === 'offline' ? OFFLINE_MESSAGE : app.message);
        }),
        complete: () => {
          const status = this.turnOf(id)?.reply.status;
          if (
            this.userId() === userId &&
            (status === 'waiting' ||
              status === 'working' ||
              status === 'composing')
          ) {
            this.fail(id, CUT_OFF_MESSAGE);
          }
          if (this.streaming === subscription) this.streaming = null;
        },
      }),
    );
  }

  /** Aborts the reply in progress and keeps what has arrived, marked as stopped. */
  stop(): void {
    const id = this.state.answeringId();
    if (id === null) return;
    this.dropStream();
    this.patchReply(id, { status: 'stopped' });
    this.setAnsweringId(null);
  }

  /** Starts a new conversation (the saved one stays in the history); refused while a reply is on its way. */
  clear(): void {
    if (this.isAnswering$()) return;
    this.loading?.unsubscribe();
    this.state.opening.set(false);
    this.setTurns([]);
    this.setConversationId(null);
    this.state.lesson.set(null);
    this.state.history.set(false);
  }

  // ---- saved conversations ---------------------------------------------------------------------

  showHistory(): void {
    this.conversations.watch();
    this.state.openError.set(null);
    this.state.history.set(true);
  }

  hideHistory(): void {
    this.state.history.set(false);
  }

  /** Reopens a saved conversation in the panel; refused while a reply is on its way. */
  openConversation(id: number): void {
    if (this.isAnswering$()) return;
    this.state.openError.set(null);
    this.read(id, true);
  }

  /** Reads the conversation from the server; a restore after a reload fails quietly, an open says why. */
  private read(id: number, announce: boolean): void {
    this.loading?.unsubscribe();
    const userId = this.userId();
    this.state.opening.set(true);
    this.loading = this.conversations.detail(id).subscribe({
      next: this.sameUser(userId, (detail) => {
        this.state.opening.set(false);
        // A question asked while this was loading is newer than what was saved.
        if (this.isAnswering$()) return;
        this.setTurns(detail.turns.map(turnFromStored));
        this.setConversationId(detail.id);
        this.state.lesson.set(detail.context ?? null);
        this.state.history.set(false);
      }),
      error: this.sameUser(userId, (error: unknown) => {
        this.state.opening.set(false);
        if (announce) {
          this.state.openError.set(toAppError(error).message);
        } else {
          this.setConversationId(null);
        }
      }),
    });
  }

  // ---- feedback on an answer -------------------------------------------------------------------

  /**
   * Sends the user's thumbs for a finished answer, replacing an earlier one. The turn keeps the
   * server's saved copy, so a failure leaves the earlier choice showing. Not `serverMutation`: the
   * feedback control is the one place the outcome shows.
   */
  rate(turnId: number, command: RateAnswerCommand): void {
    const serverTurnId = this.turnOf(turnId)?.serverTurnId;
    if (serverTurnId === undefined || this.state.ratingId() !== null) return;
    if (this.network.offline$()) {
      this.state.ratingFailedId.set(turnId);
      return;
    }
    this.state.ratingFailedId.set(null);
    this.state.ratingId.set(turnId);
    const userId = this.userId();
    this.client
      .call(answerFeedbackEndpoints.rate, {
        params: { turnId: serverTurnId },
        body: command,
      })
      .pipe(
        finalize(() => this.state.ratingId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: this.sameUser(userId, (feedback) =>
          this.setTurns(
            this.turns$().map((turn) =>
              turn.id === turnId ? { ...turn, feedback } : turn,
            ),
          ),
        ),
        error: this.sameUser(userId, () =>
          this.state.ratingFailedId.set(turnId),
        ),
      });
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
          if (result.tool === 'update_profile') {
            this.session.apply(result.data);
            this.patchCard(turnId, {
              status: 'confirmed',
              message: result.message,
            });
          } else {
            this.courseJobs.trackById(result.data.jobId);
            this.patchCard(turnId, {
              status: 'confirmed',
              message: result.message,
              link: { path: result.data.path, label: 'Mở màn hình rà soát' },
            });
          }
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
      case 'conversation':
        this.setConversationId(event.conversationId);
        // The list shows a new conversation as soon as it exists.
        this.conversations.touch();
        break;
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
        this.setTurns(
          this.turns$().map((turn) =>
            turn.id === id
              ? {
                  ...turn,
                  serverTurnId: event.turnId,
                  feedback: null,
                  suggestions: event.suggestions ?? [],
                }
              : turn,
          ),
        );
        this.answered(id);
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
    this.answered(id);
  }

  /** Turn `id` no longer streams; a newer turn that is still answering keeps the composer locked. */
  private answered(id: number): void {
    if (this.state.answeringId() === id) this.setAnsweringId(null);
    this.conversations.touch();
  }

  private dropStream(): void {
    this.streaming?.unsubscribe();
    this.streaming = null;
  }

  // ---- history and storage ---------------------------------------------------------------------

  /** The question and the conversation it continues; the server holds the earlier turns. */
  private commandFor(
    question: string,
    skill?: AgentSkill,
    attachmentDocumentId?: number,
  ): AgentCommand {
    const conversationId = this.state.conversationId();
    const lesson = this.state.lesson();
    const context: LessonContext | undefined = lesson
      ? {
          courseId: lesson.courseId,
          revisionId: lesson.revisionId,
          lessonId: lesson.lessonId,
        }
      : undefined;
    const base = {
      message: question,
      ...(skill ? { skill } : {}),
      ...(context ? { context } : {}),
      ...(attachmentDocumentId ? { attachmentDocumentId } : {}),
    };
    return conversationId === null ? base : { ...base, conversationId };
  }

  private persist(chat: {
    userId: string;
    open: boolean;
    docked: boolean;
    conversationId: number | null;
  }): void {
    if (!chat.open && chat.conversationId === null) {
      this.storage.clear(chat.userId);
    } else {
      this.storage.write(chat.userId, {
        open: chat.open,
        docked: chat.docked,
        ...(chat.conversationId ? { conversationId: chat.conversationId } : {}),
      });
    }
  }

  /** A sign-out, or another user signing in on this tab, leaves nothing of the old conversation. */
  private userChanged(userId: string | undefined): void {
    const previous = this.lastUserId;
    this.lastUserId = userId;
    if (userId !== undefined) this.storage.clearOthers(userId);
    // First sight of a signed-in user: the open conversation is the server's, so read it back.
    const restoring = this.state.conversationId();
    if (previous === undefined && userId !== undefined && restoring !== null) {
      this.read(restoring, false);
    }
    if (previous === undefined || previous === userId) return;
    this.dropStream();
    this.loading?.unsubscribe();
    this.loading = null;
    this.state.opening.set(false);
    this.state.history.set(false);
    this.state.openError.set(null);
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
