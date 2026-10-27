import type { BodyFormat } from '@lms/contracts';

/**
 * The lesson text a learner reads, as plain data: a list of blocks of inline pieces. The parsers
 * below never produce markup, and the `app-markdown` template turns each node into an element, so
 * nothing from a lesson body reaches the DOM as HTML.
 */
export type Inline =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'strong'; readonly text: string }
  | { readonly kind: 'em'; readonly text: string }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'link'; readonly text: string; readonly href: string }
  | { readonly kind: 'break' };

export type Block =
  | {
      readonly kind: 'heading';
      /** 3 or 4: the lesson page's block title is the h2 above. */
      readonly level: 3 | 4;
      readonly inlines: readonly Inline[];
    }
  | { readonly kind: 'paragraph'; readonly inlines: readonly Inline[] }
  | { readonly kind: 'quote'; readonly inlines: readonly Inline[] }
  | {
      readonly kind: 'list';
      readonly ordered: boolean;
      readonly items: readonly (readonly Inline[])[];
    }
  | { readonly kind: 'code'; readonly text: string };

const text = (value: string): Inline => ({ kind: 'text', text: value });

export function parseContent(
  source: string,
  format: BodyFormat,
): readonly Block[] {
  switch (format) {
    case 'html':
      return parseHtml(source);
    case 'plain':
      return parsePlain(source);
    default:
      return parseMarkdown(source);
  }
}

// ---- markdown ----

const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;

/** Bold, italic and code spans; everything else is text. Spans do not nest. */
function inlineMarkdown(line: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of line.matchAll(INLINE)) {
    if (match.index > last) out.push(text(line.slice(last, match.index)));
    if (match[1] !== undefined) out.push({ kind: 'strong', text: match[1] });
    else if (match[2] !== undefined) out.push({ kind: 'em', text: match[2] });
    else out.push({ kind: 'code', text: match[3] });
    last = match.index + match[0].length;
  }
  if (last < line.length) out.push(text(line.slice(last)));
  return out;
}

/** The mockup's small markdown (`UI.Markdown`): headings, lists, quotes, paragraphs, fenced code. */
function parseMarkdown(source: string): readonly Block[] {
  const blocks: Block[] = [];
  let list: { ordered: boolean; items: Inline[][] } | null = null;
  let fence: string[] | null = null;
  const flush = () => {
    if (list) blocks.push({ kind: 'list', ...list });
    list = null;
  };

  for (const line of source.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      if (fence) {
        blocks.push({ kind: 'code', text: fence.join('\n') });
        fence = null;
      } else {
        flush();
        fence = [];
      }
      continue;
    }
    if (fence) {
      fence.push(line);
      continue;
    }
    let match: RegExpMatchArray | null;
    if ((match = line.match(/^(#{1,3})\s+(.*)/))) {
      flush();
      blocks.push({
        kind: 'heading',
        level: match[1].length === 3 ? 4 : 3,
        inlines: inlineMarkdown(match[2]),
      });
    } else if ((match = line.match(/^\s*[-*]\s+(.*)/))) {
      if (list?.ordered !== false) {
        flush();
        list = { ordered: false, items: [] };
      }
      list.items.push(inlineMarkdown(match[1]));
    } else if ((match = line.match(/^\s*\d+\.\s+(.*)/))) {
      if (list?.ordered !== true) {
        flush();
        list = { ordered: true, items: [] };
      }
      list.items.push(inlineMarkdown(match[1]));
    } else if ((match = line.match(/^>\s?(.*)/))) {
      flush();
      blocks.push({ kind: 'quote', inlines: inlineMarkdown(match[1]) });
    } else if (line.trim()) {
      flush();
      blocks.push({ kind: 'paragraph', inlines: inlineMarkdown(line) });
    } else {
      flush();
    }
  }
  if (fence) blocks.push({ kind: 'code', text: fence.join('\n') });
  flush();
  return blocks;
}

// ---- plain ----

/** Text as written: a blank line starts a paragraph, a line break stays a line break. */
function parsePlain(source: string): readonly Block[] {
  return source
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim())
    .map((paragraph) => ({
      kind: 'paragraph' as const,
      inlines: paragraph
        .split('\n')
        .flatMap((line, index): Inline[] =>
          index === 0 ? [text(line)] : [{ kind: 'break' }, text(line)],
        ),
    }));
}

// ---- html ----

/** Elements whose content is never shown: they hold code or other documents, not reading text. */
const DROPPED = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'TEMPLATE',
  'NOSCRIPT',
]);

