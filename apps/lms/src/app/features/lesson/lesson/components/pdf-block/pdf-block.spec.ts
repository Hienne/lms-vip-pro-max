import { TestBed } from '@angular/core/testing';
import { PDF_PAGE_DWELL_MS, PdfBlock } from './pdf-block';
import { PdfEngine, type PdfFile, type PdfRender } from './pdf-engine';

interface Drawn {
  readonly page: number;
  readonly width: number;
  cancelled: boolean;
}

class FakeEngine {
  opened: string[] = [];
  drawn: Drawn[] = [];
  destroyed = 0;
  fail = false;
  pages = 5;

  open(url: string): Promise<PdfFile> {
    this.opened.push(url);
    if (this.fail) return Promise.reject(new Error('network'));
    return Promise.resolve({
      pageCount: this.pages,
      pageRatios: Array.from({ length: this.pages }, () => 1.5),
      render: (page, _canvas, width): PdfRender => {
        const drawn: Drawn = { page, width, cancelled: false };
        this.drawn.push(drawn);
        return {
          done: Promise.resolve(),
          cancel: () => (drawn.cancelled = true),
        };
      },
      destroy: () => {
        this.destroyed += 1;
      },
    });
  }
}

async function flush(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await Promise.resolve();
    TestBed.tick();
  }
}

