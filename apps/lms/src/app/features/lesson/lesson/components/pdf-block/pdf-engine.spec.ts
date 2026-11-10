import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfEngine } from './pdf-engine';

const pdfjs = vi.hoisted(() => ({
  GlobalWorkerOptions: { workerPort: null as unknown, workerSrc: '' },
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 3,
      getPage: (page: number) =>
        Promise.resolve({
          getViewport: () => ({ width: 200, height: page * 100 }),
        }),
    }),
    destroy: vi.fn(),
  })),
}));
vi.mock('pdfjs-dist', () => pdfjs);

class FakeWorker {
  static instances: FakeWorker[] = [];
  constructor(
    readonly url: URL,
    readonly options?: WorkerOptions,
  ) {
    FakeWorker.instances.push(this);
  }
}

describe('PdfEngine', () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    pdfjs.GlobalWorkerOptions.workerPort = null;
    vi.stubGlobal('Worker', FakeWorker);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts one bundled module worker and reuses it for every document', async () => {
    const engine = TestBed.inject(PdfEngine);
    const first = await engine.open('/a.pdf');
    const second = await engine.open('/b.pdf');

    expect(first.pageCount).toBe(3);
    expect(first.pageRatios).toEqual([0.5, 1, 1.5]);
    expect(second.pageCount).toBe(3);
    expect(FakeWorker.instances).toHaveLength(1);
    expect(FakeWorker.instances[0].options).toEqual({ type: 'module' });
    expect(pdfjs.GlobalWorkerOptions.workerPort).toBe(FakeWorker.instances[0]);
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toBe('');
  });
});
