import {
  openDesignSystem,
  placeholderMismatches,
} from './design-system.testing';

describe('design system: empty and error state demo', () => {
  it('replaces the placeholder with empty, offline and forbidden blocks', async () => {
    const { page } = await openDesignSystem();
    const section = page.querySelector('#ds-feedback') as HTMLElement;

    expect(placeholderMismatches(section, ['empty-error-state'])).toEqual([]);

    const blocks = Array.from(section.querySelectorAll('ui-empty'));
    const titles = blocks.map((b) =>
      b.querySelector('h3')?.textContent?.trim(),
    );
    expect(titles).toEqual([
      'Chưa có bài thi nào',
      'Mất kết nối',
      'Không đủ quyền (403)',
    ]);
    expect(section.querySelectorAll('ui-error-state button')).toHaveLength(1);
    expect(
      section.querySelector('ui-error-state button')?.textContent,
    ).toContain('Thử lại');
  });
});
