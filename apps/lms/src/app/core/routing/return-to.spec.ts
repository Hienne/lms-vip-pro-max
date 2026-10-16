import { readReturnTo, returnToParams } from './return-to';

describe('readReturnTo', () => {
  it.each(['/learn', '/admin/courses?q=a', '/catalog#top'])(
    'keeps %s',
    (path) => expect(readReturnTo(path)).toBe(path),
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
  ])('drops %s', (value) => expect(readReturnTo(value)).toBeNull());
});

describe('returnToParams', () => {
  it('builds a next param that readReturnTo accepts back', () => {
    const params = returnToParams('/catalog?q=a');
    expect(params).toEqual({ next: '/catalog?q=a' });
    expect(readReturnTo(params['next'])).toBe('/catalog?q=a');
  });

  it.each([null, undefined, '', '/', '/login', '//evil.example'])(
    'has no param for %s',
    (url) => expect(returnToParams(url)).toEqual({}),
  );
});
