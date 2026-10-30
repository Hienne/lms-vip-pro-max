import { toUrl } from '../http/endpoint';
import { MESSAGE_CODE_KIND } from '../http/envelope';
import { communityEndpoints } from './community.endpoints';

describe('community endpoints', () => {
  it('are all plain backend endpoints under /api/v1/community', () => {
    for (const endpoint of Object.values(communityEndpoints)) {
      expect(endpoint.path.startsWith('/api/v1/community/')).toBe(true);
      expect((endpoint as { served?: string }).served).toBeUndefined();
    }
  });

  it('declare the paths of the contract ids the screens use', () => {
    const e = communityEndpoints;
    expect(e.questions.path).toBe('/api/v1/community/questions');
    expect(e.moderatorCandidates.path).toBe(
      '/api/v1/community/moderation/candidates',
    );
    expect(e.report.method).toBe('get');
    expect(e.moderators.path).toBe('/api/v1/community/moderation/moderators');
    expect(toUrl(e.acceptAnswer, { questionId: 4 })).toBe(
      '/api/v1/community/questions/4/accepted-answer',
    );
    expect(toUrl(e.revision, { contentId: 4, revisionId: 9 })).toBe(
      '/api/v1/community/contents/4/revisions/9',
    );
    expect(toUrl(e.setModerator, { userId: '000123' })).toBe(
      '/api/v1/community/moderation/moderators/000123',
    );
  });

  it('answer a refusal of the community as a refused request', () => {
    expect(MESSAGE_CODE_KIND['COMMUNITY-CONFLICT']).toBe('refused');
    expect(MESSAGE_CODE_KIND['COMMUNITY-NOT_PUBLISHABLE']).toBe('refused');
  });
});
