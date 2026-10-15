import { searchPlaceholder, searchTarget } from './search-target';

describe('searchTarget', () => {
  it.each([
    [['learn.home', 'learn.catalog'], '/catalog'],
    [['reports'], '/reports/learners'],
    [['teach.home', 'content.courses', 'reports'], '/admin/courses'],
    [['admin.users', 'content.courses', 'reports'], '/admin/courses'],
  ] as const)('sends the menus %j to %s with the query', (menus, path) => {
    expect(searchTarget(menus, 'core')).toEqual({ path, query: { q: 'core' } });
  });

  it('trims the query and ignores an empty one', () => {
    expect(searchTarget(['learn.catalog'], '  vay vốn ')?.query).toEqual({
      q: 'vay vốn',
    });
    expect(searchTarget(['learn.catalog'], '   ')).toBeNull();
  });

  it('has nowhere to send a user whose menus offer no list', () => {
    expect(searchTarget(['admin.roles'], 'core')).toBeNull();
  });
});

describe('searchPlaceholder', () => {
  it('is shorter for a user who only learns', () => {
    expect(searchPlaceholder(['learn.home', 'learn.catalog'])).toBe(
      'Tìm khóa học, bài học…',
    );
    expect(searchPlaceholder(['admin.users', 'content.courses'])).toBe(
      'Tìm khóa học, người dùng, câu hỏi…',
    );
  });
});
