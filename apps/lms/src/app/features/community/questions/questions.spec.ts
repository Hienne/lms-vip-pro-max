import { communityEndpoints } from '@lms/contracts';
import { configureCommunityTesting, openCommunity } from '../community.testing';

describe('CommunityQuestions', () => {
  beforeEach(() => configureCommunityTesting());

  it('lists the published questions, newest activity first', async () => {
    const page = await openCommunity('/community/questions');

    expect(page.text()).toContain('Oracle UCP báo timeout khi lấy connection');
    const [, request] = page.handle.mock.calls.find(
      ([e]) => e === communityEndpoints.questions,
    )!;
    expect(request.query).toMatchObject({ page: '0', sort: 'lastActivityAt' });
  });

  it('reads the filters from the address and sends them to the server', async () => {
    const page = await openCommunity(
      '/community/questions?status=solved&sort=score&page=2',
    );

    const request = page.handle.mock.calls
      .filter(([e]) => e === communityEndpoints.questions)
      .at(-1)![1];
    expect(request.query).toMatchObject({
      page: '1',
      sort: 'score',
      resolutionStatus: 'solved',
    });
  });
});
