import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
  type Signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  draftingSessionEndpoints,
  type DraftingCard,
  type DraftingSession,
  type DraftingStep,
  type DraftingStepNumber,
} from '@lms/contracts';
import { AgentChatStore } from '../assistant/agent-chat.store';
import { invalidation } from '../data-access/invalidation';
import { serverData } from '../data-access/server-data';
import { serverMutation } from '../data-access/server-mutation';
import { EndpointClient } from '../http/endpoint-client';
import { NetworkStore } from '../network/network.store';
import { pollWhileVisible } from '../polling/poll-while-visible';

/** "Đã chốt" pressed on the chat's card for a step the open editor page shows. */
export interface DraftingConfirmRequest {
  readonly sessionId: number;
  readonly step: DraftingStepNumber;
}

/** How often a session is asked about while one of its steps is being proposed. */
export const DRAFTING_POLL_INTERVAL_MS = 3000;

/**
 * The drafting session ("Soạn cùng trợ lý") the author is following: the server proposes a new
 * course one editor step at a time. This store reads the session, asks about it every few seconds
 * while a step is `proposing`, the tab is visible and someone shows it (the editor page on that
 * session, or the chat panel on the conversation that started it), and passes the chat card's
 * "Đã chốt" to the editor page. Provided by the shell, which hosts both the chat and the editor.
 * The step commands that change the page (confirm, propose again, fill by hand) belong to the
 * editor page's own store.
 */
@Injectable()
export class CourseDraftingStore {
  private readonly client = inject(EndpointClient);
  private readonly network = inject(NetworkStore);
  private readonly router = inject(Router);
  private readonly chat = inject(AgentChatStore);

  private readonly state = {
    /** The session followed when no editor page names one: the chat's, or the one just confirmed. */
    sessionId: signal<number | undefined>(undefined),
    /** The session the open editor page shows, as the page knows it; null while no page is open. */
    editorSession: signal<Signal<number | undefined> | null>(null),
    /** The chat card's "Đã chốt" for the editor page to confirm with its values. */
    confirmRequest: signal<DraftingConfirmRequest | null>(null),
  };

  private readonly polls = invalidation();

  /** The session the open editor page shows, if a page is open and follows one. */
  private readonly editorSessionId = computed(() =>
    this.state.editorSession()?.(),
  );

  /** The session followed: the editor page's, else the one named last. */
  private readonly followedId = computed(
    () => this.editorSessionId() ?? this.state.sessionId(),
  );

  private readonly sessionData = serverData(
    (sessionId: number) =>
      this.client.call(draftingSessionEndpoints.get, { params: { sessionId } }),
    { params: () => this.followedId(), reloadOn: this.polls },
  );

  private readonly stopMutation = serverMutation(
    (sessionId: number) =>
      this.client.call(draftingSessionEndpoints.stop, {
        params: { sessionId },
      }),
    { errors: 'toast', invalidates: this.polls },
  );

  readonly sessionId$ = this.followedId;
  readonly session$ = computed((): DraftingSession | undefined => {
    const session = this.sessionData.value();
    return session && session.id === this.followedId() ? session : undefined;
  });
  readonly loadError$ = this.sessionData.error;
  /** The step the session is at (`currentStep`), once the server has reached it. */
  readonly step$ = computed((): DraftingStep | undefined => {
    const session = this.session$();
    return session?.steps.find((step) => step.step === session.currentStep);
  });
  /** A step is being worked on by the server: the session is asked about again soon. */
  readonly isProposing$ = computed(
    () =>
      this.session$()?.steps.some((step) => step.state === 'proposing') ??
      false,
  );
  readonly isStopping$ = this.stopMutation.isPending;
  readonly confirmRequest$ = this.state.confirmRequest.asReadonly();

  /** The open conversation is the one that started the followed session. */
  private readonly inChat = computed(() => {
    const session = this.session$();
    return (
      !!session &&
      session.conversationId !== null &&
      session.conversationId === this.chat.conversationId$()
    );
  });

  /** Someone shows the session: the editor page on it, or the open chat panel with its cards. */
  private readonly watched = computed(() => {
    const session = this.session$();
    if (!session) return false;
    return (
      this.editorSessionId() === session.id ||
      (this.inChat() && this.chat.isOpen$())
    );
  });

