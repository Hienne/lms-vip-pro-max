// Fails when the production build contains anything that exists only for the team.
// Usage: node tools/check-production-bundle.mjs [dir]   (default: dist/apps/lms)
//
// The markers are strings that only the dev toolbar, the Prism scenario interceptor and the
// migration board contain. `dist/apps/lms-staging` is built with them, so pointing the script at
// it must fail: that is how the check itself is verified.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const MARKERS = [
  ['dev toolbar', 'Mô phỏng hết phiên đăng nhập'],
  ['dev toolbar', 'Đăng nhập nhanh theo vai trò'],
  ['Prism scenario interceptor', 'lms.mockRole'],
  ['migration board', 'Tiến độ migrate'],
  ['migration board', 'migration-entries.data.ts'],
];

const dir = process.argv[2] ?? 'dist/apps/lms';

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
  `${dir}: no dev toolbar, scenario interceptor or migration board (${scanned} files scanned).`,
);
