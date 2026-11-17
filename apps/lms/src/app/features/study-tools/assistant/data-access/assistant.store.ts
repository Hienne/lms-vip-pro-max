import { BreakpointObserver } from '@angular/cdk/layout';
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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  answerFeedbackEndpoints,
  type AskCommand,
  type ChatStreamEvent,
  knowledgeEndpoints,
  type RateAnswerCommand,
} from '@lms/contracts';
import { finalize, map, type Subscription } from 'rxjs';
import { ConversationsStore } from '../../../../core/assistant/conversations.store';
import { SourceViewerStore } from '../../../../core/assistant/source-viewer.store';
import { toAppError } from '../../../../core/errors/app-error';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { NetworkStore } from '../../../../core/network/network.store';
import { SessionStore } from '../../../../core/session/session.store';
import { AssistantViewStorage } from './assistant-view.storage';
import type { Answer, Turn } from './assistant.model';
import { turnFromStored } from './stored-turns';

/** From here the conversation list is a column beside the chat; below it, a drawer. */
export const HISTORY_BESIDE_QUERY = '(min-width: 1100px)';

/** From here an opened source is a pane beside the chat; below it, the shell's drawer. */
export const SOURCE_BESIDE_QUERY = '(min-width: 1280px)';

export const OFFLINE_MESSAGE =
  'Mất kết nối — không gửi được câu hỏi. Thử lại khi có mạng.';
const CUT_OFF_MESSAGE = 'Kết nối bị ngắt khi đang trả lời.';

const SEARCHING: Answer = {
  status: 'searching',
  text: '',
  retrieved: null,
  found: null,
  citations: [],
  error: null,
};

/**
 * The assistant screen: the chat (kept in the browser, one question at a time), the saved
 * conversations beside it, and where an opened source shows. Retrieval, answers and citations are
 * all the server's; this store only shows them. The documents are `KnowledgeDocumentsStore`'s.
 */
@Injectable()
export class AssistantStore {
  private readonly client = inject(EndpointClient);
  private readonly network = inject(NetworkStore);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly conversations = inject(ConversationsStore);
  private readonly session = inject(SessionStore);
  private readonly viewStorage = inject(AssistantViewStorage);
  private readonly destroyRef = inject(DestroyRef);

  private nextId = 1;
  /** The saved conversation being read back, if any. */
  private loading: Subscription | null = null;

  private readonly historyWide = toSignal(
    this.breakpoints
      .observe(HISTORY_BESIDE_QUERY)
      .pipe(map((result) => result.matches)),
    { initialValue: this.breakpoints.isMatched(HISTORY_BESIDE_QUERY) },
  );
  private readonly sourceWide = toSignal(
    this.breakpoints
      .observe(SOURCE_BESIDE_QUERY)
      .pipe(map((result) => result.matches)),
    { initialValue: this.breakpoints.isMatched(SOURCE_BESIDE_QUERY) },
  );
  private readonly viewer = inject(SourceViewerStore);
  private streaming: Subscription | null = null;

  private readonly state = {
    turns: signal<readonly Turn[]>([]),
    /** The server conversation the next question continues; null starts a new one. */
    conversationId: signal<number | null>(null),
    answeringId: signal<number | null>(null),
    /** The turn whose rating is on its way, and the one whose last rating did not save. */
    ratingId: signal<number | null>(null),
    ratingFailedId: signal<number | null>(null),
    /** A saved conversation is being read from the server. */
    opening: signal(false),
    /** Why the last attempt to open a saved conversation failed; null when it did not. */
    openError: signal<string | null>(null),
    /** Open beside the chat on a wide screen, a closed drawer on a narrow one, until toggled. */
    historyOpen: linkedSignal<boolean, boolean>({
      source: () => this.historyWide(),
      computation: (wide) => wide,
    }),
  };

