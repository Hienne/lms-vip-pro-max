import { DEFAULT_SUGGESTIONS, suggestionsFor } from './agent-suggestions';

describe('suggestionsFor', () => {
  it('differs for each route group', () => {
    const groups = [
      '/lesson/3/9',
      '/quiz/4/take',
      '/admin/courses/new',
      '/community/questions',
    ].map((path) => suggestionsFor(path).join('|'));
    expect(new Set(groups).size).toBe(4);
    for (const group of groups) {
      expect(group).not.toBe(DEFAULT_SUGGESTIONS.join('|'));
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
});
