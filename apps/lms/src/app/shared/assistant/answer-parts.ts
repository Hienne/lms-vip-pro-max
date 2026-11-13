import type { Citation } from '@lms/contracts';

/** A run of answer text, or a source marker that has a citation behind it. */
export type AnswerPart =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'source'; readonly citation: Citation };

/** An answer ready to render: its text with markers turned into sources, and the sources left over. */
export interface AnswerParts {
  readonly parts: readonly AnswerPart[];
  /** Citations no marker in the text points at, shown as a row under the answer. */
  readonly unmarked: readonly Citation[];
}

/**
 * The backend's marker, `[1]` or `[1, 2]`, or the literal `[n]` a model copies from its
 * instructions, with the spaces before it.
 */
const MARKER = /([ \t]*)\[(\d+(?:\s*,\s*\d+)*|[nN])\]/g;

/**
 * Splits an answer at its `[n]` markers. A number with a citation becomes a source; a number
 * without one, and the literal `[n]`, is dropped with the space before it, so the reader never
 * sees a marker that opens nothing. The backend numbers citations as the model saw them and returns
 * only the marked ones, or every retrieved passage when the answer marks none: those, and any
 * citation no marker reaches, come back as `unmarked`. The text is never parsed as HTML.
 */
export function answerParts(
  text: string,
  citations: readonly Citation[],
): AnswerParts {
  const byNumber = new Map<number, Citation>();
  for (const citation of citations) {
    if (!byNumber.has(citation.n)) byNumber.set(citation.n, citation);
  }

  const parts: AnswerPart[] = [];
  const marked = new Set<number>();
  const pushText = (value: string) => {
    if (!value) return;
    const last = parts.at(-1);
    if (last?.kind === 'text')
      parts[parts.length - 1] = { kind: 'text', text: last.text + value };
    else parts.push({ kind: 'text', text: value });
  };

  let from = 0;
  for (const match of text.matchAll(MARKER)) {
    pushText(text.slice(from, match.index));
    const numbers = /^\d/.test(match[2])
      ? match[2].split(',').map((digits) => Number(digits.trim()))
      : [];
    const cited = numbers.flatMap((n) => byNumber.get(n) ?? []);
    if (cited.length > 0) pushText(match[1]);
    for (const citation of cited) {
      parts.push({ kind: 'source', citation });
      marked.add(citation.n);
    }
    from = match.index + match[0].length;
  }
  pushText(text.slice(from));

  return {
    parts,
    unmarked: [...byNumber.values()].filter((c) => !marked.has(c.n)),
  };
}