  readonly turns$ = this.state.turns.asReadonly();
  readonly isAnswering$ = computed(() => this.state.answeringId() !== null);
  readonly ratingId$ = this.state.ratingId.asReadonly();
  readonly ratingFailedId$ = this.state.ratingFailedId.asReadonly();
  readonly conversationId$ = this.state.conversationId.asReadonly();
  readonly isOpening$ = this.state.opening.asReadonly();
  readonly openError$ = this.state.openError.asReadonly();
  readonly historyOpen$ = this.state.historyOpen.asReadonly();
  /** The conversation list is a column beside the chat. */
  readonly historyBeside$ = computed(
    () => this.historyWide() && this.historyOpen$(),
  );
  /** The conversation list is a drawer over the chat. */
  readonly historyInDrawer$ = computed(
    () => !this.historyWide() && this.historyOpen$(),
  );
  /** An opened source is a pane beside the chat (on a narrow screen it is the shell's drawer). */
  readonly sourceBeside$ = computed(
    () => this.sourceWide() && this.viewer.citation$() !== null,
  );
  /** What a screen reader hears about the answer in progress; the streamed text itself is silent. */
  readonly announcement$ = computed(() => {
    const answer = this.turns$().at(-1)?.answer;
    switch (answer?.status) {
      case 'searching':
        return 'Đang tìm trong tài liệu…';
      case 'composing':
        return 'Đang soạn câu trả lời…';
      case 'done':
        return `Trợ lý trả lời: ${answer.text}`;
      case 'error':
        return answer.error ?? '';
      default:
        return '';
    }
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.streaming?.unsubscribe();
      this.loading?.unsubscribe();
      // The shell's drawer shows sources again, and a source left open does not follow the user.
      this.viewer.setDocked(false);
      this.viewer.close();
    });
    // On a wide screen the page frames an opened source itself.
    effect(() => this.viewer.setDocked(this.sourceWide()));

