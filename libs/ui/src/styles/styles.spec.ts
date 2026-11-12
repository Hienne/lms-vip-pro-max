import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as sass from 'sass';

/**
 * The contract of the style library: what `@use 'ui'` and the global entry compile to. It uses the
 * same include path as the app build (libs/ui/src/styles), so a failure here is a failure there.
 */
const styles = join(import.meta.dirname);
const loadPaths = [styles];

const compile = (source: string): string =>
  sass.compileString(source, { loadPaths, logger: sass.Logger.silent }).css;
const compileGlobal = (): string =>
  sass.compile(join(styles, 'global.scss'), {
    loadPaths,
    logger: sass.Logger.silent,
  }).css;

/** Custom property names of today's theme (the Tailwind `@theme`), kept as the expected value. */
const LIGHT_PROPERTIES = [
  '--breakpoint-sm',
  '--breakpoint-md',
  '--breakpoint-lg',
  '--breakpoint-xl',
  '--color-certificate-paper',
  '--color-certificate-teal',
  '--color-certificate-gold',
  '--color-certificate-gold-ink',
  '--color-certificate-ink',
  '--color-certificate-navy',
  '--color-certificate-caption',
  '--color-certificate-gallery-bg',
  '--color-certificate-gallery-text',
  '--color-certificate-gallery-muted',
  '--color-certificate-gallery-border',
  '--color-certificate-gallery-action',
  '--color-primary',
  '--color-primary-hover',
  '--color-primary-strong',
  '--color-primary-subtle',
  '--color-on-primary',
  '--color-accent',
  '--color-accent-subtle',
  '--color-accent-ink',
  '--color-on-accent',
  '--color-success',
  '--color-success-subtle',
  '--color-warning',
  '--color-warning-subtle',
  '--color-danger',
  '--color-danger-subtle',
  '--color-on-danger',
  '--color-info',
  '--color-info-subtle',
  '--color-bg',
  '--color-surface',
  '--color-surface-2',
  '--color-surface-sunken',
  '--color-text',
  '--color-text-secondary',
  '--color-text-muted',
  '--color-border',
  '--color-border-strong',
  '--color-ring',
  '--color-overlay',
  '--color-white',
  '--color-black',
  '--color-on-dark-hover',
  '--color-nav-bg',
  '--color-nav-text',
  '--color-nav-muted',
  '--color-nav-strong',
  '--color-nav-hover',
  '--color-nav-active-bg',
  '--color-nav-active-text',
  '--color-nav-indicator',
  '--color-nav-border',
  '--color-nav-scrollbar-thumb',
  '--color-scrollbar-thumb',
  '--color-scrollbar-thumb-hover',
  '--color-scrollbar-track',
  '--color-hero-muted',
  '--color-hero-subtle',
  '--color-hero-accent',
  '--color-chart-1',
  '--color-chart-2',
  '--color-chart-3',
  '--color-chart-4',
  '--color-chart-5',
  '--color-chart-grid',
  '--font-certificate',
  '--font-sans',
  '--font-mono',
  '--font-display',
  '--default-font-family',
  '--default-mono-font-family',
  '--text-xs',
  '--text-sm',
  '--text-md',
  '--text-lg',
  '--text-xl',
  '--text-2xl',
  '--text-3xl',
  '--leading-tight',
  '--leading-normal',
  '--leading-relaxed',
  '--font-weight-regular',
  '--font-weight-medium',
  '--font-weight-semibold',
  '--font-weight-bold',
  '--tracking-tight',
  '--tracking-display',
  '--spacing-1',
  '--spacing-2',
  '--spacing-3',
  '--spacing-4',
  '--spacing-5',
  '--spacing-6',
  '--spacing-8',
  '--spacing-10',
  '--spacing-12',
  '--spacing-18',
  '--container-sidebar',
  '--container-sidebar-rail',
  '--container-wide',
  '--container-content',
  '--container-menu',
  '--container-popover',
  '--container-narrow',
  '--container-reading',
  '--container-panel',
  '--container-assistant',
  '--spacing-header',
  '--spacing-control',
  '--spacing-control-sm',
  '--spacing-touch',
  '--radius-full',
  '--radius-control',
  '--radius-field',
  '--radius-card',
  '--shadow-sm',
  '--shadow-md',
  '--shadow-lg',
  '--transition-duration-fast',
  '--transition-duration-base',
  '--transition-duration-slow',
  '--ease-out',
  '--default-transition-duration',
  '--default-transition-timing-function',
  '--animate-enter',
  '--animate-reward-pop',
  '--animate-shimmer',
  '--animate-spin',
  '--z-index-bar',
  '--z-index-header',
  '--z-index-sidebar',
  '--z-index-drawer',
  '--z-index-modal',
  '--z-index-toast',
];

