import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import * as sass from 'sass';
import { THEME_PALETTES } from './core/theme/theme.store';

/**
 * Guards the styling rules (docs/conventions/ui-library.md → Styling):
 *  - every class a template, class binding or class string writes is a BEM class defined by some
 *    stylesheet, one of the layout helpers, or a helper's gap modifier;
 *  - nothing outside `@lms/ui` writes a design-system block class (`btn btn--primary`): templates
 *    use the atom instead;
 *  - no stylesheet outside the token source writes a colour literal;
 *  - nothing references Tailwind or PostCSS any more;
 *  - only `ThemeStore` writes the theme and palette attributes.
 */

const root = join(import.meta.dirname, '../../../..');
const appSource = join(root, 'apps/lms/src');
const uiSource = join(root, 'libs/ui/src');
const stylesRoot = join(uiSource, 'styles');
const tokenSource = join(stylesRoot, 'ui/_tokens.scss');
const helperSource = join(stylesRoot, 'global/_helpers.scss');

/** The closed set of layout helpers (global/_helpers.scss), taken from the mockup. */
const HELPERS = [
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
];
/** Helpers that take a `--gap-<spacing key>` modifier. */
const GAP_HELPERS = [
  'stack',
  'row',
  'row-between',
  'grid-2',
  'grid-3',
  'grid-4',
];

/**
 * Classes that carry no style: markup hooks that specs query. Adding one here is a deliberate
 * choice; a class that should look like something is defined in a stylesheet instead.
 */
const HOOKS = ['sortable', 'stars__star', 'timer__time', 'tip-note__body'];

/** BEM blocks of the mockup's components.css. */
const MOCKUP_BLOCKS = [
  'icon',
  'btn',
  'icon-btn',
  'link-btn',
  'card',
  'kpi',
  'badge',
  'chip',
  'avatar',
  'avatar-group',
  'progress',
  'progress-ring',
  'ring',
  'tabs',
  'segmented',
  'table',
  'table-wrap',
  'bulk-bar',
  'pagination',
  'field',
  'input',
  'select',
  'textarea',
  'input-group',
  'input-icon',
  'check',
  'switch',
  'error-summary',
  'option-card',
  'dropzone',
  'upload-item',
  'menu',
  'modal',
  'drawer',
  'toasts',
  'toast',
  'alert',
  'tip',
  'skeleton',
  'spinner',
  'empty',
  'breadcrumb',
  'stepper',
  'tree',
  'rating',
  'stars-static',
  'mai',
  'mai-badge',
];

const BEM =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const isSource = (file: string) =>
  /\.(html|ts)$/.test(file) && !file.endsWith('.spec.ts');

const loadPaths = [stylesRoot];

/** Class names a compiled stylesheet defines, taken from its class selectors. */
const definedClasses = (css: string): string[] =>
  [...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((match) => match[1]);

/** Spacing token keys, read from the token source through Sass itself. */
function spacingKeys(): string[] {
  const css = sass.compileString(
    "@use 'ui'; @each $key, $value in ui.$spacing { .k-#{$key} { a: b; } }",
    { loadPaths, logger: sass.Logger.silent },
  ).css;
  return [...css.matchAll(/\.k-(\w+)/g)].map((match) => match[1]);
}

/**
 * Classes the global entry defines (atoms, helpers) and, per folder, the classes of the component
 * stylesheets beside the templates. View encapsulation scopes a component's own `.scss` to that
 * component, so a template may use the global classes and the ones its own folder defines.
 */
function stylesheetClasses(): {
  global: Set<string>;
  byFolder: Map<string, Set<string>>;
} {
  const compile = (entry: string) =>
    definedClasses(
      sass.compile(entry, { loadPaths, logger: sass.Logger.silent }).css,
    );
  const global = new Set(compile(join(stylesRoot, 'global.scss')));
  const byFolder = new Map<string, Set<string>>();
  for (const file of [...walk(appSource), ...walk(uiSource)]) {
    if (!file.endsWith('.scss') || file.startsWith(stylesRoot)) continue;
    if (/[\\/]_[^\\/]*$/.test(file)) continue;
    const folder = dirname(file);
    const found = byFolder.get(folder) ?? new Set<string>();
    compile(file).forEach((name) => found.add(name));
    byFolder.set(folder, found);
  }
  return { global, byFolder };
}

function uiBlocks(): string[] {
  const partials = join(stylesRoot, 'components');
  const found = walk(partials)
    .filter((file) => file.endsWith('.scss'))
    .flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/(?<![\w-])\.([a-z][a-z0-9-]*)/g)]
        .map((match) => match[1])
        .filter((name) => !name.includes('--')),
    );
  return [...new Set([...MOCKUP_BLOCKS, ...found])];
}

