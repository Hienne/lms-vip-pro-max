import { DEFAULT_SUGGESTIONS, suggestionsFor } from './agent-suggestions';

describe('suggestionsFor', () => {
  it('differs for each route group', () => {
    const groups = [
      '/lesson/3/9',
      '/quiz/4/take',
      '/admin/courses/new',
      '/community/questions',
    ].map((path) =>
      suggestionsFor(path)
        .map((s) => s.text)
        .join('|'),
    );
    expect(new Set(groups).size).toBe(4);
    for (const group of groups) {
      expect(group).not.toBe(DEFAULT_SUGGESTIONS.map((s) => s.text).join('|'));
    }
  });

  it('ignores the query string and fragment', () => {
    expect(suggestionsFor('/quiz/4?x=1#top')).toEqual(suggestionsFor('/quiz'));
  });

  it('falls back to the default three for an unknown route', () => {
    expect(suggestionsFor('/profile')).toEqual(DEFAULT_SUGGESTIONS);
    expect(suggestionsFor('/admin/users')).toEqual(DEFAULT_SUGGESTIONS);
    expect(suggestionsFor('/')).toEqual(DEFAULT_SUGGESTIONS);
  });

  it('names the skill each opening question is for', () => {
    expect(DEFAULT_SUGGESTIONS.map((s) => [s.text, s.skill])).toEqual([
      ['Quy trình EOD gồm những bước nào?', 'qa_tai_lieu'],
      ['Mở trang Hồ sơ cá nhân', 'dieu_huong'],
      ['Đổi chức danh của tôi', 'ho_so'],
    ]);
  });
});