describe('PdfBlock', () => {
  let engine: FakeEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = new FakeEngine();
    TestBed.configureTestingModule({
      providers: [{ provide: PdfEngine, useValue: engine }],
    });
  });
  afterEach(() => vi.useRealTimers());

  async function render(startPage = 1) {
    const fixture = TestBed.createComponent(PdfBlock);
    fixture.componentRef.setInput('src', '/api/v1/learning-assets/9/content');
    fixture.componentRef.setInput('startPage', startPage);
    fixture.componentRef.setInput('title', 'Quy trình đối soát');
    const shown: number[] = [];
    const changes: number[] = [];
    const bookmarks: number[] = [];
    let retries = 0;
    fixture.componentInstance.pageShown.subscribe((p) => shown.push(p));
    fixture.componentInstance.pageChange.subscribe((p) => changes.push(p));
    fixture.componentInstance.bookmark.subscribe((p) => bookmarks.push(p));
    fixture.componentInstance.retry.subscribe(() => (retries += 1));
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
    const button = (label: string) =>
      el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    return {
      fixture,
      el,
      text,
      button,
      shown,
      changes,
      bookmarks,
      /** Sets an input and lets the block react. */
      set: async (name: string, value: unknown) => {
        fixture.componentRef.setInput(name, value);
        fixture.detectChanges();
        await flush();
        fixture.detectChanges();
      },
      retries: () => retries,
      scrollTo: async (page: number) => {
        const stage = el.querySelector<HTMLElement>('.pdf__stage')!;
        Object.defineProperties(stage, {
          clientHeight: { value: 600, configurable: true },
          scrollHeight: { value: engine.pages * 1000, configurable: true },
        });
        el.querySelectorAll('.pdf__page').forEach((page, index) => {
          Object.defineProperties(page, {
            offsetTop: { value: index * 1000, configurable: true },
            offsetHeight: { value: 1000, configurable: true },
          });
        });
        stage.scrollTop = Math.min(
          (page - 1) * 1000 + 1,
          stage.scrollHeight - stage.clientHeight,
        );
        stage.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();
        await flush();
        fixture.detectChanges();
      },
      click: async (label: string) => {
        button(label).click();
        fixture.detectChanges();
        await flush();
        fixture.detectChanges();
      },
    };
  }

  it('opens the content URL and draws the first page, with "Trang p/n"', async () => {
    const { text } = await render();
    expect(engine.opened).toEqual(['/api/v1/learning-assets/9/content']);
    expect(engine.drawn.map((d) => d.page)).toEqual([1, 2]);
    expect(text()).toContain('Trang 1/5');
  });

  it('opens at the page the server remembers and says so', async () => {
    const { text } = await render(3);
    expect(engine.drawn.map((d) => d.page)).toContain(3);
    expect(text()).toContain('Trang 3/5');
    expect(text()).toContain('Đã mở lại tại trang 3.');
  });

  it('keeps a remembered page inside the document and says nothing on the first page', async () => {
    const far = await render(99);
    expect(far.text()).toContain('Trang 5/5');
    const first = await render(1);
    expect(first.text()).not.toContain('Đã mở lại');
  });

  it('shows every page in one scroll area without page buttons', async () => {
    const { button, el, scrollTo, text } = await render();
    expect(button('Trang trước')).toBeNull();
    expect(button('Trang sau')).toBeNull();
    expect(el.querySelectorAll('.pdf__page')).toHaveLength(5);
    await scrollTo(3);
    expect(text()).toContain('Trang 3/5');
    expect(el.querySelector('canvas[data-page="3"]')).not.toBeNull();
    await scrollTo(2);
    expect(text()).toContain('Trang 2/5');
    await scrollTo(5);
    expect(text()).toContain('Trang 5/5');
  });

  it('releases the canvases that are far from the viewport', async () => {
    const { scrollTo } = await render();
    await scrollTo(5);
    expect(engine.drawn[0].cancelled).toBe(true);
    expect(engine.drawn.at(-1)).toMatchObject({ page: 5, cancelled: false });
  });

  it('expands the reader and keeps the same page when native fullscreen is unavailable', async () => {
    const { click, el, scrollTo, text } = await render();
    await scrollTo(3);
    await click('Toàn màn hình');
    expect(
      el.querySelector('[role="dialog"][aria-modal="true"]'),
    ).not.toBeNull();
    expect(text()).toContain('Trang 3/5');
    await click('Thoát toàn màn hình');
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(text()).toContain('Trang 3/5');
  });

  it('closes the expanded reader with Escape and restores focus to its button', async () => {
    const { click, el, button, fixture } = await render();
    await click('Toàn màn hình');
    const dialog = el.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.tabIndex).toBe(-1);
    const stage = el.querySelector<HTMLElement>('.pdf__stage');
    stage?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    await flush();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(button('Toàn màn hình'));
  });

  it('zooms in and out within its limits and redraws the page', async () => {
    const { button, click, text } = await render();
    expect(button('Thu nhỏ').disabled).toBe(true);
    expect(text()).toContain('100%');
    await click('Phóng to');
    expect(text()).toContain('125%');
    expect(
      engine.drawn.some(({ page, width }) => page === 1 && width === 1200),
    ).toBe(true);
    for (let i = 0; i < 4; i++) await click('Phóng to');
    expect(text()).toContain('300%');
    expect(button('Phóng to').disabled).toBe(true);
    await click('Thu nhỏ');
    expect(text()).toContain('200%');
  });

  it('reports a page only after the learner stays on it for a second', async () => {
    const { scrollTo, shown } = await render();
    vi.advanceTimersByTime(PDF_PAGE_DWELL_MS - 1);
    expect(shown).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(shown).toEqual([1]);

    await scrollTo(2);
    vi.advanceTimersByTime(300);
    await scrollTo(3);
    vi.advanceTimersByTime(PDF_PAGE_DWELL_MS);
    expect(shown).toEqual([1, 3]);
  });

  it('tells every page at once, with no dwell, starting with the one it opens on', async () => {
    const { scrollTo, changes, shown } = await render(3);
    expect(changes).toEqual([3]);
    await scrollTo(4);
    await scrollTo(3);
    expect(changes).toEqual([3, 4, 3]);
    expect(shown).toEqual([]);
  });

  it('shows the page a jump asks for, again when the same page is asked twice', async () => {
    const { set, scrollTo, el, text, changes } = await render();
    await set('jump', { value: 4, seq: 1 });
    expect(text()).toContain('Trang 4/5');
    expect(el.querySelector('canvas[data-page="4"]')).not.toBeNull();

    await scrollTo(3);
    expect(text()).toContain('Trang 3/5');
    await set('jump', { value: 4, seq: 2 });
    expect(text()).toContain('Trang 4/5');
    expect(changes).toEqual([1, 4, 3, 4]);

    await set('jump', { value: 99, seq: 3 });
    expect(text()).toContain('Trang 5/5');
  });

  it('opens on the page of a jump that arrived before the file did', async () => {
    const fixture = TestBed.createComponent(PdfBlock);
    fixture.componentRef.setInput('src', '/api/v1/learning-assets/9/content');
    fixture.componentRef.setInput('jump', { value: 4, seq: 1 });
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    expect(engine.drawn.map((d) => d.page)).toEqual([3, 4, 5]);
  });

  it('says nothing about resuming when it opens at a jump, whatever page the server remembers', async () => {
    const fixture = TestBed.createComponent(PdfBlock);
    fixture.componentRef.setInput('src', '/api/v1/learning-assets/9/content');
    fixture.componentRef.setInput('startPage', 4);
    fixture.componentRef.setInput('jump', { value: 3, seq: 0 });
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Trang 3/5');
    expect(text).not.toContain('Đã mở lại');
  });

  it('bookmarks the page on screen from a toggle button that shows and waits', async () => {
    const { button, click, scrollTo, set, bookmarks } = await render();
    expect(button('Đánh dấu trang này').getAttribute('aria-pressed')).toBe(
      'false',
    );
    await scrollTo(2);
    await click('Đánh dấu trang này');
    expect(bookmarks).toEqual([2]);

    await set('bookmarked', true);
    expect(button('Đánh dấu trang này').getAttribute('aria-pressed')).toBe(
      'true',
    );
    await set('busy', true);
    expect(button('Đánh dấu trang này').disabled).toBe(true);
  });

  it('shows an error with "Thử lại" when the file cannot be opened', async () => {
    engine.fail = true;
    const { text, el, retries } = await render();
    expect(text()).toContain('Không tải được tài liệu PDF.');
    expect(el.querySelector('canvas')).toBeNull();
    el.querySelector('button')!.click();
    expect(retries()).toBe(1);
  });

  it('lets the document go when the block goes away', async () => {
    const { fixture } = await render();
    fixture.destroy();
    expect(engine.destroyed).toBe(1);
  });
});