function violatesBlockClass(token: string, blocks: readonly string[]): boolean {
  return blocks.some(
    (block) =>
      token === block ||
      token.startsWith(`${block}--`) ||
      token.startsWith(`${block}__`),
  );
}

/**
 * Why a class token is not allowed, or null when it is. `defined` is the set of classes some
 * stylesheet defines. A token ending in `-` is the static prefix of a name built at runtime
 * (`'btn--' + variant`): some defined class must start with it.
 */
function classProblem(
  token: string,
  defined: ReadonlySet<string>,
  spacing: readonly string[],
): string | null {
  if (HELPERS.includes(token) || HOOKS.includes(token)) return null;
  const gap = /^(.+)--gap-(.+)$/.exec(token);
  if (gap && GAP_HELPERS.includes(gap[1])) {
    return spacing.includes(gap[2])
      ? null
      : `\`${gap[2]}\` is not a spacing token (${spacing.join(', ')})`;
  }
  if (token.endsWith('-')) {
    return [...defined].some((name) => name.startsWith(token))
      ? null
      : 'no stylesheet defines a class with this prefix';
  }
  if (!BEM.test(token)) return 'not a BEM class';
  return defined.has(token) ? null : 'no stylesheet defines this class';
}

/** Whitespace-separated class tokens of a string, minus interpolations (`toast--{{ kind }}`). */
const tokensOf = (text: string): string[] =>
  text
    .replace(/\{\{[^}]*\}\}|\$\{[^}]*\}/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** Quoted string literals inside a binding expression; one followed by `+` ends in a runtime part. */
