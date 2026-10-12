export type Rgb = readonly [red: number, green: number, blue: number];

/** Parses the colour notations used by the theme tokens: `#rgb`, `#rrggbb`, `rgb()` and `rgba()`. */
export function parseColor(value: string): Rgb | undefined {
  const text = value.trim().toLowerCase();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text)?.[1];
  if (hex) {
    const full =
      hex.length === 3
        ? [...hex].map((digit) => digit + digit).join('')
        : hex.slice(0, 6);
    return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16)) as [
      number,
      number,
      number,
    ];
  }

  const channels = /^rgba?\(([^)]+)\)$/.exec(text)?.[1]?.split(/[\s,/]+/);
  if (channels && channels.length >= 3) {
    const rgb = channels.slice(0, 3).map(Number);
    if (rgb.every((channel) => Number.isFinite(channel))) {
      return rgb as unknown as Rgb;
    }
  }
  return undefined;
}

function luminance([red, green, blue]: Rgb): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const unit = channel / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two colours, or `undefined` when either cannot be parsed. */
export function contrastRatio(
  foreground: string,
  background: string,
): number | undefined {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!fg || !bg) return undefined;
  const [a, b] = [luminance(fg), luminance(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export type WcagGrade = 'AAA' | 'AA' | 'ui' | 'fail';

/**
 * Text pairs need 4.5:1 (AA) or 7:1 (AAA); control borders are non-text UI and need 3:1,
 * as in the mockup's contrast table.
 */
export function wcagGrade(ratio: number, isControlBorder: boolean): WcagGrade {
  if (isControlBorder) return ratio >= 3 ? 'ui' : 'fail';
  if (ratio >= 7) return 'AAA';
  return ratio >= 4.5 ? 'AA' : 'fail';
}
