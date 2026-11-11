import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Design-drift ratchet (docs/conventions/visual-design.md → Drift guard).
 *
 * Screens must take their look from `@lms/ui`; a feature stylesheet or template that paints its own
 * shape, shadow, font or small print is how screens built by different people drift apart. Each
 * rule below counts those uses per file under `apps/lms/src/app`. The counts in
 * `design-drift.baseline.json` are the debt that existed when the guard was added:
 *  - a file may never go above its baseline, and a file not in the baseline is allowed zero;
 *  - a file that drops below its baseline fails until the baseline is lowered, so a fix is locked in.
 *
 * Lower the baseline after a fix with `DESIGN_DRIFT_UPDATE=1` (see `npm run guard:design:update`).
 * That mode only ever lowers counts and drops entries; it never raises one or adds a file.
 *
 * One line can opt out with a trailing comment `design-drift-allow: <rule> <reason>` (reason of at
 * least 10 characters). It shows in review; use it for a real exception, never to pass the guard.
 */

const root = join(import.meta.dirname, '../../../..');
const scanned = join(root, 'apps/lms/src/app');
const baselineFile = join(import.meta.dirname, 'design-drift.baseline.json');

interface Rule {
  readonly in: 'scss' | 'html';
  readonly pattern: RegExp;
  /** What to do instead, printed with each failure. */
  readonly instead: string;
}

