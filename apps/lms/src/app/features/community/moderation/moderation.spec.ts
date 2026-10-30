import { communityEndpoints } from '@lms/contracts';
import { configureCommunityTesting, openCommunity } from '../community.testing';

describe('CommunityModeration', () => {
  beforeEach(() => configureCommunityTesting());

  it('shows a moderator the report queue only', async () => {
    const page = await openCommunity('/community/moderation', 'dieuphoi');

    expect(page.text()).toContain('Xử lý báo cáo vi phạm trong Ban.');
    expect(page.text()).toContain('BC-1');
    expect(page.text()).toContain('Thông tin sai');
    expect(page.text()).not.toContain('Bổ nhiệm người điều phối');
  });

  it('counts the reports nobody has taken on the tab', async () => {
    const page = await openCommunity('/community/moderation', 'dieuphoi');

    const tab = page.el().querySelector('[role="tab"]');
    expect(tab?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Báo cáo 2');
  });

  it('assigns a case only to an active moderator of the unit', async () => {
    const page = await openCommunity(
      '/community/moderation?report=1',
      'dieuphoi',
    );

    await page.click('Giao cho người khác');
    expect(
      page.handle.mock.calls.some(
        ([e, req]) =>
          e === communityEndpoints.moderators &&
          req.query['status'] === 'active',
      ),
    ).toBe(true);
    expect(
      page.handle.mock.calls.some(
        ([e]) => e === communityEndpoints.moderatorCandidates,
      ),
    ).toBe(false);
    expect(page.text()).toContain('Điều phối viên Demo');
  });

  it('takes a case, then records an action with its reason', async () => {
    const page = await openCommunity(
      '/community/moderation?report=1',
      'dieuphoi',
    );

    expect(page.text()).toContain('Báo cáo BC-1');
    await page.click('Nhận xử lý');
    expect(page.bodies(communityEndpoints.assignReport)).toEqual([
      expect.objectContaining({ moderatorUserId: '000008' }),
    ]);
    expect(page.text()).toContain('Lịch sử hành động');
    expect(page.controls('Ghi nhận xử lý')[0]).not.toHaveProperty(
      'disabled',
      true,
    );

    const warn = page
      .el()
      .querySelector<HTMLInputElement>('input[type="radio"][value="warn"]')!;
    warn.click();
    const reason = page
      .el()
      .querySelector<HTMLTextAreaElement>(
        'form[aria-label="Xử lý báo cáo"] textarea',
      )!;
    reason.value = 'Đã nhắc tác giả bổ sung ảnh hưởng hiệu năng.';
    reason.dispatchEvent(new Event('input'));
    await page.settle();
    await page.click('Ghi nhận xử lý');

    expect(page.bodies(communityEndpoints.actOnReport).at(-1)).toMatchObject({
      action: 'warn',
      reason: 'Đã nhắc tác giả bổ sung ảnh hưởng hiệu năng.',
    });
  });

  it('appoints a revoked moderator again with the version of the revoked grant', async () => {
    const page = await openCommunity('/community/moderation', 'quantri.ban');
    const reason = async (text: string) => {
      const field = page
        .el()
        .querySelector<HTMLTextAreaElement>(
          'form.moderation__drawer textarea',
        )!;
      field.value = text;
      field.dispatchEvent(new Event('input'));
      await page.settle();
    };

    await page.click('Thu hồi');
    await reason('Chuyển sang nhóm khác.');
    page.controls('Thu hồi').at(-1)!.click();
    await page.settle();
    const revoked = page.bodies(communityEndpoints.setModerator).at(-1);
    expect(revoked).toMatchObject({ active: false });

    await page.click('Bổ nhiệm người điều phối');
    await new Promise((resolve) => setTimeout(resolve, 350));
    await page.settle();
    page
      .el()
      .querySelector<HTMLInputElement>('input[type="radio"][value="000008"]')!
      .click();
    await reason('Quay lại điều phối.');
    await page.click('Bổ nhiệm');

    const regranted = page.bodies(communityEndpoints.setModerator).at(-1);
    expect(regranted).toMatchObject({ active: true });
    expect(
      (regranted as { expectedVersion: number }).expectedVersion,
    ).toBeGreaterThan((revoked as { expectedVersion: number }).expectedVersion);
    expect(page.text()).not.toContain('Dữ liệu đã thay đổi');
    expect(page.text()).toContain('Đã bổ nhiệm người điều phối');
  });

  it('lets a unit ADMIN appoint a moderator from the unit staff', async () => {
    const page = await openCommunity('/community/moderation', 'quantri.ban');

    expect(page.text()).toContain(
      'Bổ nhiệm và thu hồi người điều phối của Ban.',
    );
    await page.click('Bổ nhiệm người điều phối');
    // The staff lookup waits for typing to settle.
    await new Promise((resolve) => setTimeout(resolve, 350));
    await page.settle();
    expect(
      page.handle.mock.calls.some(
        ([e]) => e === communityEndpoints.moderatorCandidates,
      ),
    ).toBe(true);
  });
});
