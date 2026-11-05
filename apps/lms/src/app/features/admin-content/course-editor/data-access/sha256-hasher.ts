import { Service } from '@angular/core';
import { Observable } from 'rxjs';
import { sha256Digest } from './sha256';
import type { HashReply, HashRequest } from './sha256.worker';

/** What hashing a file or a part reports: progress while it reads, then the digest. */
export type HashEvent =
  | {
      readonly type: 'progress';
      readonly hashed: number;
      readonly total: number;
    }
  | {
      readonly type: 'done';
      readonly hex: string;
      /** The SHA-256 of each `SLICE_BYTES` slice, in order. */
      readonly sliceHashes: readonly string[];
    };

/** What the upload flow needs of a hasher, so a spec can swap it. */
export interface Hasher {
  /** Emits progress, then `done` with the lower-case hex SHA-256 and each slice's; unsubscribing stops it. */
  hash(blob: Blob): Observable<HashEvent>;
}

/**
 * Hashes files and parts in a Web Worker so a large video never blocks the page. One worker serves
 * every request that runs at the same time and ends when none is left. Where there is no `Worker`
 * (a spec, an old browser) the same hash runs on the page.
 */
@Service()
export class Sha256Hasher implements Hasher {
  private worker: Worker | undefined;
  private nextId = 1;
  private active = 0;

  hash(blob: Blob): Observable<HashEvent> {
    return new Observable<HashEvent>((subscriber) => {
      if (typeof Worker === 'undefined') {
        const controller = new AbortController();
        sha256Digest(blob, {
          signal: controller.signal,
          onProgress: (hashed, total) =>
            subscriber.next({ type: 'progress', hashed, total }),
        }).then(
          ({ hex, sliceHashes }) => {
            subscriber.next({ type: 'done', hex, sliceHashes });
            subscriber.complete();
          },
          (error: unknown) => subscriber.error(error),
        );
        return () => controller.abort();
      }

      const id = this.nextId++;
      const worker = this.acquire();
      let finished = false;
      const onMessage = (event: MessageEvent<HashReply>) => {
        const reply = event.data;
        if (reply.id !== id) return;
        if (reply.type === 'progress') {
          subscriber.next({
            type: 'progress',
            hashed: reply.hashed,
            total: reply.total,
          });
          return;
        }
        finished = true;
        if (reply.type === 'done') {
          subscriber.next({
            type: 'done',
            hex: reply.hex,
            sliceHashes: reply.sliceHashes,
          });
          subscriber.complete();
        } else {
          subscriber.error(
            Object.assign(new Error(reply.message), { name: reply.name }),
          );
        }
      };
      const onFailure = (event: ErrorEvent) => {
        finished = true;
        subscriber.error(new Error(event.message || 'The hash worker failed.'));
      };
      worker.addEventListener('message', onMessage as EventListener);
      worker.addEventListener('error', onFailure as EventListener);
      worker.postMessage({ id, blob } satisfies HashRequest);
      return () => {
        worker.removeEventListener('message', onMessage as EventListener);
        worker.removeEventListener('error', onFailure as EventListener);
        if (!finished) {
          worker.postMessage({ id, cancel: true } satisfies HashRequest);
        }
        this.release();
      };
    });
  }

  private acquire(): Worker {
    this.active += 1;
    this.worker ??= new Worker(new URL('./sha256.worker', import.meta.url), {
      type: 'module',
    });
    return this.worker;
  }

  private release(): void {
    this.active -= 1;
    if (this.active === 0) {
      this.worker?.terminate();
      this.worker = undefined;
    }
  }
}
