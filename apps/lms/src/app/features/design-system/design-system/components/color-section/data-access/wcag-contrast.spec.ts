import { contrastRatio, parseColor, wcagGrade } from './wcag-contrast';

describe('wcag-contrast', () => {
  it.each([
    ['#006B68', [0, 107, 104]],
    ['#fff', [255, 255, 255]],
    ['rgb(10, 20, 30)', [10, 20, 30]],
    ['rgba(10, 20, 19, 0.48)', [10, 20, 19]],
  ])('parses %s', (text, rgb) => {
    expect(parseColor(text)).toEqual(rgb);
  });

  it('returns undefined for an unknown notation', () => {
    expect(parseColor('var(--x)')).toBeUndefined();
    expect(contrastRatio('', '#fff')).toBeUndefined();
  });

  it('matches the ratios documented on the mockup page', () => {
    expect(contrastRatio('#1A1D1C', '#FFFFFF')?.toFixed(2)).toBe('16.98');
    expect(contrastRatio('#006B68', '#FFFFFF')?.toFixed(2)).toBe('6.36');
    expect(contrastRatio('#8A9694', '#FFFFFF')?.toFixed(2)).toBe('3.06');
  });

  it('grades text at 4.5:1 and 7:1 and control borders at 3:1', () => {
    expect(wcagGrade(7.73, false)).toBe('AAA');
    expect(wcagGrade(5.54, false)).toBe('AA');
    expect(wcagGrade(4.49, false)).toBe('fail');
    expect(wcagGrade(3.06, true)).toBe('ui');
    expect(wcagGrade(2.9, true)).toBe('fail');
  });
});