const RULES: Record<string, Rule> = {
  'own-radius': {
    in: 'scss',
    pattern: /\bborder(?:-[a-z]+)*-radius\s*:/g,
    instead:
      'take the shape from the atom (uiCard, uiButton, uiInput); a new shape is a libs/ui change',
  },
  'own-shadow': {
    in: 'scss',
    pattern: /\bbox-shadow\s*:|\bui\.shadow\(/g,
    instead:
      'only overlays from libs/ui float (menu, popover, dialog, drawer, toast); use a 1px border',
  },
  'own-font': {
    in: 'scss',
    pattern: /\bfont-family\s*:|\bui\.font\(/g,
    instead:
      'headings get their face from the base styles; use ui-page-header for h1',
  },
  'text-xs': {
    in: 'scss',
    pattern: /\bui\.text\(\s*xs\b|\bui\.text-size\(\s*xs\s*\)/g,
    instead: 'xs (12px) is for timestamps and footnotes only; use sm',
  },
  'subtle-fill': {
    in: 'scss',
    pattern: /\bbackground(?:-color)?\s*:[^;]*-subtle\)/g,
    instead:
      'a *-subtle fill is for a state the user must notice (alert, selected row), not a tile or cover',
  },
  'weight-bold': {
    in: 'scss',
    pattern: /\bui\.weight\(\s*bold\s*\)/g,
    instead: 'three weights per screen: regular, medium, semibold',
  },
  'transform-move': {
    in: 'scss',
    pattern: /\btranslate(?:[XYZ]|3d)?\(/g,
    instead:
      'no hover lift, slide-in or parallax on page content; overlays live in libs/ui',
  },
  'own-h1': {
    in: 'html',
    pattern: /<h1[\s>]/g,
    instead: 'every page title is <ui-page-header title="…" description="…">',
  },
};

/**
 * Rules read across lines, inside a table's action cells only: a `<td>` labelled "Thao tác" or
 * classed `…action…`, or a `ui-data-table` `actions` cell template. A row action is a button
 * (visual-design.md → Tables), never a text link or a ghost button that reads as text.
 */
const CELL_RULES: Record<
  string,
  { readonly pattern: RegExp; readonly instead: string }
> = {
  'text-row-action': {
    pattern:
      /<a\b(?![^>]*\bui(?:Button|IconButton|TablePrimary)\b)[^>]*>|\buiLinkButton\b|<(?:a|button)\b(?=[^>]*\buiButton\b)[^>]*\bvariant="(?:ghost|danger-ghost)"[^>]*>/g,
    instead:
      'a row action is uiIconButton (with its label) or a secondary uiButton, a third one goes in ui-menu',
  },
};

const ACTION_CELL =
  /<td\b[^>]*(?:data-label="Thao tác"|class="[^"]*action[^"]*")[^>]*>[\s\S]*?<\/td>|<ng-template\b[^>]*uiDataTableCell="actions"[^>]*>[\s\S]*?<\/ng-template>/g;

type Counts = Record<string, Record<string, number>>;

const ALLOW = /design-drift-allow:\s*([\w-]+)\s+(.{10,})$/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Uses of each rule in one file's text, skipping comments and allowed lines. */
function countIn(text: string, kind: 'scss' | 'html'): Record<string, number> {
  const lines = text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (block) => block.replace(/[^\n]/g, ' '))
    .split(/\r?\n/);
  const counts: Record<string, number> = {};
  for (const raw of lines) {
    const allowed = ALLOW.exec(raw)?.[1];
    const line = kind === 'scss' ? raw.replace(/(^|\s)\/\/.*$/, '') : raw;
    for (const [name, rule] of Object.entries(RULES)) {
      if (rule.in !== kind || allowed === name) continue;
      const hits = line.match(rule.pattern)?.length ?? 0;
      if (hits) counts[name] = (counts[name] ?? 0) + hits;
    }
  }
  if (kind === 'html') {
    const cells = text.replace(/<!--[\s\S]*?-->/g, '').match(ACTION_CELL) ?? [];
    for (const [name, rule] of Object.entries(CELL_RULES)) {
      const hits = cells.reduce(
        (sum, cell) => sum + (cell.match(rule.pattern)?.length ?? 0),
        0,
      );
      if (hits) counts[name] = (counts[name] ?? 0) + hits;
    }
  }
  return counts;
}

function scan(): Counts {
  const result: Counts = {};
  for (const file of walk(scanned)) {
    const kind = file.endsWith('.scss')
      ? 'scss'
      : file.endsWith('.html')
        ? 'html'
        : null;
    if (!kind) continue;
    const counts = countIn(readFileSync(file, 'utf8'), kind);
    if (Object.keys(counts).length) {
      result[relative(root, file).replaceAll('\\', '/')] = counts;
    }
  }
  return result;
}

const sorted = (counts: Counts): Counts =>
  Object.fromEntries(
    Object.keys(counts)
      .sort()
      .map((file) => [
        file,
        Object.fromEntries(
          Object.keys(counts[file])
            .sort()
            .map((rule) => [rule, counts[file][rule]]),
        ),
      ]),
  );

describe('design drift', () => {
  const found = scan();
  const baseline: Counts = existsSync(baselineFile)
    ? JSON.parse(readFileSync(baselineFile, 'utf8'))
    : {};

  if (
    process.env['DESIGN_DRIFT_UPDATE'] === 'init' &&
    !existsSync(baselineFile)
  ) {
    // One time only, when the guard is first added: today's counts become the debt.
    writeFileSync(
      baselineFile,
      `${JSON.stringify(sorted(found), null, 2)}
`,
    );
    Object.assign(baseline, found);
  } else if (process.env['DESIGN_DRIFT_UPDATE']) {
    // Lower only: the new baseline is the smaller of the two counts, files at zero drop out.
    const lowered: Counts = {};
    for (const [file, rules] of Object.entries(baseline)) {
      for (const [rule, allowed] of Object.entries(rules)) {
        const now = Math.min(found[file]?.[rule] ?? 0, allowed);
        if (now) (lowered[file] ??= {})[rule] = now;
      }
    }
    writeFileSync(
      baselineFile,
      `${JSON.stringify(sorted(lowered), null, 2)}\n`,
    );
  }

  it('finds the sources it is supposed to scan', () => {
    expect(Object.keys(found).length).toBeGreaterThan(0);
    expect(Object.keys(baseline).length).toBeGreaterThan(0);
  });

  it('adds no new drift: no file goes above its baseline', () => {
    const over: string[] = [];
    for (const [file, rules] of Object.entries(found)) {
      for (const [rule, count] of Object.entries(rules)) {
        const allowed = baseline[file]?.[rule] ?? 0;
        if (count > allowed) {
          over.push(
            `${file}: ${rule} ${count} (allowed ${allowed}). ${(RULES[rule] ?? CELL_RULES[rule]).instead}`,
          );
        }
      }
    }
    expect(over).toEqual([]);
  });

  it('locks in every fix: the baseline lists no more than the code has', () => {
    // Fixed something? Run `npm run guard:design:update` and commit the lowered baseline.
    const stale: string[] = [];
    for (const [file, rules] of Object.entries(baseline)) {
      for (const [rule, allowed] of Object.entries(rules)) {
        const now = found[file]?.[rule] ?? 0;
        if (now < allowed) stale.push(`${file}: ${rule} ${allowed} → ${now}`);
      }
    }
    expect(stale).toEqual([]);
  });

  it('knows every rule the baseline names', () => {
    const unknown = Object.values(baseline)
      .flatMap((rules) => Object.keys(rules))
      .filter((rule) => !(rule in RULES) && !(rule in CELL_RULES));
    expect(unknown).toEqual([]);
  });

  describe('the counter', () => {
    it('counts declarations and skips comments', () => {
      expect(
        countIn(
          [
            '.a { border-radius: 4px; box-shadow: none; }',
            '// border-radius: 2px',
            '/* font-family: x; */',
            '.b { @include ui.text(xs, muted); transform: translateY(-2px); }',
          ].join('\n'),
          'scss',
        ),
      ).toEqual({
        'own-radius': 1,
        'own-shadow': 1,
        'text-xs': 1,
        'transform-move': 1,
      });
    });

    it('honours an allow comment with a reason, for its own rule only', () => {
      expect(
        countIn(
          '.a { border-radius: 4px; box-shadow: 0 0 0 1px x; } // design-drift-allow: own-radius slider thumb is round',
          'scss',
        ),
      ).toEqual({ 'own-shadow': 1 });
      expect(
        countIn(
          '.a { border-radius: 4px; } // design-drift-allow: own-radius ok',
          'scss',
        ),
      ).toEqual({ 'own-radius': 1 });
    });

    it('finds a row action that reads as text, in action cells only', () => {
      expect(
        countIn(
          [
            '<td data-label="Thao tác">',
            '  <a',
            '    uiButton',
            '    size="sm"',
            '    variant="ghost"',
            '    routerLink="/x">Xem</a>',
            '  <a routerLink="/y">Mở</a>',
            '</td>',
            '<td data-label="Khóa học"><a uiTablePrimary routerLink="/z">Z</a></td>',
            '<td data-label="Ghi chú"><a routerLink="/w">w</a></td>',
            '<ng-template uiDataTableCell="actions" let-row>',
            '  <a uiIconButton size="sm" label="Sửa" routerLink="/e"></a>',
            '  <button uiButton size="sm">Thu hồi</button>',
            '  <a uiLinkButton routerLink="/r">Xem</a>',
            '</ng-template>',
          ].join('\n'),
          'html',
        ),
      ).toEqual({ 'text-row-action': 3 });
    });

    it('finds a hand-made page title and a subtle fill', () => {
      expect(countIn('<h1>Học tập</h1><!-- <h1>x</h1> -->', 'html')).toEqual({
        'own-h1': 1,
      });
      expect(
        countIn('.c { background: ui.color(primary-subtle); }', 'scss'),
      ).toEqual({ 'subtle-fill': 1 });
    });
  });
});
