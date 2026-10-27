import { TestBed } from '@angular/core/testing';
import type { HashEvent } from './sha256-hasher';
import { Sha256Hasher } from './sha256-hasher';
import type { HashReply, HashRequest } from './sha256.worker';

class FakeWorker {
  static instances: FakeWorker[] = [];
  readonly posted: HashRequest[] = [];
  terminated = false;
  private listeners: ((event: MessageEvent<HashReply>) => void)[] = [];
  private failures: ((event: ErrorEvent) => void)[] = [];

  constructor(
    readonly url: URL,
    readonly options?: WorkerOptions,
  ) {
    FakeWorker.instances.push(this);
  }
  postMessage(request: HashRequest): void {
    this.posted.push(request);
  }
  addEventListener(type: string, listener: unknown): void {
    if (type === 'message') {
      this.listeners.push(listener as (event: MessageEvent<HashReply>) => void);
    } else {
      this.failures.push(listener as (event: ErrorEvent) => void);
    }
  }
  removeEventListener(type: string, listener: unknown): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
    this.failures = this.failures.filter((l) => l !== listener);
  }
  terminate(): void {
    this.terminated = true;
  }
  reply(data: HashReply): void {
    for (const listener of this.listeners) {
      listener({ data } as MessageEvent<HashReply>);
    }
  }
  fail(message: string): void {
    for (const listener of this.failures) {
      listener({ message } as ErrorEvent);
    }
  }
}

describe('Sha256Hasher', () => {
  let hasher: Sha256Hasher;
  const events: HashEvent[] = [];
  const outcome: { error?: Error; done?: boolean } = {};

  const run = (blob = new Blob(['abc'])) =>
    hasher.hash(blob).subscribe({
      next: (event) => events.push(event),
      error: (error: Error) => (outcome.error = error),
      complete: () => (outcome.done = true),
    });

  beforeEach(() => {
    events.length = 0;
    outcome.error = undefined;
    outcome.done = undefined;
    FakeWorker.instances = [];
    hasher = TestBed.inject(Sha256Hasher);
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('with a worker', () => {
    beforeEach(() => vi.stubGlobal('Worker', FakeWorker));

    it('hashes in a module worker and relays progress, then the digest', () => {
      const blob = new Blob(['abc']);
      run(blob);
      const worker = FakeWorker.instances[0];
      expect(worker.options).toEqual({ type: 'module' });
      expect(worker.url.pathname).toMatch(/sha256\.worker/);
      const { id } = worker.posted[0];
      expect(worker.posted[0]).toEqual({ id, blob });
      worker.reply({ id, type: 'progress', hashed: 3, total: 3 });
      worker.reply({ id, type: 'done', hex: 'ab'.repeat(32) });
      expect(events).toEqual([
        { type: 'progress', hashed: 3, total: 3 },
        { type: 'done', hex: 'ab'.repeat(32) },
      ]);
      expect(outcome.done).toBe(true);
    });

    it('ignores the answers meant for another request', () => {
      run();
      const worker = FakeWorker.instances[0];
      const { id } = worker.posted[0];
      worker.reply({ id: id + 1, type: 'done', hex: 'ff'.repeat(32) });
      expect(events).toEqual([]);
      expect(outcome.done).toBeUndefined();
    });

    it('errors with the name and message the worker reports', () => {
      run();
      const worker = FakeWorker.instances[0];
      const { id } = worker.posted[0];
      worker.reply({
        id,
        type: 'error',
        name: 'NotReadableError',
        message: 'x',
      });
      expect(outcome.error).toMatchObject({
        name: 'NotReadableError',
        message: 'x',
      });
    });

    it('errors when the worker itself fails', () => {
      run();
      FakeWorker.instances[0].fail('script failed to load');
      expect(outcome.error?.message).toMatch(/script failed to load/);
    });

    it('asks the worker to stop when the caller unsubscribes first', () => {
      const subscription = run();
      const worker = FakeWorker.instances[0];
      const { id } = worker.posted[0];
      subscription.unsubscribe();
      expect(worker.posted.at(-1)).toEqual({ id, cancel: true });
    });

    it('does not ask to stop an answer that already came', () => {
      const subscription = run();
      const worker = FakeWorker.instances[0];
      const { id } = worker.posted[0];
      worker.reply({ id, type: 'done', hex: 'ab'.repeat(32) });
      subscription.unsubscribe();
      expect(worker.posted).toHaveLength(1);
    });

    it('shares one worker between requests and ends it once none is running', () => {
      const first = run();
      const second = run();
      expect(FakeWorker.instances).toHaveLength(1);
      const worker = FakeWorker.instances[0];
      first.unsubscribe();
      expect(worker.terminated).toBe(false);
      second.unsubscribe();
      expect(worker.terminated).toBe(true);
      run();
      expect(FakeWorker.instances).toHaveLength(2);
    });
  });

  describe('without a worker', () => {
    // jsdom has neither `Worker` nor `Blob.arrayBuffer()`; a browser has both.
    beforeEach(() => {
      vi.stubGlobal('Worker', undefined);
      Blob.prototype.arrayBuffer = function (this: Blob) {
        return new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(this);
        });
      };
    });
    afterEach(() => {
      delete (Blob.prototype as { arrayBuffer?: unknown }).arrayBuffer;
    });

    it('hashes on the page and gives the same events', async () => {
      run(new Blob(['abc']));
      await vi.waitFor(() => expect(outcome.done).toBe(true));
      expect(events).toEqual([
        { type: 'progress', hashed: 3, total: 3 },
        {
          type: 'done',
          hex: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        },
      ]);
    });
  });
});
