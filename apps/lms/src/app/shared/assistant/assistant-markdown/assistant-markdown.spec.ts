import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Citation } from '@lms/contracts';
import { AssistantMarkdown } from './assistant-markdown';

const citation: Citation = {
  n: 1,
  documentId: 1,
  fileName: 'quy-trinh.pdf',
  page: 2,
  lineStart: 1,
  lineEnd: 3,
  snippet: 'Đoạn trích',
};

@Component({
  selector: 'app-host',
  imports: [AssistantMarkdown],
  template: `<app-assistant-markdown
    [text]="text()"
    [citations]="citations()"
    [badges]="badges()"
    (sourceSelected)="picked.push($event)"
  />`,
})
class Host {
  readonly text = signal('');
  readonly citations = signal<readonly Citation[]>([]);
  readonly badges = signal(false);
  readonly picked: number[] = [];
}

describe('AssistantMarkdown', () => {
  async function render(
    text: string,
    patch: { citations?: readonly Citation[]; badges?: boolean } = {},
  ) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.text.set(text);
    if (patch.citations)
      fixture.componentInstance.citations.set(patch.citations);
    if (patch.badges) fixture.componentInstance.badges.set(patch.badges);
    await fixture.whenStable();
    return {
      host: fixture.componentInstance,
      el: fixture.nativeElement as HTMLElement,
    };
  }

  it('renders lists, bold, code and tables', async () => {
    const { el } = await render(
      [
        '**Các bước:**',
        '',
        '1. Mở `EOD`',
        '2. Lưu',
        '',
        '| Cột | Giá trị |',
        '|---|---|',
        '| A | 1 |',
        '',
        '```',
        'SELECT 1',
        '```',
      ].join('\n'),
    );
    expect(el.querySelectorAll('ol > li')).toHaveLength(2);
    expect(el.querySelector('ol code')?.textContent).toBe('EOD');
    expect(el.querySelectorAll('th')).toHaveLength(2);
    expect(el.querySelector('td')?.textContent?.trim()).toBe('A');
    expect(el.querySelector('pre code')?.textContent).toBe('SELECT 1');
  });

  it('renders an in-app link as a router link and an external one as text', async () => {
    const { el } = await render(
      '[Bài viết](/community/posts/3) [Ngoài](https://evil.test)',
    );
    const links = el.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/community/posts/3');
    expect(el.textContent).toContain('Ngoài');
  });

  it('keeps the query string of an in-app link (a Community post opens in the app)', async () => {
    const { el } = await render(
      '[Bài & phí](/community/contents/6?revisionId=6)',
    );
    const link = el.querySelector('a');
    expect(link?.getAttribute('href')).toBe(
      '/community/contents/6?revisionId=6',
    );
    expect(link?.textContent).toBe('Bài & phí');
  });

  it('renders hostile input as inert text', async () => {
    const { el } = await render(
      [
        '<script>window.pwned = 1</script>',
        '<img src=x onerror="window.pwned = 2">',
        '[x](javascript:alert(1))',
        '[y](//evil.test)',
        '<a href="https://evil.test">z</a>',
      ].join('\n\n'),
    );
    expect(el.querySelector('script, img, iframe, style')).toBeNull();
    expect(el.querySelectorAll('a')).toHaveLength(0);
    expect(el.querySelector('[onerror], [onclick]')).toBeNull();
    expect(el.textContent).toContain('<script>window.pwned = 1</script>');
    expect((window as unknown as { pwned?: number }).pwned).toBeUndefined();
  });

  it('draws a source marker as a numbered button that reports its click', async () => {
    const { host, el } = await render('Xem quy trình [1].', {
      citations: [citation],
    });
    const cite = el.querySelector<HTMLButtonElement>('.md__cite');
    expect(cite?.getAttribute('aria-label')).toBe(
      'Nguồn 1: quy-trinh.pdf, trang 2, dòng 1–3',
    );
    cite?.click();
    expect(host.picked).toEqual([1]);
  });

  it('draws a source marker as a badge when asked to', async () => {
    const { el } = await render('Xem [1].', {
      citations: [citation],
      badges: true,
    });
    expect(el.querySelector('app-source-badge')).not.toBeNull();
    expect(el.querySelector('.md__cite')).toBeNull();
  });
});
