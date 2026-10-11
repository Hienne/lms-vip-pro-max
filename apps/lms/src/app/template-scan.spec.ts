import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Guards two rules that keep theme and look inside the design system:
 *  - nothing writes a `dark:` utility (dark mode is token values only);
 *  - nothing outside `@lms/ui` writes a design-system block class (`btn btn--primary`):
 *    templates use the atom instead.
 * docs/conventions/ui-library.md → Styling.
 */

const root = join(import.meta.dirname, '../../../..');
const appSource = join(root, 'apps/lms/src');
const uiSource = join(root, 'libs/ui/src');

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

/** Block names that are also Tailwind utilities: only their `--modifier` and `__element` forms are flagged. */
const UTILITY_NAMES = new Set(['table', 'ring', 'progress', 'transition']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const isSource = (file: string) =>
  /\.(html|ts)$/.test(file) && !file.endsWith('.spec.ts');

function uiBlocks(): string[] {
  const partials = join(uiSource, 'styles/components');
  let found: string[] = [];
  try {
    found = walk(partials)
      .filter((file) => file.endsWith('.scss'))
      .flatMap((file) =>
        [
          ...readFileSync(file, 'utf8').matchAll(
            /(?<![\w-])\.([a-z][a-z0-9-]*)/g,
          ),
        ]
          .map((match) => match[1])
          .filter((name) => !name.includes('--')),
      );
  } catch {
    // no partials yet
  }
  return [...new Set([...MOCKUP_BLOCKS, ...found])];
}

function violatesBlockClass(token: string, blocks: readonly string[]): boolean {
  return blocks.some((block) => {
    if (token.startsWith(`${block}--`) || token.startsWith(`${block}__`)) {
      return true;
    }
    return token === block && !UTILITY_NAMES.has(block);
  });
}

/** Class tokens written statically in `class="…"` attributes and `[class.x]` bindings. */
function classTokens(text: string): string[] {
  const attributes = [
    ...text.matchAll(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/g),
  ]
    .flatMap((match) => (match[1] ?? match[2] ?? '').split(/\s+/))
    .filter(Boolean);
  const bindings = [...text.matchAll(/\[class\.([\w-]+)\]/g)].map((m) => m[1]);
  return [...attributes, ...bindings];
}

describe('template scan', () => {
  const appFiles = walk(appSource).filter(isSource);
  const uiFiles = walk(uiSource).filter(isSource);

  it('finds the sources it is supposed to scan', () => {
    expect(appFiles.length).toBeGreaterThan(0);
  });

  it('has no `dark:` utility anywhere', () => {
    const offenders = [...appFiles, ...uiFiles].filter((file) =>
      /(?<![\w-])dark:[a-z[]/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders.map((file) => relative(root, file))).toEqual([]);
  });

  it('writes the theme attribute in ThemeStore only', () => {
    const offenders = [...appFiles, ...uiFiles].filter(
      (file) =>
        // index.html carries the pre-boot script that applies the stored choice.
        !file.endsWith('theme.store.ts') &&
        !file.endsWith('index.html') &&
        readFileSync(file, 'utf8').includes('data-theme'),
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

  describe('the scanner', () => {
    it('flags a block class, its modifiers and elements', () => {
      const blocks = uiBlocks();
      expect(violatesBlockClass('btn', blocks)).toBe(true);
      expect(violatesBlockClass('btn--primary', blocks)).toBe(true);
      expect(violatesBlockClass('card__header', blocks)).toBe(true);
    });

    it('leaves Tailwind utilities alone, including the ones named like a block', () => {
      const blocks = uiBlocks();
      expect(violatesBlockClass('table', blocks)).toBe(false);
      expect(violatesBlockClass('ring', blocks)).toBe(false);
      expect(violatesBlockClass('table--responsive', blocks)).toBe(true);
      expect(violatesBlockClass('bg-primary', blocks)).toBe(false);
      expect(violatesBlockClass('skip-link', blocks)).toBe(false);
    });

    it('reads classes from attributes and class bindings', () => {
      expect(classTokens('<a class="btn  x" [class.card--tint]="y">')).toEqual([
        'btn',
        'x',
        'card--tint',
      ]);
    });
  });
});
