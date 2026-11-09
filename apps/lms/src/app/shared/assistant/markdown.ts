/** One styled run of an answer's text. Nothing in it is ever parsed as HTML. */
export interface InlineRun {
  readonly kind: 'text' | 'code' | 'link';
  readonly text: string;
  readonly strong: boolean;
  readonly emphasis: boolean;
  /** Only on a `link`: an in-app path starting with a single `/`. */
  readonly href?: string;
}

export type MarkdownBlock =
  | { readonly kind: 'paragraph'; readonly runs: readonly InlineRun[] }
  | {
      readonly kind: 'list';
      readonly ordered: boolean;
      readonly items: readonly (readonly InlineRun[])[];
    }
  | { readonly kind: 'code'; readonly text: string }
  | {
      readonly kind: 'table';
      readonly head: readonly (readonly InlineRun[])[];
      readonly rows: readonly (readonly (readonly InlineRun[])[])[];
    };

const FENCE = /^\s*```/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/**
 * Parses the small markdown subset assistants answer in: paragraphs, bold, italic, inline and fenced
 * code, bullet and numbered lists, tables and links. Headings become bold paragraphs. Anything else,
 * raw HTML included, stays literal text. A link is kept only when it points inside the app; any other
 * link keeps its label as plain text. A fence left open while the answer streams renders as code.
 */
export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: 'paragraph', runs: inline(paragraph.join('\n')) });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (FENCE.test(line)) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      blocks.push({ kind: 'code', text: body.join('\n') });
      continue;
    }

    if (line.trim() === '') {
      flush();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({
        kind: 'paragraph',
        runs: inline(heading[1].replace(/\s+#+\s*$/, '')).map((run) => ({
          ...run,
          strong: true,
        })),
      });
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && isRule(lines[i + 1])) {
      flush();
      const head = cells(line);
      const rows: (readonly InlineRun[])[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(cells(lines[i]).map((cell) => inline(cell)));
        i++;
      }
      i--;
      blocks.push({
        kind: 'table',
        head: head.map((cell) => inline(cell)),
        rows,
      });
      continue;
    }

    const listKind = BULLET.test(line)
      ? 'bullet'
      : NUMBERED.test(line)
        ? 'numbered'
        : null;
    if (listKind) {
      flush();
      const pattern = listKind === 'bullet' ? BULLET : NUMBERED;
      const items: (readonly InlineRun[])[] = [];
      while (i < lines.length) {
        const item = pattern.exec(lines[i]);
        if (!item) break;
        items.push(inline(item[1]));
        i++;
      }
      i--;
      blocks.push({ kind: 'list', ordered: listKind === 'numbered', items });
      continue;
    }

    paragraph.push(line);
  }
  flush();
  return blocks;
}

function isRule(line: string): boolean {
  return line.includes('-') && TABLE_RULE.test(line);
}

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

interface Style {
  readonly strong: boolean;
  readonly emphasis: boolean;
}

const INLINE =
  /`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]*)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|(?<!\w)_([^_\n]+)_(?!\w)/;

function inline(
  text: string,
  style: Style = { strong: false, emphasis: false },
): InlineRun[] {
  const runs: InlineRun[] = [];
  const push = (run: Omit<InlineRun, 'strong' | 'emphasis'>) => {
    if (run.text) runs.push({ ...run, ...style });
  };

  let rest = text;
  for (let match = INLINE.exec(rest); match; match = INLINE.exec(rest)) {
    push({ kind: 'text', text: rest.slice(0, match.index) });
    const [whole, code, label, target, bold1, bold2, em1, em2] = match;
    if (code !== undefined) {
      push({ kind: 'code', text: code });
    } else if (label !== undefined) {
      if (isInternal(target)) push({ kind: 'link', text: label, href: target });
      else runs.push(...inline(label, style));
    } else if (bold1 !== undefined || bold2 !== undefined) {
      runs.push(...inline(bold1 ?? bold2, { ...style, strong: true }));
    } else {
      runs.push(...inline(em1 ?? em2, { ...style, emphasis: true }));
    }
    rest = rest.slice(match.index + whole.length);
  }
  push({ kind: 'text', text: rest });
  return runs;
}

/** An in-app path: one leading slash, no scheme, no protocol-relative `//`, no backslash. */
function isInternal(target: string): boolean {
  return /^\/(?![/\\])[^\s\\]*$/.test(target);
}
