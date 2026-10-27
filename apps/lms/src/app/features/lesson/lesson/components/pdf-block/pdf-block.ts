import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Button, Icon, IconButton, Skeleton } from '@lms/ui';
import { PdfEngine, type PdfFile } from './pdf-engine';

/** The learner has to stay on a page this long before it counts as read. */
export const PDF_PAGE_DWELL_MS = 1000;

/** Zoom steps on top of fitting the page to the column. */
export const PDF_ZOOMS = [1, 1.25, 1.5, 2, 3] as const;

/** Width used when the column cannot be measured (before layout). */
const FALLBACK_WIDTH = 800;

/**
 * A `pdf` block: pdf.js draws one page at a time on a canvas. It reports the page shown after the
 * learner stays on it for a second; the store decides what to send.
 */
@Component({
  selector: 'app-pdf-block',
  imports: [Button, Icon, IconButton, Skeleton],
  templateUrl: './pdf-block.html',
  styleUrl: './pdf-block.scss',
})
export class PdfBlock {
  private readonly engine = inject(PdfEngine);

  readonly src = input.required<string>();
  /** The page the server remembers; the block opens there. */
  readonly startPage = input(1);
  readonly title = input('');

  readonly pageShown = output<number>();
  /** "Thử lại": the page claims the block again, which renews the media cookie. */
  readonly retry = output<void>();

  private readonly state = {
    file: signal<PdfFile | null>(null),
    failed: signal(false),
    page: signal(1),
    zoom: signal<number>(PDF_ZOOMS[0]),
  };

  protected readonly failed$ = this.state.failed.asReadonly();
  protected readonly page$ = this.state.page.asReadonly();
  protected readonly zoom$ = this.state.zoom.asReadonly();
  protected readonly pageCount$ = computed(
    () => this.state.file()?.pageCount ?? 0,
  );
  protected readonly loading$ = computed(
    () => this.state.file() === null && !this.state.failed(),
  );
  protected readonly canPrev$ = computed(() => this.state.page() > 1);
  protected readonly canNext$ = computed(
    () => this.state.page() < this.pageCount$(),
  );
  protected readonly canZoomOut$ = computed(
    () => this.state.zoom() > PDF_ZOOMS[0],
  );
  protected readonly canZoomIn$ = computed(
    () => this.state.zoom() < PDF_ZOOMS[PDF_ZOOMS.length - 1],
  );
  /** The block opened on a page the learner had reached before. */
  protected readonly resumedAt$ = computed(() => {
    const start = this.startPage();
    return this.state.file() && start > 1 ? this.clamp(start) : null;
  });

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly root = viewChild<ElementRef<HTMLElement>>('root');

  /** Opens the file when the URL is known, and lets it go when the block goes away. */
  private readonly open = effect((onCleanup) => {
    const url = this.src();
    let alive = true;
    let opened: PdfFile | null = null;
    untracked(() => {
      this.state.file.set(null);
      this.state.failed.set(false);
    });
    this.engine.open(url).then(
      (file) => {
        if (!alive) return file.destroy();
        opened = file;
        this.state.page.set(this.clamp(this.startPage(), file.pageCount));
        this.state.file.set(file);
      },
      () => {
        if (alive) this.state.failed.set(true);
      },
    );
    onCleanup(() => {
      alive = false;
      opened?.destroy();
    });
  });

  /** Draws the shown page; a newer page or zoom drops the one still being drawn. */
  private readonly draw = effect((onCleanup) => {
    const file = this.state.file();
    const page = this.state.page();
    const zoom = this.state.zoom();
    const canvas = this.canvas()?.nativeElement;
    if (!file || !canvas) return;
    // The column's width, less the stage's border; the stage itself is hidden while loading.
    const width = untracked(
      () => (this.root()?.nativeElement.clientWidth || FALLBACK_WIDTH) - 2,
    );
    const render = file.render(page, canvas, width, zoom);
    render.done.catch(() => {
      // A cancelled draw rejects; a real failure leaves the old page, which the learner can retry.
    });
    onCleanup(() => render.cancel());
  });

  /** A page counts as shown after the dwell time on it. */
  private readonly report = effect((onCleanup) => {
    const page = this.state.page();
    if (!this.state.file()) return;
    const timer = setTimeout(
      () => untracked(() => this.pageShown.emit(page)),
      PDF_PAGE_DWELL_MS,
    );
    onCleanup(() => clearTimeout(timer));
  });

  protected go(step: 1 | -1): void {
    this.state.page.update((page) => this.clamp(page + step));
  }

  protected zoom(step: 1 | -1): void {
    this.state.zoom.update((zoom) => {
      const index = PDF_ZOOMS.findIndex((z) => z === zoom) + step;
      return PDF_ZOOMS[Math.min(Math.max(index, 0), PDF_ZOOMS.length - 1)];
    });
  }

  protected retried(): void {
    this.retry.emit();
  }

  private clamp(page: number, count = this.pageCount$()): number {
    return Math.min(Math.max(Math.trunc(page) || 1, 1), Math.max(count, 1));
  }
}