function literalTokens(expression: string): string[] {
  return [...expression.matchAll(/(["'`])((?:(?!\1).)*)\1(\s*\+)?/g)].flatMap(
    (match) => {
      const tokens = tokensOf(match[2]);
      const last = tokens.length - 1;
      if (
        match[3] &&
        last >= 0 &&
        !match[2].endsWith(' ') &&
        !tokens[last].endsWith('-')
      ) {
        tokens[last] += '-';
      }
      return tokens;
    },
  );
}

/**
 * Class tokens written in `class="…"` attributes, `[class.x]` bindings, `[class]="…"` bindings,
 * and the `class:` / `'[class]'` / `'[class.x]'` entries of host metadata.
 */
function classTokens(source: string): string[] {
  // Doc comments show example markup; only real code counts.
  const text = source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const attributes = [
    ...text.matchAll(/(?<![\w[-])class\s*=\s*(?:"([^"]*)"|'([^']*)')/g),
  ].flatMap((match) => tokensOf(match[1] ?? match[2] ?? ''));
  const bindings = [...text.matchAll(/\[class\.([\w-]+)\]/g)].map(
    (match) => match[1],
  );
  const hostClass = [
    ...text.matchAll(/(?<![\w[-])class:\s*(?:'([^']*)'|"([^"]*)")/g),
  ].flatMap((match) => tokensOf(match[1] ?? match[2] ?? ''));
  const dynamic = [
    ...text.matchAll(/\[class\]\s*=\s*"([^"]*)"/g),
    ...text.matchAll(/'\[class\]'\s*:\s*(?:'([^']*)'|"([^"]*)")/g),
  ].flatMap((match) => literalTokens(match[1] ?? match[2] ?? ''));
  return [...attributes, ...bindings, ...hostClass, ...dynamic];
}

describe('template scan', () => {
  const appFiles = walk(appSource).filter(isSource);
  const uiFiles = walk(uiSource).filter(isSource);
  const scssFiles = [...walk(appSource), ...walk(uiSource)].filter((file) =>
    file.endsWith('.scss'),
  );

  it('finds the sources it is supposed to scan', () => {
    expect(appFiles.length).toBeGreaterThan(0);
    expect(uiFiles.length).toBeGreaterThan(0);
    expect(scssFiles.length).toBeGreaterThan(0);
  });

  it.each(['data-theme', 'data-palette'])(
    'writes %s in ThemeStore only',
    (attribute) => {
      const offenders = [...appFiles, ...uiFiles].filter(
        (file) =>
          // index.html carries the pre-boot script that applies the stored choice.
          !file.endsWith('theme.store.ts') &&
          !file.endsWith('index.html') &&
          readFileSync(file, 'utf8').includes(attribute),
      );
      expect(offenders.map((file) => relative(root, file))).toEqual([]);
    },
  );

  it('keeps the palette list of ThemeStore, the pre-boot script and the tokens in sync', () => {
    const others = THEME_PALETTES.filter((palette) => palette !== 'bidv');
    const css = sass.compile(join(stylesRoot, 'global.scss'), {
      loadPaths,
      logger: sass.Logger.silent,
    }).css;
    const tokenPalettes = [
      ...new Set(
        [...css.matchAll(/:root\[data-palette=([\w-]+)\]/g)].map(
          (match) => match[1],
        ),
      ),
    ];
    const script = readFileSync(join(appSource, 'index.html'), 'utf8');
    const scriptPalettes = [...script.matchAll(/palette === '([\w-]+)'/g)].map(
      (match) => match[1],
    );
    expect(tokenPalettes).toEqual(others);
    expect(scriptPalettes).toEqual(others);
  });

  it('paints the sidebar with the nav tokens only, so a theme can restyle it', () => {
    const sidebar = readFileSync(
      join(appSource, 'app/layout/sidebar/sidebar.scss'),
      'utf8',
    );
    const colours = [...sidebar.matchAll(/ui\.color\(([\w-]+)\)/g)].map(
      (match) => match[1],
    );
    expect(colours.length).toBeGreaterThan(0);
    expect(colours.filter((key) => !key.startsWith('nav-'))).toEqual([]);
    expect(sidebar).not.toContain('color-mix(');
  });

  it('bundles the self-hosted files of every font a theme can name', () => {
    // `ui.$font-stacks`: the faces a theme's type group may use; each one is self-hosted
    // (`@fontsource/<kebab name>`, never Google Fonts) and listed in the build styles.
    const css = sass.compileString(
      "@use 'ui'; @each $name, $stack in ui.$font-stacks { .f { family: $stack; } }",
      { loadPaths, logger: sass.Logger.silent },
    ).css;
    const families = [...css.matchAll(/family: ["']([^"']+)["']/g)].map(
      (match) => match[1],
    );
    expect(families).toEqual(
      expect.arrayContaining(['Be Vietnam Pro', 'Fraunces', 'Nunito Sans']),
    );
    const styles: string[] = JSON.parse(
      readFileSync(join(root, 'apps/lms/project.json'), 'utf8'),
    ).targets.build.options.styles;
    for (const family of families) {
      const pkg = `@fontsource/${family.toLowerCase().replaceAll(' ', '-')}/`;
      expect(styles.some((style) => style.startsWith(pkg))).toBe(true);
    }
  });

  it('writes only BEM classes, layout helpers and their gap modifiers', () => {
    const { global, byFolder } = stylesheetClasses();
    const spacing = spacingKeys();
    const offenders = [...appFiles, ...uiFiles].flatMap((file) => {
      const defined = new Set([
        ...global,
        ...(byFolder.get(dirname(file)) ?? []),
      ]);
      return classTokens(readFileSync(file, 'utf8'))
        .map((token) => ({
          token,
          problem: classProblem(token, defined, spacing),
        }))
        .filter(({ problem }) => problem !== null)
        .map(
          ({ token, problem }) =>
            `${relative(root, file)}: ${token} (${problem})`,
        );
    });
    expect(offenders).toEqual([]);
  });

  it('keeps style values out of TypeScript: modifier names only', () => {
    // A data field of class strings (`classes: 'rounded-sm'`) or `ngClass` hides utilities from the
    // scan above; return a BEM modifier name instead (`modifier: 'radius-sample--sm'`).
    const offenders = [...appFiles, ...uiFiles].filter((file) =>
      /\bngClass\b|\b(?:classes|classNames?|cssClass(?:es)?)\s*:/.test(
        readFileSync(file, 'utf8'),
      ),
    );
    expect(offenders.map((file) => relative(root, file))).toEqual([]);
  });

  it('writes no design-system block class outside @lms/ui', () => {
    const blocks = uiBlocks();
    const offenders = appFiles.flatMap((file) =>
      classTokens(readFileSync(file, 'utf8'))
        .filter((token) => violatesBlockClass(token, blocks))
        .map((token) => `${relative(root, file)}: ${token}`),
    );
    expect(offenders).toEqual([]);
  });

  it('writes no colour literal outside the token source', () => {
    const offenders = scssFiles
      .filter((file) => file !== tokenSource)
      .filter((file) =>
        /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(
          readFileSync(file, 'utf8')
            // `//` comments may mention a colour or an issue number.
            .replace(/^\s*\/\/.*$/gm, ''),
        ),
      );
    expect(offenders.map((file) => relative(root, file))).toEqual([]);
  });

  it('references neither Tailwind nor PostCSS', () => {
    const configs = [
      'package.json',
      'nx.json',
      'tsconfig.base.json',
      'eslint.config.mjs',
      'vitest.config.mts',
      'apps/lms/project.json',
      'libs/ui/project.json',
    ].map((file) => join(root, file));
    const files = [...appFiles, ...uiFiles, ...scssFiles, ...configs].filter(
      // The reset keeps the licence note of the preflight it copies.
      (file) => !file.endsWith('_reset.scss'),
    );
    const offenders = files.filter((file) =>
      /tailwind|postcss/i.test(readFileSync(file, 'utf8')),
    );
    expect(offenders.map((file) => relative(root, file))).toEqual([]);
    const strays = readdirSync(root).filter((name) =>
      /^(\.postcssrc|postcss\.config|tailwind\.config)/.test(name),
    );
    expect(strays).toEqual([]);
  });

  it('keeps the helper file and the spec list of helpers in step', () => {
    const source = readFileSync(helperSource, 'utf8');
    const written = [...source.matchAll(/^ {2}\.([a-z0-9-]+) \{/gm)].map(
      (match) => match[1],
    );
    expect(written.sort()).toEqual([...HELPERS].sort());
  });

  describe('the scanner', () => {
    const defined = new Set([
      'course-card',
      'course-card__title',
      'btn',
      'btn--primary',
      'skeleton--title',
    ]);
    const spacing = ['1', '2', '3'];
    const problem = (token: string) => classProblem(token, defined, spacing);

    it('lets BEM classes, helpers and gap modifiers through', () => {
      expect(problem('course-card__title')).toBeNull();
      expect(problem('row')).toBeNull();
      expect(problem('grid-3')).toBeNull();
      expect(problem('row--gap-2')).toBeNull();
      expect(problem('stack--gap-3')).toBeNull();
    });

    it('fails a gap modifier whose key is not a spacing token', () => {
      expect(problem('row--gap-7')).toMatch(/not a spacing token/);
      expect(problem('grid-2--gap-14')).toMatch(/not a spacing token/);
    });

    it('fails a modifier on something that is not a gap helper', () => {
      expect(problem('grow--gap-2')).toMatch(/not a BEM class|no stylesheet/);
    });

    it('fails a utility class', () => {
      expect(problem('flex')).toMatch(/no stylesheet defines/);
      expect(problem('text-sm')).toMatch(/no stylesheet defines/);
      expect(problem('md:grid-cols-2')).toBe('not a BEM class');
      expect(problem('w-[260px]')).toBe('not a BEM class');
      expect(problem('Foo')).toBe('not a BEM class');
    });

    it('accepts the static prefix of a runtime-built class only when a class has it', () => {
      expect(problem('skeleton--')).toBeNull();
      expect(problem('flex-')).toMatch(
        /no stylesheet defines a class with this prefix/,
      );
    });

    it('flags a block class, its modifiers and elements', () => {
      const blocks = uiBlocks();
      expect(violatesBlockClass('btn', blocks)).toBe(true);
      expect(violatesBlockClass('btn--primary', blocks)).toBe(true);
      expect(violatesBlockClass('card__header', blocks)).toBe(true);
      expect(violatesBlockClass('table', blocks)).toBe(true);
      expect(violatesBlockClass('skip-link', blocks)).toBe(false);
      expect(violatesBlockClass('course-card', blocks)).toBe(false);
    });

    it('reads classes from attributes, bindings and host metadata', () => {
      expect(classTokens('<a class="btn  x" [class.card--tint]="y">')).toEqual([
        'btn',
        'x',
        'card--tint',
      ]);
      expect(
        classTokens("host: { class: 'avatar', '[class.is-on]': 'on()' }"),
      ).toEqual(['is-on', 'avatar']);
    });

    it('reads the literals of a class binding and marks runtime prefixes', () => {
      expect(
        classTokens(
          `<div [class]="'course-card__cover course-card__cover--' + cover"></div>`,
        ),
      ).toEqual(['course-card__cover', 'course-card__cover--']);
      expect(
        classTokens(`<span class="toast--{{ kind }} toast__body"></span>`),
      ).toEqual(['toast--', 'toast__body']);
      expect(classTokens('/** <label class="demo"> */ const a = 1;')).toEqual(
        [],
      );
    });
  });
});
