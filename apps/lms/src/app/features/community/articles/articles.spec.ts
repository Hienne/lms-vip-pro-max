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

  it('filters lessons by a sidebar tag and clears it without changing the content type', async () => {
    const page = await openCommunity(
      '/community/articles?type=lesson&q=Oracle&page=2',
    );
    const select = page
      .el()
      .querySelector<HTMLSelectElement>('select[aria-label="Thẻ"]')!;
    const buttons = page
      .el()
      .querySelectorAll<HTMLButtonElement>('.community-list__topics button');
    expect(buttons.length).toBeGreaterThan(1);
    const tagId = select.options[1].value;
    const request = () =>
      page.handle.mock.calls
        .filter(([e]) => e === communityEndpoints.lessons)
        .at(-1)![1].query;

    buttons[1].click();
    await page.settle();
    expect(select.value).toBe(tagId);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(String(request()?.['tagIds'])).toBe(tagId);
    expect(request()).toMatchObject({ q: 'Oracle', page: '0' });

    buttons[0].click();
    await page.settle();
    expect(select.value).toBe('');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(request()).toMatchObject({ q: 'Oracle' });
    expect(request()?.['tagIds']).toBeUndefined();
    expect(
      page.handle.mock.calls.some(([e]) => e === communityEndpoints.articles),
    ).toBe(false);
  });
});
