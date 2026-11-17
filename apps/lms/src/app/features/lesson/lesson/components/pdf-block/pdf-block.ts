import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  afterRenderEffect,
  Component,
  computed,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { Button, Icon, IconButton, Skeleton } from '@lms/ui';
import { PdfEngine, type PdfFile, type PdfRender } from './pdf-engine';

/** The learner has to stay on a page this long before it counts as read. */
export const PDF_PAGE_DWELL_MS = 1000;

/** Zoom steps on top of fitting the page to the column. */
export const PDF_ZOOMS = [1, 1.25, 1.5, 2, 3] as const;

/** A request to show a page: `seq` tells two requests for the same page apart. */
export interface BlockJump {
  readonly value: number;
  readonly seq: number;
}

const MAX_PAGE_WIDTH = 960;
const PAGE_OVERSCAN = 1;

interface PageDraw {
  readonly canvas: HTMLCanvasElement;
  readonly render: PdfRender;
}

/**
 * A continuous reader with canvases for the pages near the viewport. It tells where the learner is
 * (`pageChange`, at once) and reports the page shown after a second on it (`pageShown`); it shows
 * the page a `jump` asks for and reports the bookmark button. The store decides what to do.
 */
@Component({
  selector: 'app-pdf-block',
  imports: [Button, CdkTrapFocus, Icon, IconButton, Skeleton],
  templateUrl: './pdf-block.html',
  styleUrl: './pdf-block.scss',
  host: { '(document:fullscreenchange)': 'fullscreenChanged()' },
})
export class PdfBlock {
  private readonly engine = inject(PdfEngine);
  private readonly document = inject(DOCUMENT);

  readonly src = input.required<string>();
  /** The page the server remembers; the block opens there. */
  readonly startPage = input(1);
  readonly title = input('');
  /** Shows this page now; a new object is a new request, even for the same page. */
  readonly jump = input<BlockJump | null>(null);
  /** The current page is bookmarked. */
  readonly bookmarked = input(false);
  /** A bookmark change is in flight, so the button waits. */
  readonly busy = input(false);

  /** Every page the block shows, as it is shown. */
  readonly pageChange = output<number>();
  readonly pageShown = output<number>();
  /** "Đánh dấu trang này": the page to turn on or off. */
  readonly bookmark = output<number>();
  /** "Thử lại": the page claims the block again, which renews the media cookie. */
  readonly retry = output<void>();

