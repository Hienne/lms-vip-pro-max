import { communityEndpoints } from '@lms/contracts';
import { configureCommunityTesting, openCommunity } from '../community.testing';

describe('CommunityMine', () => {
  beforeEach(() => configureCommunityTesting());

  it('lists the user’s own posts from the server', async () => {
    const page = await openCommunity('/community/me', 'hocvien');

    expect(page.text()).toContain('Oracle UCP báo timeout khi lấy connection');
    expect(
      page.handle.mock.calls.some(([e]) => e === communityEndpoints.myContents),
    ).toBe(true);
  });
});
