import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  draftingSessionEndpoints,
  type ConfirmDraftingStepCommand,
  type DraftingSession,
  type DraftingStep,
  type DraftingStepNumber,
} from '@lms/contracts';
import type { Observable } from 'rxjs';
import { invalidation } from '../data-access/invalidation';
import { serverData } from '../data-access/server-data';
import { serverMutation } from '../data-access/server-mutation';
import { EndpointClient } from '../http/endpoint-client';
import { NetworkStore } from '../network/network.store';
import { pollWhileVisible } from '../polling/poll-while-visible';

/** How the editor page showing a session confirms one of its steps. */
interface PageConfirm {
  readonly sessionId: number;
  readonly confirm: (step: DraftingStepNumber) => void;
}

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
    /** The draft course whose session is looked up, until a session is followed. */
    courseId: signal<number | undefined>(undefined),
    /** The editor page showing the session, which confirms a step with its own values. */
    pageConfirm: signal<PageConfirm | null>(null),
  };

  private readonly polls = invalidation();

  /** The session of a draft course, read once to find which session the edit page follows. */
  private readonly courseSessionData = serverData(
    (courseId: number) =>
      this.client.call(draftingSessionEndpoints.forCourse, {
        params: { courseId },
      }),
    { params: () => this.state.courseId() },
  );

  /** The session followed: the one named, else the one the draft course has. */
  private readonly followedId = computed(
    () =>
      this.state.sessionId() ??
      (this.state.courseId() === undefined
        ? undefined
        : (this.courseSessionData.value()?.id ?? undefined)),
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

  private readonly pollTimer = effect((onCleanup) => {
    if (!this.isProposing$() || this.network.offline$()) return;
    onCleanup(
      pollWhileVisible(DRAFTING_POLL_INTERVAL_MS, () => this.polls.bump()),
    );
  });

  private setSessionId(sessionId: number | undefined): void {
    this.state.sessionId.set(sessionId);
  }

  private setCourseId(courseId: number | undefined): void {
    this.state.courseId.set(courseId);
  }

  private setPageConfirm(confirm: PageConfirm | null): void {
    this.state.pageConfirm.set(confirm);
  }

  /** Follows this session; the same one is read again. */
  load(sessionId: number): void {
    this.setCourseId(undefined);
    if (this.state.sessionId() === sessionId) this.sessionData.reload();
    else this.setSessionId(sessionId);
  }

  /**
   * Follows the session that drafted this course, if it has one: how its edit page resumes after a
   * reload. The session already followed is kept when it is the course's (step 1 just confirmed).
   */
  loadForCourse(courseId: number): void {
    if (this.session$()?.courseId === courseId) {
      this.sessionData.reload();
      return;
    }
    this.setSessionId(undefined);
    if (this.state.courseId() === courseId) this.courseSessionData.reload();
    else this.setCourseId(courseId);
  }

  /** Reads the session again now, e.g. after a confirm the server refused. */
  refresh(): void {
    this.polls.bump();
  }

  /** "Đã chốt" with the given values: the server saves the step and starts the next one. */
  confirmWith(
    sessionId: number,
    step: DraftingStepNumber,
    body: ConfirmDraftingStepCommand,
  ): Observable<DraftingSession> {
    return this.client.call(draftingSessionEndpoints.confirm, {
      params: { sessionId, step },
      body,
    });
  }

  /**
   * The editor showing the session hands over how it confirms a step, so "Đã chốt" pressed
   * elsewhere (the chat's card) uses the values on the page. Returns the unregistration.
   */
  registerPageConfirm(
    sessionId: number,
    confirm: (step: DraftingStepNumber) => void,
  ): () => void {
    const entry: PageConfirm = { sessionId, confirm };
    this.setPageConfirm(entry);
    return () => {
      if (this.state.pageConfirm() === entry) this.setPageConfirm(null);
    };
  }

  /**
   * "Đã chốt" for the step of the followed session: the page that shows it confirms with its
   * values. False when no page shows it.
   */
  confirm(step: DraftingStepNumber): boolean {
    const page = this.state.pageConfirm();
    if (!page || page.sessionId !== this.followedId()) return false;
    page.confirm(step);
    return true;
  }

  /**
   * "Đề xuất lại" (and "Thử lại" on a failed step): the server proposes this step again, leaving
   * the other steps and the course alone. It counts against the daily course generation limit.
   */
  proposeAgain(
    sessionId: number,
    step: DraftingStepNumber,
  ): Observable<DraftingSession> {
    return this.client.call(draftingSessionEndpoints.proposeAgain, {
      params: { sessionId, step },
    });
  }

  /** "Tự điền": the author fills this step and the rest; no proposal arrives any more. */
  manual(
    sessionId: number,
    step: DraftingStepNumber,
  ): Observable<DraftingSession> {
    return this.client.call(draftingSessionEndpoints.manual, {
      params: { sessionId, step },
    });
  }

  /** "Dừng": the server stops the step it is working on; nothing happens when none is. */
  stop(): void {
    const session = this.session$();
    if (session && this.isProposing$()) this.stopMutation.run(session.id);
  }
}