/** The names the theme overrides in dark mode. */
const DARK_PROPERTIES = [
  '--color-primary',
  '--color-primary-hover',
  '--color-primary-strong',
  '--color-primary-subtle',
  '--color-on-primary',
  '--color-accent-subtle',
  '--color-accent-ink',
  '--color-success',
  '--color-success-subtle',
  '--color-warning',
  '--color-warning-subtle',
  '--color-danger',
  '--color-danger-subtle',
  '--color-on-danger',
  '--color-info',
  '--color-info-subtle',
  '--color-bg',
  '--color-surface',
  '--color-surface-2',
  '--color-surface-sunken',
  '--color-text',
  '--color-text-secondary',
  '--color-text-muted',
  '--color-border',
  '--color-border-strong',
  '--color-ring',
  '--color-overlay',
  '--color-chart-1',
  '--color-chart-2',
  '--color-chart-3',
  '--color-chart-4',
  '--color-chart-5',
  '--color-chart-grid',
  '--shadow-md',
  '--shadow-lg',
];

/** Innermost `selector { declarations }` blocks of a stylesheet, with the selector trimmed. */
function rules(css: string): { selector: string; body: string }[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1]
      .replace(/^[\s\S]*[;}]/, '')
      .replace(/^.*\*\/\s*/s, '')
      .trim(),
    body: match[2],
  }));
}

const propertyNames = (body: string): string[] =>
  [...body.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]);

/** The inside of the first `@layer <name> { … }` block. */
function layerBody(css: string, name: string): string {
  const start = css.indexOf(`@layer ${name} {`);
  if (start < 0) return '';
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) {
      return css.slice(css.indexOf('{', start) + 1, i);
    }
  }
  return '';
}

const SPACING_KEYS = compile(
  "@use 'ui'; @each $key, $value in ui.$spacing { .k-#{$key} { a: b; } }",
)
  .match(/\.k-(\w+)/g)!
  .map((name) => name.slice(3));