/** Only an http or https address is a link; anything else is shown as its text. */
function safeHref(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** Adds an inline piece, joining it to the text before it. */
function append(target: Inline[], inline: Inline): void {
  const last = target.at(-1);
  if (inline.kind === 'text' && last?.kind === 'text') {
    target[target.length - 1] = text(last.text + inline.text);
  } else if (inline.kind !== 'text' || inline.text) {
    target.push(inline);
  }
}

function inlinesOfNodes(nodes: readonly Node[]): Inline[] {
  const out: Inline[] = [];
  for (const child of nodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      append(out, text(child.textContent ?? ''));
    } else if (child instanceof Element) {
      if (DROPPED.has(child.tagName)) continue;
      const content = child.textContent ?? '';
      switch (child.tagName) {
        case 'BR':
          append(out, { kind: 'break' });
          break;
        case 'STRONG':
        case 'B':
          append(out, { kind: 'strong', text: content });
          break;
        case 'EM':
        case 'I':
          append(out, { kind: 'em', text: content });
          break;
        case 'CODE':
          append(out, { kind: 'code', text: content });
          break;
        case 'A': {
          const href = safeHref(child.getAttribute('href'));
          append(
            out,
            href ? { kind: 'link', text: content, href } : text(content),
          );
          break;
        }
        default:
          // Any other element is its content, with the same rules inside it.
          inlinesOf(child).forEach((inline) => append(out, inline));
      }
    }
  }
  return out;
}

const inlinesOf = (node: Node): Inline[] =>
  inlinesOfNodes(Array.from(node.childNodes));

const HEADING_LEVEL: Record<string, 3 | 4> = { H2: 3, H3: 4, H4: 4 };

/**
 * A body saved as HTML, rebuilt from an allowlist (`p`, `h2`-`h4`, `ul`, `ol`, `li`, `strong`,
 * `em`, `code`, `pre`, `br`, `a` with an http(s) address). It is parsed by `DOMParser`, which runs
 * no script, and read as data: attributes are never copied, other elements are their text, and
 * `script`, `style`, `iframe` and the like are dropped.
 */
function parseHtml(source: string): readonly Block[] {
  const body = new DOMParser().parseFromString(source, 'text/html').body;
  const blocks: Block[] = [];
  let loose: Inline[] = [];
  const flushLoose = () => {
    if (loose.some((i) => i.kind !== 'text' || i.text.trim())) {
      blocks.push({ kind: 'paragraph', inlines: loose });
    }
    loose = [];
  };

  const walk = (parent: Node) => {
    for (const child of Array.from(parent.childNodes)) {
      if (!(child instanceof Element)) {
        inlinesOfNodes([child]).forEach((inline) => append(loose, inline));
        continue;
      }
      const tag = child.tagName;
      if (DROPPED.has(tag)) continue;
      if (tag === 'P') {
        flushLoose();
        blocks.push({ kind: 'paragraph', inlines: inlinesOf(child) });
      } else if (tag in HEADING_LEVEL) {
        flushLoose();
        blocks.push({
          kind: 'heading',
          level: HEADING_LEVEL[tag],
          inlines: inlinesOf(child),
        });
      } else if (tag === 'UL' || tag === 'OL') {
        flushLoose();
        blocks.push({
          kind: 'list',
          ordered: tag === 'OL',
          items: Array.from(child.children)
            .filter((li) => li.tagName === 'LI')
            .map(inlinesOf),
        });
      } else if (tag === 'PRE') {
        flushLoose();
        blocks.push({ kind: 'code', text: child.textContent ?? '' });
      } else if (
        ['STRONG', 'EM', 'CODE', 'A', 'BR', 'SPAN', 'B', 'I'].includes(tag)
      ) {
        inlinesOfNodes([child]).forEach((inline) => append(loose, inline));
      } else {
        // A container such as `div`: its children are read the same way.
        walk(child);
      }
    }
  };
  walk(body);
  flushLoose();
  return blocks;
}
