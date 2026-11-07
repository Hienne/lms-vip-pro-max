import { TestBed } from '@angular/core/testing';
import type { BodyFormat } from '@lms/contracts';
import { Markdown } from './markdown';

function render(source: string, format?: BodyFormat): HTMLElement {
  const fixture = TestBed.createComponent(Markdown);
  fixture.componentRef.setInput('source', source);
  if (format) fixture.componentRef.setInput('format', format);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const HOSTILE_HTML =
  '<p onclick="steal()">Chào <script>window.pwned = 1</script><b onmouseover="x()">bạn</b></p>' +
  '<style>body{display:none}</style><iframe src="https://evil.example"></iframe>' +
  '<img src="x" onerror="window.pwned = 2"><a href="javascript:window.pwned=3" onclick="y()">bấm</a>' +
  '<a href="https://example.com/a" onclick="z()" style="color:red">an toàn</a>';

describe('Markdown', () => {
  it('adds stable heading anchors only when a page requests an outline', () => {
    expect(render('## First').querySelector('h3')?.hasAttribute('id')).toBe(
      false,
    );
    const fixture = TestBed.createComponent(Markdown);
    fixture.componentRef.setInput('source', '## First\nParagraph\n### Second');
    fixture.componentRef.setInput('headingPrefix', 'community-article');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(Array.from(element.querySelectorAll('h3, h4'), (h) => h.id)).toEqual(
      ['community-article-0', 'community-article-2'],
    );
  });

  it('keeps its heading sizes unless it sits under a heading of its own', () => {
    expect(render('## A').querySelector('.markdown--nested')).toBeNull();
    const fixture = TestBed.createComponent(Markdown);
    fixture.componentRef.setInput('source', '## A');
    fixture.componentRef.setInput('nested', true);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.markdown--nested'),
    ).not.toBeNull();
  });

  it('renders the editor subset as elements', () => {
    const el = render(
      '## Tiêu đề\nĐoạn **đậm** và *nghiêng*.\n- một\n- hai\n1. ba',
    );
    expect(el.querySelector('h3')?.textContent).toBe('Tiêu đề');
    expect(el.querySelector('p strong')?.textContent).toBe('đậm');
    expect(el.querySelector('p em')?.textContent).toBe('nghiêng');
    expect(
      Array.from(el.querySelectorAll('ul li')).map((li) => li.textContent),
    ).toEqual(['một', 'hai']);
    expect(el.querySelector('ol li')?.textContent).toBe('ba');
  });

  it('renders a body saved as HTML from the allowlist only', () => {
    const el = render(
      '<h2>Mục</h2><p>Đọc <a href="https://example.com/x">tại đây</a></p>',
      'html',
    );
    expect(el.querySelector('h3')?.textContent).toBe('Mục');
    const link = el.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('https://example.com/x');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('keeps the line breaks of plain text', () => {
    const el = render('một\nhai', 'plain');
    expect(el.querySelectorAll('p br').length).toBe(1);
    expect(el.querySelector('p')?.textContent).toBe('mộthai');
  });

  it.each<[string, BodyFormat]>([
    [HOSTILE_HTML, 'html'],
    [HOSTILE_HTML, 'markdown'],
    [HOSTILE_HTML, 'plain'],
  ])(
    'never creates a script, style, iframe, image or on* attribute (%#)',
    (source, format) => {
      (window as unknown as Record<string, unknown>)['pwned'] = undefined;
      const el = render(source, format);
      expect(
        el.querySelector('script, style, iframe, img, object, embed'),
      ).toBeNull();
      const attributes = Array.from(el.querySelectorAll('*')).flatMap((node) =>
        node.getAttributeNames(),
      );
      expect(attributes.filter((name) => name.startsWith('on'))).toEqual([]);
      expect(attributes).not.toContain('style');
      expect(
        (window as unknown as Record<string, unknown>)['pwned'],
      ).toBeUndefined();
    },
  );

  it('shows markup typed into a markdown body as text', () => {
    const el = render('<b>không phải đậm</b>');
    expect(el.querySelector('b')).toBeNull();
    expect(el.textContent).toContain('<b>không phải đậm</b>');
  });

  it('links nothing but http and https addresses', () => {
    const el = render(HOSTILE_HTML, 'html');
    const hrefs = Array.from(el.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toEqual(['https://example.com/a']);
    expect(el.textContent).toContain('bấm');
  });

  it('renders a mention as text with an at sign and no link', () => {
    const el = render('Cảm ơn @[Trần B](user:000009)!');
    expect(el.querySelector('a')).toBeNull();
    expect(el.querySelector('.markdown__mention')?.textContent).toBe('@Trần B');
    expect(el.textContent).toContain('Cảm ơn @Trần B!');
  });
});
