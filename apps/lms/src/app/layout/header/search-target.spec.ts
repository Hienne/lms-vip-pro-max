import { searchPlaceholder, searchTarget } from './search-target';

describe('searchTarget', () => {
  it.each([
    [['PROFILE', 'COURSE_LEARNING', 'QUIZ_TAKING'], '/catalog'],
    [['PROFILE', 'REPORTING'], '/reports/results'],
    [['PROFILE', 'COURSE_MANAGEMENT', 'REPORTING'], '/admin/courses'],
    [['USER_MANAGEMENT', 'COURSE_MANAGEMENT', 'REPORTING'], '/admin/courses'],
  ] as const)('sends the functions %j to %s with the query', (menus, path) => {
    expect(searchTarget(menus, 'core')).toEqual({
      path,
      query: path === '/reports/results' ? { userId: 'core' } : { q: 'core' },
    });
  });

  it('trims the query and ignores an empty one', () => {
    expect(searchTarget(['COURSE_LEARNING'], '  vay vốn ')?.query).toEqual({
      q: 'vay vốn',
    });
    expect(searchTarget(['COURSE_LEARNING'], '   ')).toBeNull();
  });

  it('has nowhere to send a user whose functions offer no list', () => {
    expect(searchTarget(['ROLE_MANAGEMENT'], 'core')).toBeNull();
  });
});

describe('searchPlaceholder', () => {
  it('is shorter for a user who only learns', () => {
    expect(searchPlaceholder(['PROFILE', 'COURSE_LEARNING'])).toBe(
      'Tìm khóa học, bài học…',
    );
    expect(searchPlaceholder(['USER_MANAGEMENT', 'COURSE_MANAGEMENT'])).toBe(
      'Tìm khóa học, người dùng, câu hỏi…',
    );
  });
});