describe('ui style module', () => {
  it('builds the scrollbar mixin from the scrollbar tokens, in a default and a nav tone', () => {
    const css = compile(`
      @use 'ui';
      .a { @include ui.scrollbar; }
      .b { @include ui.scrollbar(nav); }
    `);
    expect(css).toContain(
      'scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track)',
    );
    expect(css).toContain(
      'scrollbar-color: var(--color-nav-scrollbar-thumb) var(--color-scrollbar-track)',
    );
    expect(css).toContain('scrollbar-width: thin');
    expect(css).not.toContain('::-webkit-scrollbar');
  });

  it('compiles to nothing when only used', () => {
    expect(compile("@use 'ui';").trim()).toBe('');
  });

  it('resolves tokens to the custom properties of the theme', () => {
    const css = compile(`
      @use 'ui';
      .a {
        color: ui.color(primary);
        padding: ui.space(3);
        font-size: ui.text-size(2xl);
        box-shadow: ui.shadow(md);
        min-height: ui.layout(control);
        z-index: ui.z(modal);
      }`);
    expect(css).toContain('color: var(--color-primary)');
    expect(css).toContain('padding: var(--spacing-3)');
    expect(css).toContain('font-size: var(--text-2xl)');
    expect(css).toContain('box-shadow: var(--shadow-md)');
    expect(css).toContain('min-height: var(--spacing-control)');
    expect(css).toContain('z-index: var(--z-index-modal)');
  });

  it.each([
    ['color', 'nope'],
    ['chart', 'nope'],
    ['space', '7'],
    ['radius', 'nope'],
    ['shadow', 'nope'],
    ['text-size', 'nope'],
    ['leading', 'nope'],
    ['weight', 'nope'],
    ['tracking', 'nope'],
    ['font', 'nope'],
    ['duration', 'nope'],
    ['ease', 'nope'],
    ['z', 'nope'],
    ['layout', 'nope'],
  ])('fails the build on an unknown key of ui.%s', (accessor, key) => {
    expect(() =>
      compile(`@use 'ui'; .a { b: ui.${accessor}(${key}); }`),
    ).toThrow(new RegExp(`ui\\.${accessor}: unknown key`));
  });

  it('names the valid keys in the error', () => {
    expect(() => compile("@use 'ui'; .a { b: ui.space(7); }")).toThrow(
      /Valid keys: 1, 2, 3/,
    );
  });

  it('writes breakpoints as mobile-first media queries and rejects unknown steps', () => {
    expect(compile("@use 'ui'; .a { @include ui.bp(md) { b: c; } }")).toContain(
      '@media (min-width: 720px)',
    );
    expect(() =>
      compile("@use 'ui'; .a { @include ui.bp(huge) { b: c; } }"),
    ).toThrow(/ui\.bp: unknown key/);
  });

  it('offers the one below-breakpoint query for narrow-only styles', () => {
    expect(
      compile("@use 'ui'; .a { @include ui.bp-below(md) { b: c; } }"),
    ).toContain('@media (width < 720px)');
  });

  it('builds a grid with a column count per breakpoint', () => {
    const css = compile(
      "@use 'ui'; .a { @include ui.grid((md: 2, lg: 3), 5); }",
    );
    expect(css).toContain('repeat(1, minmax(0, 1fr))');
    expect(css).toContain('gap: var(--spacing-5)');
    expect(css).toMatch(/min-width: 720px[\s\S]*repeat\(2, minmax/);
    expect(css).toMatch(/min-width: 1100px[\s\S]*repeat\(3, minmax/);
  });

  it('wraps animation in reduced motion', () => {
    expect(compile("@use 'ui'; .a { @include ui.animate(enter); }")).toMatch(
      /animation: var\(--animate-enter\)[\s\S]*prefers-reduced-motion: reduce[\s\S]*animation: none/,
    );
    expect(() =>
      compile("@use 'ui'; .a { @include ui.animate(wobble); }"),
    ).toThrow(/ui\.animate: unknown animation/);
  });
});

describe('global stylesheet', () => {
  const css = compileGlobal();
  const all = rules(css);
  const names = (selector: string) =>
    all
      .filter((rule) => rule.selector === selector)
      .flatMap((rule) => propertyNames(rule.body));

  it("emits exactly the custom properties of today's theme in light", () => {
    expect([...new Set(names(':root'))].sort()).toEqual(
      [...LIGHT_PROPERTIES].sort(),
    );
  });

  it('gives every scroll area the thin token-coloured bar from the html element', () => {
    const html = all
      .filter((rule) => rule.selector === 'html')
      .map((rule) => rule.body)
      .join(';');
    expect(html).toContain('scrollbar-color: var(--color-scrollbar-thumb)');
    expect(html).toContain('scrollbar-width: thin');
    expect(css).not.toContain('::-webkit-scrollbar');
  });

  it('emits the dark overrides behind both conditions', () => {
    const explicit = names(':root[data-theme=dark]');
    const system = names(':root:not([data-theme=light])');
    expect(explicit.sort()).toEqual([...DARK_PROPERTIES].sort());
    expect(system.sort()).toEqual(explicit);
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });

  it('prints in the light colours whatever the screen theme is', () => {
    const declared = (selector: string): Map<string, string> =>
      new Map(
        all
          .filter((rule) => rule.selector === selector)
          .flatMap((rule) =>
            [...rule.body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(
              (match): [string, string] => [match[1], match[2].trim()],
            ),
          ),
      );
    const light = declared(':root');
    const print = declared(':root:root:root:root');
    const colours = [...light.keys()].filter((name) =>
      /^--(color|shadow)-/.test(name),
    );
    expect(colours.length).toBeGreaterThan(40);
    for (const name of colours) {
      expect(print.get(name), name).toBe(light.get(name));
    }
    // Specificity (0,4,0) beats the dark values at (0,3,0), and it applies only when printing.
    expect(css).toMatch(
      /@media print \{\s*:root:root:root:root \{[^}]*color-scheme: light/,
    );
  });

  it('does not underline the links inside a table', () => {
    expect(css).toMatch(/\.table a\s*\{[^}]*text-decoration-line:\s*none/);
  });

  it('declares the layer order first', () => {
    expect(css).toMatch(/@layer reset, base, components, helpers;/);
  });

  it('puts the reset in the reset layer and the helpers in the helpers layer', () => {
    expect(layerBody(css, 'reset')).toContain('box-sizing: border-box');
    const helpers = layerBody(css, 'helpers');
    for (const name of [
      'stack',
      'row',
      'row-between',
      'grow',
      'grid-2',
      'grid-3',
      'grid-4',
      'span-2',
      'sr-only',
      'skip-link',
    ]) {
      expect(helpers).toContain(`.${name} {`);
    }
    const outside = css.replace(layerBody(css, 'helpers'), '');
    expect(outside).not.toMatch(/\.stack \{/);
    expect(css.replace(layerBody(css, 'reset'), '')).not.toContain(
      'box-sizing: border-box',
    );
  });

  it('has gap modifiers for every spacing key and only for those', () => {
    for (const helper of [
      'stack',
      'row',
      'row-between',
      'grid-2',
      'grid-3',
      'grid-4',
    ]) {
      const found = [
        ...css.matchAll(new RegExp(`\\.${helper}--gap-(\\w+) \\{`, 'g')),
      ].map((m) => m[1]);
      expect(found.sort()).toEqual([...SPACING_KEYS].sort());
    }
  });

  it('keeps the helper defaults of the mockup', () => {
    const helpers = layerBody(css, 'helpers');
    expect(helpers).toMatch(/\.stack \{[^}]*gap: var\(--spacing-4\)/);
    expect(helpers).toMatch(/\.row \{[^}]*gap: var\(--spacing-3\)/);
    expect(helpers).toMatch(/\.grid-4 \{[^}]*gap: var\(--spacing-4\)/);
  });

  it('is generated from the token source file the guard spec exempts', () => {
    expect(readFileSync(join(styles, 'ui/_tokens.scss'), 'utf8')).toContain(
      '$spacing',
    );
  });
});

describe('BIDV chuẩn refinements (SPEC.md revision 2)', () => {
  const root = Object.fromEntries(
    rules(compileGlobal())
      .filter((rule) => rule.selector === ':root')
      .flatMap((rule) =>
        [...rule.body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [
          m[1],
          m[2].trim(),
        ]),
      ),
  );

  it('gives buttons 8px corners and h1 tighter tracking', () => {
    expect(root['--radius-control']).toBe('8px');
    expect(root['--radius-field']).toBe('6px');
    expect(root['--radius-card']).toBe('14px');
    expect(root['--tracking-display']).toBe('-0.02em');
  });

  it('uses two-layer, ink-tinted shadows: a contact shadow and a long soft drop', () => {
    for (const key of ['md', 'lg']) {
      const layers = root[`--shadow-${key}`].split(/,(?![^(]*\))/);
      expect(layers).toHaveLength(2);
      expect(layers[1]).toMatch(/-\d+px rgba\(16, 40, 38, /);
    }
  });
});

describe('theme hooks', () => {
  // The rules a theme reaches through its type and shape tokens (SPEC.md decision 2).
  const all = rules(compileGlobal());
  const body = (selector: string) =>
    all
      .filter((rule) => rule.selector === selector)
      .map((rule) => rule.body)
      .join(';');

  it.each([
    ['h1,\n  h2', 'font-family: var(--font-display)'],
    ['h1', 'font-weight: var(--font-weight-semibold)'],
    ['h1', 'letter-spacing: var(--tracking-display)'],
    ['.btn', 'border-radius: var(--radius-control)'],
    ['.segmented', 'border-radius: calc(var(--radius-control) + 4px)'],
    ['.segmented__option', 'border-radius: var(--radius-control)'],
    ['.input', 'border-radius: var(--radius-field)'],
    ['.textarea', 'border-radius: var(--radius-field)'],
    ['.card', 'border-radius: var(--radius-card)'],
    ['.popover', 'border-radius: var(--radius-card)'],
  ])('%s reads %s', (selector, declaration) => {
    expect(body(selector)).toContain(declaration);
  });

  it('keeps h3 and h4 in the body font (visual-design.md: display font on h1 and h2 only)', () => {
    expect(body('h1,\n  h2,\n  h3,\n  h4')).not.toContain('--font-display');
    expect(body('h3')).not.toContain('--font-display');
    expect(body('h4')).not.toContain('--font-display');
  });

  it('has no eyebrow mixin', () => {
    expect(() => compile("@use 'ui'; .x { @include ui.eyebrow; }")).toThrow();
  });
});

/** Relative luminance of a `#rrggbb` colour (WCAG 2.x). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Blends `#rrggbb` `top` at `alpha` over `#rrggbb` `under` (what a translucent fill paints). */
function composite(top: string, alpha: number, under: string): string {
  return (
    '#' +
    [1, 3, 5]
      .map((i) => {
        const [a, b] = [top, under].map((hex) =>
          parseInt(hex.slice(i, i + 2), 16),
        );
        return Math.round(a * alpha + b * (1 - alpha))
          .toString(16)
          .padStart(2, '0');
      })
      .join('')
  );
}

/**
 * The `#rrggbb` a colour token paints: follows `var(--color-…)` references and composites a
 * `color-mix(in srgb, <colour> N%, transparent)` wash over the `under` token. Anything else is
 * returned as is, so the hex check below reports it.
 */
function paint(
  tokens: Record<string, string>,
  key: string,
  under?: string,
): string {
  const value = tokens[`--color-${key}`] ?? '';
  const ref = value.match(/^var\(--color-([\w-]+)\)$/);
  if (ref) return paint(tokens, ref[1], under);
  const wash = value.match(
    /^color-mix\(in srgb, var\(--color-([\w-]+)\) ([\d.]+)%, transparent\)$/,
  );
  if (wash && under) {
    return composite(
      paint(tokens, wash[1]),
      Number(wash[2]) / 100,
      paint(tokens, under),
    );
  }
  return value;
}

/**
 * SPEC.md Success Criterion 5: [foreground, background, minimum ratio, what a translucent
 * background sits on].
 */
const CONTRAST_RULES: readonly [string, string, number, string?][] = [
  ...['text', 'text-secondary', 'text-muted'].flatMap((fg) =>
    ['bg', 'surface', 'surface-2'].map(
      (bg) => [fg, bg, 4.5] as [string, string, number],
    ),
  ),
  ['on-primary', 'primary', 4.5],
  ['primary', 'surface', 4.5],
  ['border-strong', 'surface', 3],
  ['ring', 'surface', 3],
  ...['bg', 'surface'].map(
    (bg) => ['accent-ink', bg, 4.5] as [string, string, number],
  ),
  ['on-accent', 'accent', 4.5],
  ['nav-text', 'nav-bg', 4.5],
  ['nav-muted', 'nav-bg', 4.5],
  ['nav-strong', 'nav-bg', 4.5],
  ['nav-active-text', 'nav-active-bg', 4.5, 'nav-bg'],
];

describe('colour contrast', () => {
  const all = rules(compileGlobal());
  /** Custom property values a selector declares, the last declaration winning. */
  const values = (selector: string): Record<string, string> =>
    Object.fromEntries(
      all
        .filter((rule) => rule.selector === selector)
        .flatMap((rule) =>
          [...rule.body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
            match[1],
            match[2].trim(),
          ]),
        ),
    );

  /** What the cascade resolves on :root in light or explicit dark mode. */
  function resolved(mode: 'light' | 'dark') {
    const layers =
      mode === 'light' ? [':root'] : [':root', ':root[data-theme=dark]'];
    return Object.assign({}, ...layers.map(values)) as Record<string, string>;
  }

  it('declares no palette override: BIDV is the only palette', () => {
    expect(compileGlobal()).not.toContain('data-palette');
  });

  it.each(['light', 'dark'] as const)(
    'BIDV in %s passes the contrast rules',
    (mode) => {
      const tokens = resolved(mode);
      const pairs = CONTRAST_RULES.map(([fg, bg, min, under]) => ({
        pair: `${fg} on ${bg}`,
        fg: paint(tokens, fg),
        bg: paint(tokens, bg, under),
        min,
      }));
      // Every compared token paints a hex colour, so a missing one cannot pass as NaN.
      const unresolved = pairs.flatMap(({ pair, fg, bg }) =>
        [fg, bg].filter((hex) => !/^#[0-9a-f]{6}$/i.test(hex)).map(() => pair),
      );
      expect(unresolved).toEqual([]);
      const failures = pairs
        .map(({ pair, fg, bg, min }) => ({
          pair,
          ratio: contrast(fg, bg),
          min,
        }))
        .filter(({ ratio, min }) => ratio < min);
      expect(failures).toEqual([]);
    },
  );

  it.each(['light', 'dark'] as const)(
    'gives the five chart series distinct colours in %s, none a status colour',
    (mode) => {
      const tokens = resolved(mode);
      const series = [1, 2, 3, 4, 5].map((n) => tokens[`--color-chart-${n}`]);
      expect(new Set(series).size).toBe(5);
      const status = ['success', 'warning', 'danger', 'info', 'accent'].map(
        (name) => tokens[`--color-${name}`],
      );
      for (const colour of series) expect(status).not.toContain(colour);
    },
  );
});
