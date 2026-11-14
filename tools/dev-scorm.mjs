import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const lmsPort =
  args.find((arg) => arg.startsWith('--port='))?.split('=')[1] ??
  (portIndex >= 0 ? args[portIndex + 1] : '4200');
const child = spawn(
  process.execPath,
  [
    fileURLToPath(
      new URL('../node_modules/nx/dist/bin/nx.js', import.meta.url),
    ),
    'serve',
    'lms',
    ...args,
  ],
  {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      LMS_SCORM_DEV_PROXY: '1',
      LMS_DEV_ORIGIN:
        process.env.LMS_DEV_ORIGIN ?? `http://localhost:${lmsPort}`,
      LMS_API_TARGET: process.env.LMS_API_TARGET ?? 'https://chanacademy.io.vn',
      LMS_SCORM_TARGET:
        process.env.LMS_SCORM_TARGET ?? 'https://chanacademy.io.vn:8020',
    },
  },
);
child.once('error', () => {
  console.error('Cannot start Angular dev server.');
  process.exitCode = 1;
});
child.once('exit', (code) => {
  process.exitCode = code ?? 1;
});
process.once('SIGINT', () => child.kill('SIGINT'));
process.once('SIGTERM', () => child.kill('SIGTERM'));
