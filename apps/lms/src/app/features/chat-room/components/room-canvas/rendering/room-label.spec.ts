import { bubbleLines } from './room-label';

describe('avatar bubble wrapping', () => {
  const count = (text: string) =>
    [...new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(text)]
      .length;
  it('keeps Vietnamese graphemes and emoji intact', () => {
    const text = 'Chào 👨‍👩‍👧‍👦 Việt Nam 🇻🇳';
    expect(bubbleLines(text, count, 12).join(' ')).toContain('👨‍👩‍👧‍👦');
    expect(bubbleLines(text, count, 12).length).toBeLessThanOrEqual(3);
  });
  it('caps long text and words at three lines with an ellipsis', () => {
    const lines = bubbleLines('a'.repeat(280), count, 20);
    expect(lines).toHaveLength(3);
    expect(lines[2].endsWith('…')).toBe(true);
    expect(lines.every((line) => count(line) <= 20)).toBe(true);
  });
});
