import { communityEndpoints } from '@lms/contracts';
import { configureCommunityTesting, openCommunity } from '../community.testing';

describe('CommunityArticles', () => {
  beforeEach(() => configureCommunityTesting());

  it('lists the articles', async () => {
    const page = await openCommunity('/community/articles');

    expect(page.text()).toContain('Checklist trước khi release lên OpenShift');
    expect(
      page.handle.mock.calls.some(([e]) => e === communityEndpoints.articles),
    ).toBe(true);
  });

  it('switches to the lessons learned list with their incident day', async () => {
    const page = await openCommunity('/community/articles?type=lesson');

    expect(
      page.handle.mock.calls.some(([e]) => e === communityEndpoints.lessons),
    ).toBe(true);
    expect(page.text()).toContain('Mất tin nhắn do commit offset sớm');
    expect(page.text()).toContain('Sự cố ngày');
  });
});
