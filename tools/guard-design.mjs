// Runs the design guards (apps/lms/src/app/template-scan.spec.ts and design-drift.spec.ts) on their
// own, fast enough for CI, which runs no other unit tests. `--update` lowers the drift baseline
// after a fix (it never raises a count or adds a file). See docs/conventions/visual-design.md.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '../apps/lms');
const update = process.argv.includes('--update');
const specs = update
  ? ['src/app/design-drift.spec.ts']
  : ['src/app/template-scan.spec.ts', 'src/app/design-drift.spec.ts'];

const result = spawnSync(
  'npx',
  ['vitest', 'run', '--config', 'vite.config.mts', ...specs],
  {
    cwd: app,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...(update ? { DESIGN_DRIFT_UPDATE: '1' } : {}) },
  },
);
process.exit(result.status ?? 1);
