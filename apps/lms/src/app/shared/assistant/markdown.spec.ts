import { parseMarkdown, type InlineRun } from './markdown';

const texts = (runs: readonly InlineRun[]) => runs.map((r) => r.text).join('');

function paragraphRuns(source: string): readonly InlineRun[] {
  const [block] = parseMarkdown(source);
  if (block.kind !== 'paragraph') throw new Error('paragraph expected');
  return block.runs;
}

describe('parseMarkdown', () => {
  it('splits paragraphs at blank lines', () => {
    const blocks = parseMarkdown('Một.\n\nHai.');
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'paragraph']);
  });

  it('marks bold, italic and inline code', () => {
    expect(
      paragraphRuns('Chọn **Lưu**, *rồi* `EOD`.').map((r) => [
        r.text,
        r.kind,
        r.strong,
        r.emphasis,
      ]),
    ).toEqual([
      ['Chọn ', 'text', false, false],
      ['Lưu', 'text', true, false],
      [', ', 'text', false, false],
      ['rồi', 'text', false, true],
      [' ', 'text', false, false],
      ['EOD', 'code', false, false],
      ['.', 'text', false, false],
    ]);
  });

  it('reads bullet and numbered lists', () => {
    const blocks = parseMarkdown('1. Mở\n2. Lưu\n\n- A\n- B');
    expect(blocks).toMatchObject([
      { kind: 'list', ordered: true },
      { kind: 'list', ordered: false },
    ]);
    const first = blocks[0];
    if (first.kind !== 'list') throw new Error('list expected');
    expect(first.items.map(texts)).toEqual(['Mở', 'Lưu']);
  });

  it('reads a table with a header row', () => {
    const [table] = parseMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
    if (table.kind !== 'table') throw new Error('table expected');
    expect(table.head.map(texts)).toEqual(['A', 'B']);
    expect(table.rows.map((row) => row.map(texts))).toEqual([['1', '2']]);
  });

  it('keeps fenced code literal, and an open fence while streaming', () => {
    expect(parseMarkdown('```\n**x** <b>\n```')).toEqual([
      { kind: 'code', text: '**x** <b>' },
    ]);
    expect(parseMarkdown('```\nSELECT 1')).toEqual([
      { kind: 'code', text: 'SELECT 1' },
    ]);
  });

  it('turns a heading into a bold paragraph', () => {
    expect(paragraphRuns('## Các bước')).toMatchObject([
      { text: 'Các bước', strong: true },
    ]);
  });

  it('keeps an in-app link and drops an external one to its label', () => {
    const runs = paragraphRuns(
      '[Bài viết](/community/posts/3) và [Ngoài](https://evil.test/x)',
    );
    expect(runs.filter((r) => r.kind === 'link')).toEqual([
      expect.objectContaining({ text: 'Bài viết', href: '/community/posts/3' }),
    ]);
    expect(texts(runs)).toBe('Bài viết và Ngoài');
  });

  it('never yields a link for hostile targets and keeps raw HTML as text', () => {
    const hostile = [
      '[a](javascript:alert(1))',
      '[a](//evil.test)',
      '[a](/\\evil.test)',
      '[a](data:text/html;base64,AAAA)',
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<a href="https://evil.test">x</a>',
    ].join('\n\n');
    const runs = parseMarkdown(hostile).flatMap((b) =>
      b.kind === 'paragraph' ? b.runs : [],
    );
    expect(runs.some((r) => r.kind === 'link')).toBe(false);
    expect(texts(runs)).toContain('<script>alert(1)</script>');
  });

  it('leaves citation markers in the text for the renderer', () => {
    expect(texts(paragraphRuns('Xem [1] và [2, 3].'))).toBe(
      'Xem [1] và [2, 3].',
    );
  });
});
