import { searchPlaceholder, searchTarget } from './search-target';

describe('searchTarget', () => {
  it.each([
    ['learner', '/catalog'],
    ['viewer', '/reports/learners'],
    ['instructor', '/admin/courses'],
    ['admin', '/admin/courses'],
  ] as const)('sends a %s to %s with the query', (role, path) => {
    expect(searchTarget(role, 'core')).toEqual({ path, query: { q: 'core' } });
  });

  it('trims the query and ignores an empty one', () => {
    expect(searchTarget('learner', '  vay vốn ')?.query).toEqual({
      q: 'vay vốn',
    });
    expect(searchTarget('learner', '   ')).toBeNull();
  });
});

describe('searchPlaceholder', () => {
  it('is shorter for a learner', () => {
    expect(searchPlaceholder('learner')).toBe('Tìm khóa học, bài học…');
    expect(searchPlaceholder('admin')).toBe(
      'Tìm khóa học, người dùng, câu hỏi…',
    );
  });
});
