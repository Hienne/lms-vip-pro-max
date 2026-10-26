import {
  computed,
  effect,
  inject,
  Injectable,
  linkedSignal,
} from '@angular/core';
import {
  type DocumentListQuery,
  knowledgeEndpoints,
  type KnowledgeDocument,
} from '@lms/contracts';
import { catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { invalidation, type ChangeToken } from '../data-access/invalidation';
import { serverData } from '../data-access/server-data';
import { EndpointClient } from '../http/endpoint-client';
import { NetworkStore } from '../network/network.store';
import { SessionStore } from '../session/session.store';

/** How often the signed-in user's unfinished uploads are asked about. */
export const POLL_INTERVAL_MS = 3000;
/** How long the "finished" notice of a document that became `ready` stays up. */
export const READY_NOTICE_MS = 6000;

const PENDING_QUERY: DocumentListQuery = {
  mine: true,
  status: ['queued', 'processing'],
  size: 100,
};

/** A document that stopped being processed, and when the app noticed. */
export interface FinishedDocument {
  readonly document: KnowledgeDocument;
  readonly at: number;
}

export type OwlState = 'idle' | 'processing' | 'done' | 'failed';

const isUnfinished = (document: KnowledgeDocument): boolean =>
  document.status === 'queued' || document.status === 'processing';

/**
 * While the signed-in user has uploads that are `queued` or `processing`, asks the server about
 * them every few seconds on every page, and announces each one that finishes (`ready` or
 * `failed`). The owl and the document list read it. The server owns the status; this store only
 * remembers which documents it is waiting for. It starts working when something first injects it.
 * Everything resets when the user changes or signs out.
 */
@Injectable({ providedIn: 'root' })
export class DocumentTrackerStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly network = inject(NetworkStore);

  private readonly userId = computed(() => this.session.user$()?.userId);

  // Both follow the user: a sign-out or another sign-in starts from nothing.
  private readonly state = {
    pending: linkedSignal<string | undefined, readonly KnowledgeDocument[]>({
      source: this.userId,
      computation: () => [],
    }),
    lastFinished: linkedSignal<string | undefined, FinishedDocument | null>({
      source: this.userId,
      computation: () => null,
    }),
  };

  private readonly polls = invalidation();
  private readonly finishedChanges = invalidation();

  // The first load seeds `pending` after a sign-in or a reload; the timer below reloads it.
  // A failed poll is not shown (the owl is not an error surface) and the next tick tries again.
  private readonly pollData = serverData(() => this.poll(), {
    params: () => this.userId(),
    reloadOn: this.polls,
  });

  readonly pending$ = this.state.pending.asReadonly();
  readonly lastFinished$ = this.state.lastFinished.asReadonly();
  readonly owlState$ = computed<OwlState>(() => {
    if (this.pending$().length > 0) return 'processing';
    const finished = this.lastFinished$();
    if (!finished) return 'idle';
    return finished.document.status === 'ready' ? 'done' : 'failed';
  });
  /** Bumps when any tracked document finishes; the document list reloads on it. */
  readonly finished: ChangeToken = this.finishedChanges;
  readonly pollError$ = this.pollData.error;

  private readonly shouldPoll = computed(
    () =>
      this.pending$().length > 0 &&
      !this.network.offline$() &&
      this.userId() !== undefined,
  );

  private readonly pollTimer = effect((onCleanup) => {
    if (!this.shouldPoll()) return;
    const timer = setInterval(() => this.polls.bump(), POLL_INTERVAL_MS);
    onCleanup(() => clearInterval(timer));
  });

  private readonly noticeTimer = effect((onCleanup) => {
    if (this.lastFinished$()?.document.status !== 'ready') return;
    const timer = setTimeout(() => this.dismiss(), READY_NOTICE_MS);
    onCleanup(() => clearTimeout(timer));
  });

  setPending(documents: readonly KnowledgeDocument[]): void {
    this.state.pending.set(documents);
  }

  setLastFinished(finished: FinishedDocument | null): void {
    this.state.lastFinished.set(finished);
  }

  /** Starts waiting for a document that was just uploaded. */
  track(document: KnowledgeDocument): void {
    if (!isUnfinished(document)) return;
    this.setPending([
      document,
      ...this.pending$().filter((d) => d.id !== document.id),
    ]);
  }

  /** Clears the notice of the last finished document. */
  dismiss(): void {
    this.setLastFinished(null);
  }

  /**
   * One poll: the user's unfinished documents, then one lookup for each document that was pending
   * and is no longer listed, to learn how it ended. A lookup that fails leaves the document
   * pending for the next poll.
   */
  private poll() {
    // What the server can know about: a document tracked after this call started may not be
    // listed yet, and is not "gone".
    const waitingFor = this.pending$();
    return this.client
      .call(knowledgeEndpoints.documents, { query: PENDING_QUERY })
      .pipe(
        switchMap((page) => {
          const listed = new Set(page.items.map((d) => d.id));
          const gone = waitingFor.filter((d) => !listed.has(d.id));
          const lookups = gone.map((d) =>
            this.client
              .call(knowledgeEndpoints.document, {
                params: { documentId: d.id },
              })
              .pipe(catchError(() => of(null))),
          );
          return (lookups.length > 0 ? forkJoin(lookups) : of([])).pipe(
            map((found) => ({
              listed: page.items,
              looked: new Map(gone.map((d, i) => [d.id, found[i]])),
            })),
          );
        }),
        tap(({ listed, looked }) => this.apply(listed, looked)),
        map(() => undefined),
      );
  }

  /** Merges a poll into what is pending; a document tracked while it ran is kept. */
  private apply(
    listed: readonly KnowledgeDocument[],
    looked: ReadonlyMap<number, KnowledgeDocument | null>,
  ): void {
    const listedIds = new Set(listed.map((d) => d.id));
    const kept: KnowledgeDocument[] = [];
    const finished: KnowledgeDocument[] = [];
    for (const document of this.pending$()) {
      if (listedIds.has(document.id)) continue;
      if (!looked.has(document.id)) {
        kept.push(document);
        continue;
      }
      const latest = looked.get(document.id);
      if (!latest) kept.push(document);
      else if (isUnfinished(latest)) kept.push(latest);
      else finished.push(latest);
    }
    this.setPending([...listed, ...kept]);
    const last = finished.at(-1);
    if (last) {
      this.setLastFinished({ document: last, at: Date.now() });
      this.finishedChanges.bump();
    }
  }
}
