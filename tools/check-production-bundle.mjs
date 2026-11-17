// Fails when the production build contains anything that exists only for the team.
// Usage: node tools/check-production-bundle.mjs [dir]   (default: dist/apps/lms)
//
// The markers are strings that only the dev toolbar, the offline simulation, the migration board
// and the mock API fixtures contain. Production must hold none of them. Staging keeps the dev
// tools on purpose, so it is checked with `--fixtures-only`: it must still hold no fixtures.
// A development build holds everything, so pointing the script at one must fail: that is how the
// check itself is verified.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const FIXTURE_MARKERS = [['mock API fixtures', 'admin@demo.cb']];
const DEV_TOOL_MARKERS = [
  ['SCORM dev relay', 'LMS_SCORM_DEV_PROXY'],
  ['SCORM dev relay', 'SCORM dev proxy: request unavailable.'],
  ['dev toolbar', 'Mô phỏng hết phiên đăng nhập'],
  ['dev toolbar', 'Đổi vai trò dữ liệu mô phỏng'],
  ['mock role storage', 'lms.mockRole'],
  ['migration board', 'Tiến độ migrate'],
  ['migration board', 'migration-entries.data.ts'],
];

const args = process.argv.slice(2);
const fixturesOnly = args.includes('--fixtures-only');
const dir = args.find((a) => !a.startsWith('--')) ?? 'dist/apps/lms';
const MARKERS = fixturesOnly
  ? FIXTURE_MARKERS
  : [...FIXTURE_MARKERS, ...DEV_TOOL_MARKERS];

function* files(root) {
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(js|mjs|html|css)$/.test(name)) yield path;
  }
}

let scanned = 0;
const found = [];
try {
  for (const file of files(dir)) {
    scanned++;
    const text = readFileSync(file, 'utf8');
    for (const [what, marker] of MARKERS) {
      if (text.includes(marker))
        found.push(`${relative('.', file)}: ${what} ("${marker}")`);
    }
  }
} catch (error) {
  console.error(`Cannot read ${dir}: ${error.message}. Build the app first.`);
  process.exit(2);
}

if (scanned === 0) {
  console.error(`No build output found in ${dir}. Build the app first.`);
  process.exit(2);
}
if (found.length > 0) {
  console.error(
    `Dev-only code found in ${dir}:\n${found.map((line) => `  ${line}`).join('\n')}`,
  );
  process.exit(1);
}
console.log(
  fixturesOnly
    ? `${dir}: no mock API fixtures (${scanned} files scanned).`
    : `${dir}: no mock API fixtures, dev toolbar or migration board (${scanned} files scanned).`,
);
