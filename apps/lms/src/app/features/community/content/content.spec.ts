import { communityEndpoints } from '@lms/contracts';
import { configureCommunityTesting, openCommunity } from '../community.testing';

describe('CommunityContent', () => {
  beforeEach(() => configureCommunityTesting());

  it('shows the question, its context and its answers with the accepted one marked', async () => {
    const page = await openCommunity('/community/contents/101');

    expect(page.text()).toContain('Oracle UCP báo timeout khi lấy connection');
    expect(page.text()).toContain('Java 17, Oracle UCP 21c');
    expect(page.text()).toContain('2 câu trả lời');
    expect(
      page.el().querySelector('[aria-label="Câu trả lời được chấp nhận"]'),
    ).not.toBeNull();
    // Each answer is read in full: the list only carries a summary.
    const reads = page.handle.mock.calls
      .filter(([e]) => e === communityEndpoints.content)
      .map(([, req]) => Number(req.params['contentId']));
    expect(reads).toEqual(expect.arrayContaining([101, 102, 103]));
  });

  it('lets the asker unaccept and accept, and never vote on their own question', async () => {
    const page = await openCommunity('/community/contents/101', 'hocvien');

    const ownVote = page
      .el()
      .querySelector<HTMLButtonElement>('app-vote button[aria-label]');
    expect(ownVote?.getAttribute('aria-label')).toContain('không thể');
    await page.click('Bỏ chấp nhận');

    expect(page.bodies(communityEndpoints.acceptAnswer).at(-1)).toMatchObject({
      answerContentId: null,
      answerRevisionId: null,
    });
    expect(page.controls('Chấp nhận câu trả lời').length).toBe(2);
  });

  it('posts an answer as a draft of the question and publishes it', async () => {
    const page = await openCommunity('/community/contents/101', 'giangvien');

    expect(page.controls('Chấp nhận câu trả lời')).toEqual([]);
    const body = page
      .el()
      .querySelector<HTMLTextAreaElement>('app-markdown-editor textarea')!;
    body.value = 'Kiểm tra số thread đang chờ connection trước khi tăng pool.';
    body.dispatchEvent(new Event('input'));
    await page.settle();
    await page.click('Đăng câu trả lời');

    const [created] = page.bodies(communityEndpoints.createAnswer) as {
      title: string;
      bodyMarkdown: string;
    }[];
    expect(created.title).toBe(
      'Câu trả lời cho “Oracle UCP báo timeout khi lấy connection”',
    );
    expect(page.bodies(communityEndpoints.publishContent)).toHaveLength(1);
    expect(page.text()).toContain('3 câu trả lời');
  });

  it('lays out a lesson learned by its incident sections', async () => {
    const page = await openCommunity('/community/contents/120');

    expect(page.text()).toContain('Bài học sự cố');
    for (const heading of [
      'Triệu chứng',
      'Nguyên nhân gốc',
      'Cách xử lý',
      'Phòng ngừa',
    ]) {
      expect(page.text()).toContain(heading);
    }
    expect(
      page.el().querySelector('[aria-labelledby="answers-title"]'),
    ).toBeNull();
  });

  it('moves an answer address to its question', async () => {
    const page = await openCommunity('/community/contents/102');

    expect(page.harness.routeDebugElement).toBeTruthy();
    expect(page.text()).toContain('Oracle UCP báo timeout khi lấy connection');
    expect(page.text()).toContain('câu trả lời');
  });

  it('asks before leaving with an answer typed but not posted', async () => {
    const page = await openCommunity('/community/contents/101', 'giangvien');
    const component = page.harness.routeDebugElement!.componentInstance as {
      hasUnsavedChanges(): boolean;
    };

    expect(component.hasUnsavedChanges()).toBe(false);
    const body = page
      .el()
      .querySelector<HTMLTextAreaElement>('app-markdown-editor textarea')!;
    body.value = 'Một câu trả lời còn đang viết dở.';
    body.dispatchEvent(new Event('input'));
    await page.settle();
    expect(component.hasUnsavedChanges()).toBe(true);
  });
});
