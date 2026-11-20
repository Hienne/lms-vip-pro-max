/** Grapheme wrapping keeps Vietnamese and emoji clusters intact. */
export function bubbleLines(
  text: string,
  measure: (text: string) => number,
  width: number,
): string[] {
  const graphemes = [
    ...new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(text),
  ].map((part) => part.segment);
  const lines: string[] = [];
  let line = '';
  for (const grapheme of graphemes) {
    if (line && measure(line + grapheme) > width) {
      lines.push(line.trimEnd());
      line = '';
    }
    line += grapheme;
  }
  if (line) lines.push(line.trimEnd());
  if (lines.length <= 3) return lines;
  let last = lines[2];
  while (last && measure(last + '…') > width) {
    const parts = [
      ...new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(last),
    ];
    last = parts
      .slice(0, -1)
      .map((part) => part.segment)
      .join('');
  }
  return [lines[0], lines[1], last + '…'];
}
