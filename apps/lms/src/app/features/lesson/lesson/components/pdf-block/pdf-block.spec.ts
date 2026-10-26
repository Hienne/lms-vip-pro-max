import { TestBed } from '@angular/core/testing';
import { PDF_PAGE_DWELL_MS, PdfBlock } from './pdf-block';
import { PdfEngine, type PdfFile, type PdfRender } from './pdf-engine';

interface Drawn {
  readonly page: number;
  readonly zoom: number;
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
      render: (page, _canvas, _width, zoom): PdfRender => {
        const drawn: Drawn = { page, zoom, cancelled: false };
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
    let retries = 0;
    fixture.componentInstance.pageShown.subscribe((p) => shown.push(p));
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
      retries: () => retries,
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
    expect(engine.drawn.map((d) => d.page)).toEqual([1]);
    expect(text()).toContain('Trang 1/5');
  });

  it('opens at the page the server remembers and says so', async () => {
    const { text } = await render(3);
    expect(engine.drawn[0].page).toBe(3);
    expect(text()).toContain('Trang 3/5');
    expect(text()).toContain('Đã mở lại tại trang 3.');
  });

  it('keeps a remembered page inside the document and says nothing on the first page', async () => {
    const far = await render(99);
    expect(far.text()).toContain('Trang 5/5');
    const first = await render(1);
    expect(first.text()).not.toContain('Đã mở lại');
  });

  it('moves with "Trang trước" and "Trang sau", disabled at the ends', async () => {
    const { button, click, text } = await render();
    expect(button('Trang trước').disabled).toBe(true);
    await click('Trang sau');
    await click('Trang sau');
    expect(text()).toContain('Trang 3/5');
    expect(engine.drawn.at(-1)?.page).toBe(3);
    await click('Trang trước');
    expect(text()).toContain('Trang 2/5');

    for (let i = 0; i < 4; i++) await click('Trang sau');
    expect(text()).toContain('Trang 5/5');
    expect(button('Trang sau').disabled).toBe(true);
  });

  it('drops the page still being drawn when the learner moves on', async () => {
    const { click } = await render();
    await click('Trang sau');
    expect(engine.drawn[0].cancelled).toBe(true);
    expect(engine.drawn[1].cancelled).toBe(false);
  });

  it('zooms in and out within its limits and redraws the page', async () => {
    const { button, click, text } = await render();
    expect(button('Thu nhỏ').disabled).toBe(true);
    expect(text()).toContain('100%');
    await click('Phóng to');
    expect(text()).toContain('125%');
    expect(engine.drawn.at(-1)).toMatchObject({ page: 1, zoom: 1.25 });
    for (let i = 0; i < 4; i++) await click('Phóng to');
    expect(text()).toContain('300%');
    expect(button('Phóng to').disabled).toBe(true);
    await click('Thu nhỏ');
    expect(text()).toContain('200%');
  });

  it('reports a page only after the learner stays on it for a second', async () => {
    const { click, shown } = await render();
    vi.advanceTimersByTime(PDF_PAGE_DWELL_MS - 1);
    expect(shown).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(shown).toEqual([1]);

    await click('Trang sau');
    vi.advanceTimersByTime(300);
    await click('Trang sau');
    vi.advanceTimersByTime(PDF_PAGE_DWELL_MS);
    expect(shown).toEqual([1, 3]);
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
