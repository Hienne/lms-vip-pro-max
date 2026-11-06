import { communityEndpoints } from '@lms/contracts';
import {
  configureCommunityTesting,
  openCommunity,
  type CommunityPage,
} from '../community.testing';

const type = async (page: CommunityPage, selector: string, value: string) => {
  const field = page
    .el()
    .querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  field.value = value;
  field.dispatchEvent(new Event('input'));
  await page.settle();
};

describe('CommunityAsk', () => {
  beforeEach(() => configureCommunityTesting());

  it('needs a tag and a body before publishing', async () => {
    const page = await openCommunity('/community/questions/new', 'giangvien');

    await type(
      page,
      'input[autocomplete="off"]',
      'Kafka consumer lag tăng sau khi deploy',
    );
    await page.click('Đăng câu hỏi');

    expect(
      page.el().querySelector('app-content-thumbnail img')?.getAttribute('src'),
    ).toContain('/images/question-default.webp');
    expect(page.bodies(communityEndpoints.createQuestion)).toEqual([]);
    expect(page.text()).toContain('Chọn ít nhất 1 thẻ để đăng.');
  });

  it('saves a draft with a request id and moves to the editor', async () => {
    const page = await openCommunity('/community/questions/new', 'giangvien');

    await type(
      page,
      'input[autocomplete="off"]',
      'Kafka consumer lag tăng sau khi deploy',
    );
    await page.click('Lưu nháp');

    const [created] = page.bodies(communityEndpoints.createQuestion) as {
      title: string;
      clientRequestId: string;
    }[];
    expect(created.title).toBe('Kafka consumer lag tăng sau khi deploy');
    expect(created.clientRequestId).toMatch(/^[0-9a-f-]{36}$/);
    await page.waitForText('Sửa bản nháp');
  });
});
