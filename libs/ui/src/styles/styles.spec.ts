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
  '--container-wide',
  '--container-content',
  '--container-menu',
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
