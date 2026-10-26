import { Injectable } from '@angular/core';

/** One page being drawn; `cancel` is for a page change or a zoom that makes it stale. */
export interface PdfRender {
  readonly done: Promise<void>;
  cancel(): void;
}

export interface PdfFile {
  readonly pageCount: number;
  /** Draws `page` (1-based) so it is `width` CSS pixels wide before `zoom`. */
  render(
    page: number,
    canvas: HTMLCanvasElement,
    width: number,
    zoom: number,
  ): PdfRender;
  destroy(): void;
}

/** The worker is copied next to the app as an asset (`apps/lms/project.json`). */
const WORKER = 'pdfjs/pdf.worker.min.mjs';

/**
 * The only place that knows pdf.js. The library is imported on first use, so it stays out of the
 * main bundle, and a spec replaces this class because jsdom has no canvas.
 */
@Injectable({ providedIn: 'root' })
export class PdfEngine {
  async open(url: string): Promise<PdfFile> {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      WORKER,
      document.baseURI,
    ).href;
    // The content endpoint authorises by the `academy_media` cookie.
    const loading = pdfjs.getDocument({ url, withCredentials: true });
    const doc = await loading.promise;
    return {
      pageCount: doc.numPages,
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
          const ratio = window.devicePixelRatio || 1;
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