    // The page shows the list, so it is read from now on; a deleted conversation may be the open one.
    this.conversations.watch();
    this.conversations.removed
      .pipe(takeUntilDestroyed())
      .subscribe((removed) => {
        const open = this.state.conversationId();
        if (removed === 'all' || (open !== null && removed === open)) {
          this.stop();
          this.loading?.unsubscribe();
          this.setTurns([]);
          this.state.conversationId.set(null);
        }
      });
    // A reload keeps the open conversation: its id is the tab's, its turns are read from the server.
    const userId = this.session.user$()?.userId;
    const saved = userId ? this.viewStorage.read(userId) : null;
    if (saved !== null) this.read(saved, false);
    effect(() => {
      const id = this.state.conversationId();
      const user = this.session.user$()?.userId;
      if (user) untracked(() => this.viewStorage.write(user, id));
    });
  }

  setTurns(turns: readonly Turn[]): void {
    this.state.turns.set(turns);
  }

  setAnsweringId(id: number | null): void {
    this.state.answeringId.set(id);
  }

  // ---- chat ------------------------------------------------------------------------------------

  /** Asks one question; ignored while another answer is still on its way. */
  ask(rawQuestion: string): void {
    const question = rawQuestion.trim();
    if (!question || this.isAnswering$()) return;
    const id = this.nextId++;
    this.setTurns([...this.turns$(), { id, question, answer: SEARCHING }]);
    this.answer(id, question);
  }

  /** Aborts the answer in progress and keeps what has arrived, marked as stopped. */
  stop(): void {
    const id = this.state.answeringId();
    if (id === null) return;
    this.streaming?.unsubscribe();
    this.streaming = null;
    this.patchAnswer(id, { status: 'stopped' });
    this.setAnsweringId(null);
  }

  /** Asks the same question again, replacing the failed or stopped answer. */
  retry(turnId: number): void {
    const turn = this.turns$().find((t) => t.id === turnId);
    if (!turn || this.isAnswering$()) return;
    this.patchAnswer(turnId, SEARCHING);
    this.answer(turnId, turn.question);
  }

  /**
   * Sends the user's thumbs for a finished answer, replacing an earlier one. The turn keeps the
   * server's saved copy, so a failure leaves the earlier choice showing.
   */
  rate(turnId: number, command: RateAnswerCommand): void {
    const serverTurnId = this.turns$().find(
      (turn) => turn.id === turnId,
    )?.serverTurnId;
    if (serverTurnId === undefined || this.state.ratingId() !== null) return;
    if (this.network.offline$()) {
      this.state.ratingFailedId.set(turnId);
      return;
    }
    this.state.ratingFailedId.set(null);
    this.state.ratingId.set(turnId);
    const userId = this.session.user$()?.userId;
    const sameUser = () => this.session.user$()?.userId === userId;
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
        next: (feedback) => {
          if (!sameUser()) return;
          this.setTurns(
            this.turns$().map((turn) =>
              turn.id === turnId ? { ...turn, feedback } : turn,
            ),
          );
        },
        error: () => {
          if (sameUser()) this.state.ratingFailedId.set(turnId);
        },
      });
  }

  private answer(id: number, question: string): void {
    this.setAnsweringId(id);
    if (this.network.offline$()) {
      this.fail(id, OFFLINE_MESSAGE);
      return;
    }
    this.streaming = this.client
      .stream(knowledgeEndpoints.askStream, { body: this.commandFor(question) })
      .subscribe({
        next: (event) => this.apply(id, event),
        error: (error: unknown) => {
          const app = toAppError(error);
          this.fail(id, app.kind === 'offline' ? OFFLINE_MESSAGE : app.message);
        },
        complete: () => {
          const status = this.turns$().find((t) => t.id === id)?.answer.status;
          if (status === 'searching' || status === 'composing') {
            this.fail(id, CUT_OFF_MESSAGE);
          }
          this.streaming = null;
        },
      });
  }

  /** The question and the conversation it continues; the server holds the earlier turns. */
  private commandFor(question: string): AskCommand {
    const conversationId = this.state.conversationId();
    return conversationId === null
      ? { question }
      : { question, conversationId };
  }

  /** Starts over: the next question opens a new conversation. Refused while an answer is on its way. */
  newConversation(): void {
    if (this.isAnswering$()) return;
    this.loading?.unsubscribe();
    this.state.opening.set(false);
    this.state.openError.set(null);
    this.setTurns([]);
    this.state.conversationId.set(null);
    if (!this.historyWide()) this.state.historyOpen.set(false);
  }

  // ---- saved conversations ---------------------------------------------------------------------

  toggleHistory(): void {
    this.state.historyOpen.set(!this.historyOpen$());
  }

  closeHistory(): void {
    this.state.historyOpen.set(false);
  }

  /** Reopens a saved conversation; refused while an answer is on its way. */
  openConversation(id: number): void {
    if (this.isAnswering$()) return;
    this.state.openError.set(null);
    this.read(id, true);
  }

  /** Reads a conversation from the server; a restore after a reload fails quietly, an open says why. */
  private read(id: number, announce: boolean): void {
    this.loading?.unsubscribe();
    this.state.opening.set(true);
    this.loading = this.conversations.detail(id).subscribe({
      next: (detail) => {
        this.state.opening.set(false);
        // A question asked while this was loading is newer than what was saved.
        if (this.isAnswering$()) return;
        this.setTurns(detail.turns.map(turnFromStored));
        this.nextId = Math.max(0, ...detail.turns.map((t) => t.id)) + 1;
        this.state.conversationId.set(detail.id);
        if (!this.historyWide()) this.state.historyOpen.set(false);
      },
      error: (error: unknown) => {
        this.state.opening.set(false);
        if (announce) this.state.openError.set(toAppError(error).message);
        else this.state.conversationId.set(null);
      },
    });
  }

  private apply(id: number, event: ChatStreamEvent): void {
    switch (event.type) {
      case 'conversation':
        this.state.conversationId.set(event.conversationId);
        // The list shows a new conversation as soon as it exists.
        this.conversations.touch();
        break;
      case 'retrieved':
        this.patchAnswer(id, { status: 'composing', retrieved: event.count });
        break;
      case 'delta':
        this.patchAnswer(id, (answer) => ({ text: answer.text + event.text }));
        break;
      case 'done':
        this.patchAnswer(id, {
          status: 'done',
          found: event.found,
          // The server's final text wins over what was streamed (a "not found" is always its fixed sentence).
          text: event.answer,
          citations: event.citations,
          grounded: event.grounded,
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
        this.setAnsweringId(null);
        this.conversations.touch();
        break;
      case 'error':
        this.fail(id, event.message);
        break;
    }
  }

  private fail(id: number, error: string): void {
    this.patchAnswer(id, { status: 'error', error });
    this.setAnsweringId(null);
    this.conversations.touch();
  }

  private patchAnswer(
    id: number,
    patch: Partial<Answer> | ((answer: Answer) => Partial<Answer>),
  ): void {
    this.setTurns(
      this.turns$().map((turn) =>
        turn.id === id
          ? {
              ...turn,
              answer: {
                ...turn.answer,
                ...(typeof patch === 'function' ? patch(turn.answer) : patch),
              },
            }
          : turn,
      ),
    );
  }
}
