import { parseContent, type Block, type Inline } from './markdown.parse';

const text = (value: string): Inline => ({ kind: 'text', text: value });

describe('parseContent: markdown', () => {
  const md = (source: string): readonly Block[] =>
    parseContent(source, 'markdown');

  it('reads headings, paragraphs and the inline styles of the editor subset', () => {
    expect(md('## Mục tiêu\nHọc **đậm**, *nghiêng* và `mã`.')).toEqual([
      { kind: 'heading', level: 3, inlines: [text('Mục tiêu')] },
      {
        kind: 'paragraph',
        inlines: [
          text('Học '),
          { kind: 'strong', text: 'đậm' },
          text(', '),
          { kind: 'em', text: 'nghiêng' },
          text(' và '),
          { kind: 'code', text: 'mã' },
          text('.'),
        ],
      },
    ]);
  });

  it('maps ## and ### under the block title, so they read as h3 and h4', () => {
    expect(
      md('# A\n## B\n### C').map((b) => b.kind === 'heading' && b.level),
    ).toEqual([3, 3, 4]);
  });

  it('groups consecutive list lines and keeps ordered and unordered lists apart', () => {
    expect(md('- một\n* hai\n1. ba\n2. bốn\nhết')).toEqual([
      { kind: 'list', ordered: false, items: [[text('một')], [text('hai')]] },
      { kind: 'list', ordered: true, items: [[text('ba')], [text('bốn')]] },
      { kind: 'paragraph', inlines: [text('hết')] },
    ]);
  });

  it('reads a mention as a named person, not as a link', () => {
    expect(md('Nhờ @[Nguyễn Văn A](user:000123) xem giúp.')).toEqual([
      {
        kind: 'paragraph',
        inlines: [
          text('Nhờ '),
          { kind: 'mention', name: 'Nguyễn Văn A', userId: '000123' },
          text(' xem giúp.'),
        ],
      },
    ]);
  });

  it('keeps a malformed mention as text', () => {
    expect(md('@[Tên](http://x.test) và @[](user:1)')).toEqual([
      {
        kind: 'paragraph',
        inlines: [text('@[Tên](http://x.test) và @[](user:1)')],
      },
    ]);
  });

  it('reads a quote and a fenced code block', () => {
    expect(md('> Lưu ý\n```\nSELECT 1;\n  FROM dual;\n```')).toEqual([
      { kind: 'quote', inlines: [text('Lưu ý')] },
      { kind: 'code', text: 'SELECT 1;\n  FROM dual;' },
    ]);
  });

  it('keeps markup characters in text as text', () => {
    const [block] = md('<script>alert(1)</script> & "x"');
    expect(block).toEqual({
      kind: 'paragraph',
      inlines: [text('<script>alert(1)</script> & "x"')],
    });
  });

  it('is empty for nothing', () => {
    expect(md('')).toEqual([]);
    expect(md('  \n\n ')).toEqual([]);
  });
});

describe('parseContent: html', () => {
  const html = (source: string): readonly Block[] =>
    parseContent(source, 'html');

  it('rebuilds the allowed elements', () => {
    expect(
      html(
        '<h2>Tiêu đề</h2><p>Một <strong>đậm</strong> và <em>nghiêng</em> <code>x</code><br>dòng</p>' +
          '<ul><li>a</li><li>b</li></ul><ol><li>c</li></ol><pre>a\n b</pre>',
      ),
    ).toEqual([
      { kind: 'heading', level: 3, inlines: [text('Tiêu đề')] },
      {
        kind: 'paragraph',
        inlines: [
          text('Một '),
          { kind: 'strong', text: 'đậm' },
          text(' và '),
          { kind: 'em', text: 'nghiêng' },
          text(' '),
          { kind: 'code', text: 'x' },
          { kind: 'break' },
          text('dòng'),
        ],
      },
      { kind: 'list', ordered: false, items: [[text('a')], [text('b')]] },
      { kind: 'list', ordered: true, items: [[text('c')]] },
      { kind: 'code', text: 'a\n b' },
    ]);
  });

  it('keeps a link only for an http or https address', () => {
    const [ok, bad, js] = html(
      '<p><a href="https://example.com/x">mở</a></p>' +
        '<p><a href="ftp://example.com">ftp</a></p>' +
        '<p><a href="javascript:alert(1)">js</a></p>',
    ) as unknown as readonly { inlines: Inline[] }[];
    expect(ok.inlines).toEqual([
      { kind: 'link', text: 'mở', href: 'https://example.com/x' },
    ]);
    expect(bad.inlines).toEqual([text('ftp')]);
    expect(js.inlines).toEqual([text('js')]);
  });

  it('shows any other element as its text and drops script and style entirely', () => {
    const blocks = html(
      '<div>chữ <span onclick="x()">trong span</span></div>' +
        '<script>alert(1)</script><style>p{}</style><iframe src="//x">y</iframe>' +
        '<img src="x" onerror="x()">',
    );
    expect(blocks).toEqual([
      { kind: 'paragraph', inlines: [text('chữ trong span')] },
    ]);
  });

  it('puts loose text and inline elements at the top into a paragraph', () => {
    expect(html('Xin <strong>chào</strong>')).toEqual([
      {
        kind: 'paragraph',
        inlines: [text('Xin '), { kind: 'strong', text: 'chào' }],
      },
    ]);
  });
});

describe('parseContent: plain', () => {
  it('keeps line breaks and splits paragraphs on a blank line', () => {
    expect(parseContent('a\nb\n\nc', 'plain')).toEqual([
      {
        kind: 'paragraph',
        inlines: [text('a'), { kind: 'break' }, text('b')],
      },
      { kind: 'paragraph', inlines: [text('c')] },
    ]);
  });

  it('does not read markup or markdown', () => {
    expect(parseContent('**a** <b>', 'plain')).toEqual([
      { kind: 'paragraph', inlines: [text('**a** <b>')] },
    ]);
  });
});