  private readonly state = {
    file: signal<PdfFile | null>(null),
    failed: signal(false),
    page: signal(1),
    zoom: signal<number>(PDF_ZOOMS[0]),
    /** The page the block reopened on, when it opened there rather than at a jump. */
    resumed: signal<number | null>(null),
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
  private readonly nativeFullscreen = signal(false);
  protected readonly expanded = signal(false);
  protected readonly fullscreen = computed(
    () => this.nativeFullscreen() || this.expanded(),
  );
  protected readonly pageRatios = computed(
    () => this.state.file()?.pageRatios ?? [],
  );
  private readonly width = signal(MAX_PAGE_WIDTH);
  protected readonly pageWidth = computed(() => this.width() * this.zoom$());
  protected readonly visiblePages = signal({ first: 1, last: 1 });
  protected readonly canZoomOut$ = computed(
    () => this.state.zoom() > PDF_ZOOMS[0],
  );
  protected readonly canZoomIn$ = computed(
    () => this.state.zoom() < PDF_ZOOMS[PDF_ZOOMS.length - 1],
  );
  /** The block reopened on a page the learner had reached before; a block opened at a jump says nothing. */
  protected readonly resumedAt$ = this.state.resumed.asReadonly();

  private readonly root = viewChild<ElementRef<HTMLElement>>('root');
  private readonly fullscreenButton =
    viewChild<ElementRef<HTMLButtonElement>>('fullscreenButton');
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly pages = viewChildren<ElementRef<HTMLElement>>('sheet');
  private readonly canvases =
    viewChildren<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly rendered = signal<ReadonlySet<number>>(new Set());
  private readonly readingPageReady = computed(() =>
    this.rendered().has(this.state.page()),
  );
  private readonly scrollTarget = signal<{
    page: number;
    offset: number;
  } | null>(null);
  private readonly draws = new Map<number, PageDraw>();
  private drawFile: PdfFile | null = null;
  private drawWidth = 0;
  private jumpDone: BlockJump | null = null;
  private restoredTop: number | null = null;

  /** Opens the file when the URL is known, and lets it go when the block goes away. */
  private readonly open = effect((onCleanup) => {
    const url = this.src();
    let alive = true;
    let opened: PdfFile | null = null;
    untracked(() => {
      this.state.file.set(null);
      this.state.failed.set(false);
      this.state.resumed.set(null);
      this.jumpDone = null;
    });
    this.engine.open(url).then(
      (file) => {
        if (!alive) return file.destroy();
        opened = file;
        const jump = untracked(this.jump);
        const start = untracked(this.startPage);
        this.jumpDone = jump;
        this.state.file.set(file);
        this.moveTo(this.clamp(jump ? jump.value : start, file.pageCount));
        this.state.resumed.set(
          !jump && start > 1 ? this.clamp(start, file.pageCount) : null,
        );
      },
      () => {
        if (alive) this.state.failed.set(true);
      },
    );
    onCleanup(() => {
      alive = false;
      this.clearDraws();
      opened?.destroy();
    });
  });

  /** Keep the reading position when zoom or fullscreen changes the page dimensions. */
  private readonly measure = afterRenderEffect((onCleanup) => {
    const stage = this.stage()?.nativeElement;
    if (!stage) return;
    const resize = () => {
      const width = stage.clientWidth;
      if (width > 0 && width !== this.width()) {
        if (!this.scrollTarget())
          this.moveTo(this.page$(), this.pageOffset(stage));
        this.width.set(width);
      } else if (!this.scrollTarget()) {
        this.updateVisiblePages(stage);
      }
    };
    untracked(resize);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    onCleanup(() => observer.disconnect());
  });

  private readonly restoreScroll = afterRenderEffect(() => {
    const target = this.scrollTarget();
    const stage = this.stage()?.nativeElement;
    if (!target || !stage) return;
    const page = untracked(() => this.pages()[target.page - 1]?.nativeElement);
    if (!page) return;
    stage.scrollTop = page.offsetTop + page.offsetHeight * target.offset;
    this.restoredTop = stage.scrollTop;
    this.scrollTarget.set(null);
    untracked(() => this.updateVisiblePages(stage));
  });

  private readonly draw = afterRenderEffect(() => {
    const file = this.state.file();
    const width = this.pageWidth();
    const canvases = this.canvases();
    if (!file) return;
    untracked(() => this.drawPages(file, width, canvases));
  });

  /** A jump moves to its page once the file is open; an earlier one is taken when it opens. */
  private readonly follow = effect(() => {
    const jump = this.jump();
    if (jump && jump !== this.jumpDone && untracked(this.state.file)) {
      this.jumpDone = jump;
      untracked(() => this.moveTo(this.clamp(jump.value)));
    }
  });

  /** The page is told as soon as it is shown. */
  private readonly track = effect(() => {
    const page = this.state.page();
    if (this.state.file()) untracked(() => this.pageChange.emit(page));
  });

  /** A page counts as shown after the dwell time on it. */
  private readonly report = effect((onCleanup) => {
    const page = this.state.page();
    if (!this.readingPageReady()) return;
    const timer = setTimeout(
      () => untracked(() => this.pageShown.emit(page)),
      PDF_PAGE_DWELL_MS,
    );
    onCleanup(() => clearTimeout(timer));
  });

  protected scrolled(): void {
    const stage = this.stage()?.nativeElement;
    if (!stage || this.scrollTarget()) return;
    const moved = stage.scrollTop !== this.restoredTop;
    this.restoredTop = null;
    this.updateVisiblePages(stage, moved);
  }

  protected async toggleFullscreen(): Promise<void> {
    const root = this.root()?.nativeElement;
    if (!root) return;
    if (this.expanded()) {
      this.closeExpanded();
      return;
    }
    if (this.document.fullscreenElement === root) {
      await this.document.exitFullscreen();
      return;
    }
    try {
      await root.requestFullscreen();
    } catch {
      // Embedded browsers and some mobile browsers disallow element fullscreen.
      this.expanded.set(true);
    }
    this.stage()?.nativeElement.focus({ preventScroll: true });
  }

  protected fullscreenChanged(): void {
    const active =
      this.document.fullscreenElement === this.root()?.nativeElement;
    if (this.nativeFullscreen() && !active) this.focusFullscreenButton();
    this.nativeFullscreen.set(active);
  }

  protected closeExpanded(): void {
    if (!this.expanded()) return;
    this.expanded.set(false);
    this.focusFullscreenButton();
  }

  private focusFullscreenButton(): void {
    this.fullscreenButton()?.nativeElement.focus({ preventScroll: true });
  }

  protected zoom(step: 1 | -1): void {
    const stage = this.stage()?.nativeElement;
    this.moveTo(this.page$(), stage ? this.pageOffset(stage) : 0);
    this.state.zoom.update((zoom) => {
      const index = PDF_ZOOMS.findIndex((z) => z === zoom) + step;
      return PDF_ZOOMS[Math.min(Math.max(index, 0), PDF_ZOOMS.length - 1)];
    });
  }

  protected bookmarkPage(): void {
    this.bookmark.emit(this.state.page());
  }

  protected turnPage(direction: -1 | 1): void {
    if (this.loading$() || this.failed$()) return;
    this.moveTo(this.clamp(this.page$() + direction));
  }

  protected retried(): void {
    this.retry.emit();
  }

  private moveTo(page: number, offset = 0): void {
    this.state.page.set(page);
    this.scrollTarget.set({ page, offset });
    this.setVisiblePages(page, page);
  }

  private pageOffset(stage: HTMLElement): number {
    const page = this.pages()[this.page$() - 1]?.nativeElement;
    return page?.offsetHeight
      ? Math.min(
          1,
          Math.max(0, (stage.scrollTop - page.offsetTop) / page.offsetHeight),
        )
      : 0;
  }

  private updateVisiblePages(stage: HTMLElement, trackPage = false): void {
    if (!stage.clientHeight || !this.pages().length) return;
    const top = stage.scrollTop;
    const bottom = top + stage.clientHeight;
    this.setVisiblePages(this.pageAt(top), this.pageAt(bottom));
    if (trackPage) {
      // At the bottom, a short last page may never reach the reading line.
      const atEnd = top > 0 && bottom >= stage.scrollHeight - 1;
      const readingLine = top + Math.min(stage.clientHeight / 3, 120);
      this.state.page.set(atEnd ? this.pageCount$() : this.pageAt(readingLine));
    }
  }

  private pageAt(offset: number): number {
    const pages = this.pages();
    let first = 0;
    let last = pages.length - 1;
    while (first < last) {
      const middle = Math.floor((first + last) / 2);
      const page = pages[middle].nativeElement;
      if (offset < page.offsetTop + page.offsetHeight) last = middle;
      else first = middle + 1;
    }
    return first + 1;
  }

  private setVisiblePages(first: number, last: number): void {
    const range = {
      first: this.clamp(first - PAGE_OVERSCAN),
      last: this.clamp(last + PAGE_OVERSCAN),
    };
    const previous = this.visiblePages();
    if (range.first !== previous.first || range.last !== previous.last) {
      this.visiblePages.set(range);
    }
  }

  private drawPages(
    file: PdfFile,
    width: number,
    refs: readonly ElementRef<HTMLCanvasElement>[],
  ): void {
    if (this.drawFile !== file || this.drawWidth !== width) this.clearDraws();
    this.drawFile = file;
    this.drawWidth = width;
    const canvases = new Map(
      refs.map(
        ({ nativeElement }) =>
          [Number(nativeElement.dataset['page']), nativeElement] as const,
      ),
    );
    for (const [page, draw] of this.draws) {
      if (canvases.get(page) === draw.canvas) continue;
      draw.render.cancel();
      this.draws.delete(page);
      this.rendered.update(
        (pages) => new Set([...pages].filter((id) => id !== page)),
      );
    }
    for (const [page, canvas] of canvases) {
      if (this.draws.has(page)) continue;
      const render = file.render(page, canvas, width, 1);
      const draw = { canvas, render };
      this.draws.set(page, draw);
      void render.done.then(
        () => {
          if (this.draws.get(page) === draw) {
            this.rendered.update((pages) => new Set(pages).add(page));
          }
        },
        () => {
          if (this.draws.get(page) === draw) this.state.failed.set(true);
        },
      );
    }
  }

  private clearDraws(): void {
    for (const { render } of this.draws.values()) render.cancel();
    this.draws.clear();
    this.rendered.set(new Set());
  }

  private clamp(page: number, count = this.pageCount$()): number {
    return Math.min(Math.max(Math.trunc(page) || 1, 1), Math.max(count, 1));
  }
}
