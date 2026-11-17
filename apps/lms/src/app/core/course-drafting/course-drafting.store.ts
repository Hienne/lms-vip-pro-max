import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  draftingSessionEndpoints,
  type DraftingSession,
  type DraftingStep,
} from '@lms/contracts';
import { invalidation } from '../data-access/invalidation';
import { serverData } from '../data-access/server-data';
import { serverMutation } from '../data-access/server-mutation';
import { EndpointClient } from '../http/endpoint-client';
import { NetworkStore } from '../network/network.store';
import { pollWhileVisible } from '../polling/poll-while-visible';

/** How often a session is asked about while one of its steps is being proposed. */
export const DRAFTING_POLL_INTERVAL_MS = 3000;

/**
 * The drafting session ("Soạn cùng trợ lý") the author is following: the server proposes a new
 * course one editor step at a time, and this store reads the session, asks about it every few
 * seconds while a step is `proposing` and the tab is visible, and sends the author's commands.
 * Provided in root because the course editor and the chat's step card follow the same session.
 */
@Injectable({ providedIn: 'root' })
export class CourseDraftingStore {
  private readonly client = inject(EndpointClient);
  private readonly network = inject(NetworkStore);

  private readonly state = {
    /** The session followed; none until a page or the chat loads one. */
    sessionId: signal<number | undefined>(undefined),
  };

  private readonly polls = invalidation();

  private readonly sessionData = serverData(
    (sessionId: number) =>
      this.client.call(draftingSessionEndpoints.get, { params: { sessionId } }),
    { params: () => this.state.sessionId(), reloadOn: this.polls },
  );

  private readonly stopMutation = serverMutation(
    (sessionId: number) =>
      this.client.call(draftingSessionEndpoints.stop, {
        params: { sessionId },
      }),
    { errors: 'toast', invalidates: this.polls },
  );

  readonly sessionId$ = this.state.sessionId.asReadonly();
  readonly session$ = computed((): DraftingSession | undefined => {
    const session = this.sessionData.value();
    return session && session.id === this.state.sessionId()
      ? session
      : undefined;
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

  private readonly pollTimer = effect((onCleanup) => {
    if (!this.isProposing$() || this.network.offline$()) return;
    onCleanup(
      pollWhileVisible(DRAFTING_POLL_INTERVAL_MS, () => this.polls.bump()),
    );
  });

  private setSessionId(sessionId: number | undefined): void {
    this.state.sessionId.set(sessionId);
  }

  /** Follows this session; the same one is read again. */
  load(sessionId: number): void {
    if (this.state.sessionId() === sessionId) this.sessionData.reload();
    else this.setSessionId(sessionId);
  }

  /** "Dừng": the server stops the step it is working on; nothing happens when none is. */
  stop(): void {
    const session = this.session$();
    if (session && this.isProposing$()) this.stopMutation.run(session.id);
  }
}