  private readonly pollTimer = effect((onCleanup) => {
    const proposing = this.isProposing$();
    const offline = this.network.offline$();
    const watched = this.watched();
    if (!proposing || offline || !watched) return;
    onCleanup(
      pollWhileVisible(DRAFTING_POLL_INTERVAL_MS, () => this.polls.bump()),
    );
  });

  /**
   * The steps of the followed session, when the open conversation started it: a step that gets its
   * proposal, fails or is confirmed has a new message or card state on the server.
   */
  private readonly chatSteps = computed((): string | null => {
    const session = this.session$();
    if (!session || !this.inChat()) return null;
    const steps = session.steps.map((step) => `${step.step}:${step.state}`);
    return `${session.conversationId}|${session.id}|${steps.join(',')}`;
  });

  /** The chat steps read back last, so each change of the session reads the conversation once. */
  private chatStepsSeen: string | null = null;

  /**
   * The conversation is a server read the chat holds outside the signal graph: it is read again
   * when the session it started moved on, once the answer on its way (if any) has ended.
   */
  private readonly chatSync = effect(() => {
    const steps = this.chatSteps();
    const answering = this.chat.isAnswering$();
    if (steps === null || answering || steps === this.chatStepsSeen) return;
    this.chatStepsSeen = steps;
    const conversationId = untracked(() => this.session$()?.conversationId);
    if (conversationId != null)
      untracked(() => this.chat.reloadConversation(conversationId));
  });

  private setSessionId(sessionId: number | undefined): void {
    this.state.sessionId.set(sessionId);
  }

  private setEditorSession(session: Signal<number | undefined> | null): void {
    this.state.editorSession.set(session);
  }

  private setConfirmRequest(request: DraftingConfirmRequest | null): void {
    this.state.confirmRequest.set(request);
  }

  /** Follows this session; the same one is read again. */
  follow(sessionId: number): void {
    if (this.state.sessionId() === sessionId) this.sessionData.reload();
    else this.setSessionId(sessionId);
  }

  /**
   * The editor page opens: it shows the session `sessionId` names (none yet on a new course typed
   * by hand), and the session followed is that one while the page is open.
   */
  showInEditor(sessionId: Signal<number | undefined>): void {
    this.setEditorSession(sessionId);
  }

  /** The editor page closes: the session followed is the one named last; a pending card's confirm is dropped. */
  leaveEditor(sessionId: Signal<number | undefined>): void {
    if (this.state.editorSession() !== sessionId) return;
    const shown = this.editorSessionId();
    if (shown !== undefined) this.setSessionId(shown);
    this.setEditorSession(null);
    this.setConfirmRequest(null);
  }

  /** Reads the session again now, e.g. after a step command or a confirm the server refused. */
  refresh(): void {
    this.polls.bump();
  }

  /**
   * "Đã chốt" on the chat's card: on a tab where the editor shows that session, the page confirms
   * with its own values, as its bar would; elsewhere the editor opens at that step.
   */
  confirmFromChat(card: DraftingCard): void {
    if (this.editorSessionId() === card.sessionId) {
      this.setConfirmRequest({ sessionId: card.sessionId, step: card.step });
      return;
    }
    this.openEditor(card);
  }

  /** The editor page took the chat's "Đã chốt". */
  confirmRequestTaken(): void {
    this.setConfirmRequest(null);
  }

  /**
   * Opens the editor of the card's session at its step ("Mở trang soạn" on the card of a failed
   * step): the draft course once step 1 made it, else the new course page of the session.
   */
  openEditor(card: DraftingCard): void {
    void this.router.navigateByUrl(
      card.courseId === null
        ? `/admin/courses/new?session=${card.sessionId}`
        : `/admin/courses/${card.courseId}/edit?step=${card.step - 1}`,
    );
  }

  /** "Dừng": the server stops the step it is working on; nothing happens when none is. */
  stop(): void {
    const session = this.session$();
    if (session && this.isProposing$()) this.stopMutation.run(session.id);
  }
}
