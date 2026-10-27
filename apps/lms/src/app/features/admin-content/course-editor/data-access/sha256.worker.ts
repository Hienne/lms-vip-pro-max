/// <reference lib="webworker" />
import { sha256Blob } from './sha256';

/** What the page asks of the worker: hash a file or part, or stop hashing it. */
export type HashRequest =
  | { readonly id: number; readonly blob: Blob; readonly sliceBytes?: number }
  | { readonly id: number; readonly cancel: true };

/** What the worker answers, by request id. */
export type HashReply =
  | {
      readonly id: number;
      readonly type: 'progress';
      readonly hashed: number;
      readonly total: number;
    }
  | { readonly id: number; readonly type: 'done'; readonly hex: string }
  | {
      readonly id: number;
      readonly type: 'error';
      readonly name: string;
      readonly message: string;
    };

const running = new Map<number, AbortController>();

addEventListener('message', (event: MessageEvent<HashRequest>) => {
  const request = event.data;
  if ('cancel' in request) {
    running.get(request.id)?.abort();
    return;
  }
  const { id, blob, sliceBytes } = request;
  const controller = new AbortController();
  running.set(id, controller);
  sha256Blob(blob, {
    sliceBytes,
    signal: controller.signal,
    onProgress: (hashed, total) =>
      postMessage({
        id,
        type: 'progress',
        hashed,
        total,
      } satisfies HashReply),
  })
    .then((hex) => postMessage({ id, type: 'done', hex } satisfies HashReply))
    .catch((error: unknown) =>
      postMessage({
        id,
        type: 'error',
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : String(error),
      } satisfies HashReply),
    )
    .finally(() => running.delete(id));
});
