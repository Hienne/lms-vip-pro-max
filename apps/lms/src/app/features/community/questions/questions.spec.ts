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

  it('keeps the tag sidebar and dropdown in sync without clearing other filters', async () => {
    const page = await openCommunity(
      '/community/questions?q=Oracle&status=solved&sort=score&page=2',
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
        .filter(([e]) => e === communityEndpoints.questions)
        .at(-1)![1].query;

    buttons[1].click();
    await page.settle();
    expect(select.value).toBe(tagId);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(String(request()?.['tagIds'])).toBe(tagId);
    expect(request()).toMatchObject({
      q: 'Oracle',
      resolutionStatus: 'solved',
      sort: 'score',
      page: '0',
    });

    select.value = '';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await page.settle();
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(request()?.['tagIds']).toBeUndefined();

    buttons[1].click();
    await page.settle();
    buttons[0].click();
    await page.settle();
    expect(select.value).toBe('');
    expect(request()).toMatchObject({
      q: 'Oracle',
      resolutionStatus: 'solved',
    });
    expect(request()?.['tagIds']).toBeUndefined();
  });
});
