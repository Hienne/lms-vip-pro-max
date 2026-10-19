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
  '--color-cover-layers',
  '--color-cover-process',
  '--color-cover-clock',
  '--color-cover-building',
  '--color-cover-database',
  '--color-cover-shield',
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
  '--color-hero-from',
  '--color-hero-to',
  '--color-hero-muted',
  '--color-hero-subtle',
  '--color-hero-accent',
  '--color-hero-chip',
  '--color-chart-1',
  '--color-chart-2',
  '--color-chart-3',
  '--color-chart-4',
  '--color-chart-5',
  '--color-chart-grid',
  '--color-swatch-bidv-fill',
  '--color-swatch-bidv-base',
  '--color-swatch-bidv-soft-fill',
  '--color-swatch-bidv-soft-base',
  '--color-swatch-blue-fill',
  '--color-swatch-blue-base',
  '--color-swatch-sand-fill',
  '--color-swatch-sand-base',
  '--font-sans',
  '--font-mono',
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
  '--tracking-wide',
  '--tracking-wider',
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
  '--spacing-header',
  '--spacing-control',
  '--spacing-control-sm',
  '--spacing-touch',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--radius-xl',
  '--radius-full',
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
  '--color-cover-layers',
  '--color-cover-process',
  '--color-cover-clock',
  '--color-cover-building',
  '--color-cover-database',
  '--color-cover-shield',
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
  '--color-hero-from',
  '--color-hero-to',
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

  it('emits the dark overrides behind both conditions', () => {
    const explicit = names(':root[data-theme=dark]');
    const system = names(':root:not([data-theme=light])');
    expect(explicit.sort()).toEqual([...DARK_PROPERTIES].sort());
    expect(system.sort()).toEqual(explicit);
    expect(css).toContain('@media (prefers-color-scheme: dark)');
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

/** SPEC.md Success Criterion 5: [foreground, background, minimum ratio]. */
const CONTRAST_RULES: readonly [string, string, number][] = [
  ...['text', 'text-secondary', 'text-muted'].flatMap((fg) =>
    ['bg', 'surface', 'surface-2'].map(
      (bg) => [fg, bg, 4.5] as [string, string, number],
    ),
  ),
  ['on-primary', 'primary', 4.5],
  ['primary', 'surface', 4.5],
  ['border-strong', 'surface', 3],
  ['ring', 'surface', 3],
  ['hero-muted', 'hero-to', 4.5],
];

describe('colour palettes', () => {
  const css = compileGlobal();
  const all = rules(css);
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
  const ids = [
    ...new Set(
      [...css.matchAll(/:root\[data-palette=([\w-]+)\]/g)].map(
        (match) => match[1],
      ),
    ),
  ];
  const emitPalettes = (palettes: string) =>
    compile(`@use 'global/palettes'; @include palettes.emit(${palettes});`);

  /** What the cascade resolves on :root for a palette in light or explicit dark mode. */
  function resolved(id: string, mode: 'light' | 'dark') {
    const palette = id === 'bidv' ? '' : `[data-palette=${id}]`;
    const layers =
      mode === 'light'
        ? [':root', `:root${palette}`]
        : [
            ':root',
            ':root[data-theme=dark]',
            `:root${palette}`,
            `:root${palette}[data-theme=dark]`,
          ];
    return Object.assign({}, ...layers.map(values)) as Record<string, string>;
  }

  it('declares a constant swatch per palette from its light primary and bg', () => {
    const root = values(':root');
    expect(root['--color-swatch-bidv-fill']).toBe('#006b68');
    expect(root['--color-swatch-bidv-base']).toBe('#f5f8f8');
    for (const id of ids) {
      const light = values(`:root[data-palette=${id}]`);
      expect(root[`--color-swatch-${id}-fill`]).toBe(light['--color-primary']);
      expect(root[`--color-swatch-${id}-base`]).toBe(light['--color-bg']);
    }
    expect(css).not.toMatch(/data-theme=dark\][^{]*\{[^}]*--color-swatch/);
  });

  it('emits no override block for the default bidv palette', () => {
    expect(css).not.toContain('data-palette=bidv]');
    expect(ids).toEqual(['bidv-soft', 'blue', 'sand']);
  });

  it.each(['bidv-soft', 'blue', 'sand'])(
    'emits %s in light, in explicit dark and in system dark, with the same keys in both dark rules',
    (id) => {
      const light = Object.keys(values(`:root[data-palette=${id}]`));
      const explicit = Object.keys(
        values(`:root[data-palette=${id}][data-theme=dark]`),
      );
      const system = Object.keys(
        values(`:root[data-palette=${id}]:not([data-theme=light])`),
      );
      expect(light.length).toBeGreaterThan(0);
      expect(system.sort()).toEqual(explicit.sort());
      expect(explicit).toEqual(expect.arrayContaining(light));
    },
  );

  it.each(
    ['bidv', ...ids].flatMap(
      (id) =>
        [
          [id, 'light'],
          [id, 'dark'],
        ] as [string, 'light' | 'dark'][],
    ),
  )('%s in %s passes the contrast rules', (id, mode) => {
    const tokens = resolved(id, mode);
    // Every compared token is a resolved hex colour, so a missing one cannot pass as NaN.
    const unresolved = CONTRAST_RULES.flatMap(([fg, bg]) => [fg, bg]).filter(
      (key) => !/^#[0-9a-f]{6}$/i.test(tokens[`--color-${key}`] ?? ''),
    );
    expect(unresolved).toEqual([]);
    const failures = CONTRAST_RULES.map(([fg, bg, min]) => ({
      pair: `${fg} on ${bg}`,
      ratio: contrast(tokens[`--color-${fg}`], tokens[`--color-${bg}`]),
      min,
    })).filter(({ ratio, min }) => ratio < min);
    expect(failures).toEqual([]);
  });

  describe('guards', () => {
    const colors = '(primary: #000000)';
    it('accepts a palette whose dark map covers its light map', () => {
      expect(
        emitPalettes(
          `(x: (light: (colors: ${colors}), dark: (colors: ${colors})))`,
        ),
      ).toContain(':root[data-palette=x]');
    });

    it('fails on a light key with no dark value', () => {
      expect(() =>
        emitPalettes(`(x: (light: (colors: ${colors}), dark: (colors: ())))`),
      ).toThrow(
        /palette x: colors key `primary` has a light value but no dark value/,
      );
    });

    it('fails on a key that is not a palette key', () => {
      expect(() =>
        emitPalettes(
          `(x: (light: (colors: (danger: #000000)), dark: (colors: (danger: #000000))))`,
        ),
      ).toThrow(
        /palette x: colors key `danger` \(light\) is not a palette key/,
      );
    });

    it('fails on a chart key that is not a palette key', () => {
      expect(() =>
        emitPalettes(
          `(x: (light: (chart: (3: #000000)), dark: (chart: (3: #000000))))`,
        ),
      ).toThrow(/palette x: chart key `3` \(light\) is not a palette key/);
    });

    it('fails on a missing mode, an unknown group and the reserved bidv id', () => {
      expect(() => emitPalettes(`(x: (light: (colors: ${colors})))`)).toThrow(
        /palette x: missing its dark map/,
      );
      expect(() =>
        emitPalettes(`(x: (light: (shadows: ()), dark: ()))`),
      ).toThrow(/palette x: unknown group `shadows`/);
      expect(() => emitPalettes(`(bidv: (light: (), dark: ()))`)).toThrow(
        /palette bidv is the default/,
      );
    });
  });
});
