export type MarkdownAction = 'bold' | 'italic' | 'code' | 'link' | 'list';

export interface MarkdownEdit {
  readonly value: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

const WRAP: Readonly<Record<'bold' | 'italic', string>> = {
  bold: '**',
  italic: '*',
};

/**
 * Applies a toolbar action to `value` around the selection and returns the new text with the
 * selection to restore. Pure: the editor component only moves the result into its textarea.
 * Selecting already-wrapped text and applying the same action again removes the markers.
 */
export function applyMarkdown(
  value: string,
  start: number,
  end: number,
  action: MarkdownAction,
): MarkdownEdit {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const selected = value.slice(from, to);

  switch (action) {
    case 'bold':
    case 'italic':
      return wrap(value, from, to, WRAP[action], WRAP[action], 'văn bản');
    case 'code':
      return selected.includes('\n')
        ? wrap(value, from, to, '```\n', '\n```', 'mã')
        : wrap(value, from, to, '`', '`', 'mã');
    case 'link': {
      const label = selected || 'liên kết';
      const text = `[${label}](https://)`;
      const urlStart = from + label.length + 3;
      return {
        value: value.slice(0, from) + text + value.slice(to),
        selectionStart: urlStart,
        selectionEnd: urlStart + 'https://'.length,
      };
    }
    case 'list':
      return prefixLines(value, from, to);
  }
}

function wrap(
  value: string,
  from: number,
  to: number,
  open: string,
  close: string,
  placeholder: string,
): MarkdownEdit {
  const before = value.slice(0, from);
  const after = value.slice(to);
  const selected = value.slice(from, to);

  if (before.endsWith(open) && after.startsWith(close)) {
    return {
      value:
        before.slice(0, -open.length) + selected + after.slice(close.length),
      selectionStart: from - open.length,
      selectionEnd: to - open.length,
    };
  }
  const inner = selected || placeholder;
  return {
    value: before + open + inner + close + after,
    selectionStart: from + open.length,
    selectionEnd: from + open.length + inner.length,
  };
}

function prefixLines(value: string, from: number, to: number): MarkdownEdit {
  const lineStart = value.lastIndexOf('\n', from - 1) + 1;
  const lineEndIndex = value.indexOf('\n', to);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const lines = value.slice(lineStart, lineEnd).split('\n');
  const allListed = lines.every((line) => line.startsWith('- '));
  const next = lines
    .map((line) => (allListed ? line.slice(2) : `- ${line}`))
    .join('\n');
  return {
    value: value.slice(0, lineStart) + next + value.slice(lineEnd),
    selectionStart: lineStart,
    selectionEnd: lineStart + next.length,
  };
}
