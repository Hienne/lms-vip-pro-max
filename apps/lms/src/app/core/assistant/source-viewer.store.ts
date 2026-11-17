import { computed, inject, Injectable, signal } from '@angular/core';
import {
  type Citation,
  type DocumentText,
  knowledgeEndpoints,
} from '@lms/contracts';
import { toAppError } from '../errors/app-error';
import { EndpointClient } from '../http/endpoint-client';

/** Chunks read on each side of the cited one when a source is opened. */
export const FIRST_SPAN = 2;
/** What "Xem thêm" adds to the span. */
export const MORE_SPAN = 3;
/** The server's own limit. */
const MAX_SPAN = 20;

export type SourceViewerStatus =
  | 'closed'
  | 'loading'
  | 'ready'
  | 'gone'
  | 'failed';

/**
 * The source viewer: which cited document is open, and the extracted text around the cited
 * passage. The server owns the text and who may read it; "gone" means it answered not-found, which
 * is what a deleted document and one the user cannot search look like. Shared by the quick chat and
 * the `/assistant` page, which only call `open`.
 */
@Injectable({ providedIn: 'root' })
export class SourceViewerStore {
  private readonly client = inject(EndpointClient);

  private readonly state = {
    citation: signal<Citation | null>(null),
    status: signal<SourceViewerStatus>('closed'),
    text: signal<DocumentText | null>(null),
    span: signal(FIRST_SPAN),
    loadingMore: signal(false),
    /** A page shows the source in a pane of its own, so the shell's drawer stays shut. */
    docked: signal(false),
  };
  /** Bumped by every request so an answer for an earlier one is dropped. */
  private ticket = 0;

  readonly citation$ = this.state.citation.asReadonly();
  readonly status$ = this.state.status.asReadonly();
  readonly text$ = this.state.text.asReadonly();
  readonly loadingMore$ = this.state.loadingMore.asReadonly();
  readonly docked$ = this.state.docked.asReadonly();

  /** The chunk to highlight: the one the server centred the text on. */
  readonly citedChunkId$ = computed(
    () => this.state.text()?.aroundChunkId ?? null,
  );

  /** Opens `citation`'s document around its chunk. */
  open(citation: Citation): void {
    this.state.citation.set(citation);
    this.state.text.set(null);
    this.state.span.set(FIRST_SPAN);
    this.load(false);
  }

  /** Reads more neighbours on both sides; the text on screen stays until the wider one arrives. */
  more(): void {
    if (this.state.status() !== 'ready' || this.state.loadingMore()) return;
    this.state.span.update((span) => Math.min(span + MORE_SPAN, MAX_SPAN));
    this.load(true);
  }

  retry(): void {
    if (this.state.citation()) this.load(false);
  }

  /** Set by a page that frames the source itself; cleared when it leaves. */
  setDocked(docked: boolean): void {
    this.state.docked.set(docked);
  }

  close(): void {
    this.ticket++;
    this.state.citation.set(null);
    this.state.text.set(null);
    this.state.loadingMore.set(false);
    this.state.status.set('closed');
  }

  private load(keepText: boolean): void {
    const citation = this.state.citation();
    if (!citation) return;
    const ticket = ++this.ticket;
    if (keepText) this.state.loadingMore.set(true);
    else this.state.status.set('loading');
    this.client
      .call(knowledgeEndpoints.documentText, {
        params: { documentId: citation.documentId },
        query: {
          ...(citation.chunkId === undefined
            ? {}
            : { around: citation.chunkId }),
          span: this.state.span(),
        },
      })
      .subscribe({
        next: (text) => {
          if (ticket !== this.ticket) return;
          this.state.text.set(text);
          this.state.loadingMore.set(false);
          this.state.status.set('ready');
        },
        error: (error: unknown) => {
          if (ticket !== this.ticket) return;
          this.state.loadingMore.set(false);
          // A wider read that failed leaves the text already read in place.
          if (keepText) return;
          const failure = toAppError(error);
          this.state.status.set(
            failure.messageCode === 'CORE-RESOURCE_NOT_FOUND' ||
              failure.httpStatus === 404
              ? 'gone'
              : 'failed',
          );
        },
      });
  }
}
