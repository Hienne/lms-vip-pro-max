import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The old "Tạo bằng AI" job start is retired: the backend answers it with HTTP 410 and "Soạn cùng
 * trợ lý" replaced it (ADR 0002). Jobs started before still run, so the app keeps reading them
 * (`courseJobEndpoints.get/list/active`, the review screen), but no app code may start one.
 */

const appSource = join(import.meta.dirname, '../../..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|html)$/.test(name) && !name.endsWith('.spec.ts')
      ? [path]
      : [];
  });
}

const files = sources(appSource).map((path) => ({
  path: relative(appSource, path).replaceAll('\\', '/'),
  text: readFileSync(path, 'utf8'),
}));

describe('the retired old job start', () => {
  it('reads the app source', () => {
    expect(files.some((file) => file.path.endsWith('app.config.ts'))).toBe(
      true,
    );
  });

  it('is called by no app code', () => {
    const calls = files
      .filter((file) =>
        /courseJobEndpoints\s*(\.\s*start\b|\[\s*['"]start['"]\s*\])|\{[^}]*\bstart\b[^}]*\}\s*=\s*courseJobEndpoints/.test(
          file.text,
        ),
      )
      .map((file) => file.path);

    expect(calls).toEqual([]);
  });

  it('is not reached by a hand-written URL either', () => {
    const urls = files
      .filter((file) => file.text.includes('/api/v1/assistant/course-jobs'))
      .map((file) => file.path);

    expect(urls).toEqual([]);
  });
});
