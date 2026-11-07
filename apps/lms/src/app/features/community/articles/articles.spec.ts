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

  it('filters by tag without losing the other filters or duplicating navigation', async () => {
    const page = await openCommunity(
      '/community/articles?type=lesson&q=Oracle&page=2',
    );
    expect(page.el().querySelector('app-community-tabs')).toBeNull();
    const select = page
      .el()
      .querySelector<HTMLSelectElement>('select[aria-label="Thẻ"]')!;
    const tagId = select.options[1].value;
    select.value = tagId;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await page.settle();
    const request = () =>
      page.handle.mock.calls
        .filter(([e]) => e === communityEndpoints.lessons)
        .at(-1)![1].query;
    expect(String(request()?.['tagIds'])).toBe(tagId);
    expect(request()).toMatchObject({ q: 'Oracle', page: '0' });
    select.value = '';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await page.settle();
    expect(request()?.['tagIds']).toBeUndefined();
  });
});
