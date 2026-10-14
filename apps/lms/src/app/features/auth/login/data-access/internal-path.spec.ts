import { internalPath } from './internal-path';

describe('internalPath', () => {
  it.each(['/learn', '/admin/courses?q=a', '/catalog#top'])(
    'keeps %s',
    (path) => expect(internalPath(path)).toBe(path),
  );

  it.each([
    null,
    undefined,
    '',
    'learn',
    '//evil.example',
    'https://evil.example',
    '/\\evil.example',
    '/login',
    '/login?next=/learn',
  ])('drops %s', (value) => expect(internalPath(value)).toBeNull());
});
