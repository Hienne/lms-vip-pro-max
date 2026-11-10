import { Injectable } from '@angular/core';

/** One page being drawn; `cancel` is for a page change or a zoom that makes it stale. */
export interface PdfRender {
  readonly done: Promise<void>;
  cancel(): void;
}

export interface PdfFile {
  readonly pageCount: number;
  /** Height divided by width for each page, in document order. */
  readonly pageRatios: readonly number[];
  /** Draws `page` (1-based) so it is `width` CSS pixels wide before `zoom`. */
  render(
    page: number,
    canvas: HTMLCanvasElement,
    width: number,
    zoom: number,
  ): PdfRender;
  destroy(): void;
}

/**
 * One worker for every document, started on first use. pdf.js never terminates a port it was given.
 * `pdf.worker.ts` is bundled as a `.js` chunk, so the server's type for `.mjs` does not matter.
 */
let worker: Worker | undefined;

/**
 * The only place that knows pdf.js. The library is imported on first use, so it stays out of the
 * main bundle, and a spec replaces this class because jsdom has no canvas.
 */
@Injectable({ providedIn: 'root' })
export class PdfEngine {
  async open(url: string): Promise<PdfFile> {
    const pdfjs = await import('pdfjs-dist');
    worker ??= new Worker(new URL('./pdf.worker', import.meta.url), {
      type: 'module',
    });
    pdfjs.GlobalWorkerOptions.workerPort = worker;
    // The content endpoint authorises by the `academy_media` cookie.
    const loading = pdfjs.getDocument({ url, withCredentials: true });
    const doc = await loading.promise.catch(async (error: unknown) => {
      await loading.destroy();
      throw error;
    });
    const pageRatios: number[] = [];
    try {
      // Read dimensions without rasterizing, so mixed page sizes don't shift during a scroll.
      for (let first = 1; first <= doc.numPages; first += 12) {
        const batch = Array.from(
          { length: Math.min(12, doc.numPages - first + 1) },
          (_, index) => doc.getPage(first + index),
        );
        for (const page of await Promise.all(batch)) {
          const { height, width } = page.getViewport({ scale: 1 });
          pageRatios.push(height / width);
        }
      }
    } catch (error) {
      await loading.destroy();
      throw error;
    }
    return {
      pageCount: doc.numPages,
      pageRatios,
      render: (number, canvas, width, zoom) => {
        let cancelled = false;
        let task: ReturnType<
          Awaited<ReturnType<typeof doc.getPage>>['render']
        > | null = null;
        const done = doc.getPage(number).then(async (page) => {
          if (cancelled) return;
          const natural = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({
            scale: (width / natural.width) * zoom,
          });
          const ratio = Math.min(
            window.devicePixelRatio || 1,
            Math.sqrt(8_000_000 / (viewport.width * viewport.height)),
          );
          canvas.width = Math.floor(viewport.width * ratio);
          canvas.height = Math.floor(viewport.height * ratio);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          task = page.render({
            canvas,
            viewport,
            transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
          });
          await task.promise;
        });
        return {
          done,
          cancel: () => {
            cancelled = true;
            task?.cancel();
          },
        };
      },
      destroy: () => void loading.destroy(),
    };
  }
}
