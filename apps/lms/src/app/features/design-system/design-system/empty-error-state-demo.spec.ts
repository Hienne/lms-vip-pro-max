import {
  openDesignSystem,
  placeholderMismatches,
} from './design-system.testing';

describe('design system: empty and error state demo', () => {
  it('replaces the placeholder with an inline empty line, offline and forbidden blocks', async () => {
    const { page } = await openDesignSystem();
    const section = page.querySelector('#ds-feedback') as HTMLElement;

    expect(placeholderMismatches(section, ['empty-error-state'])).toEqual([]);

    const blocks = Array.from(section.querySelectorAll('ui-empty'));
    const titles = blocks.map((b) =>
      b.querySelector('h3, .empty__line')?.textContent?.trim(),
    );
    expect(blocks[0].classList).toContain('empty--inline');
    expect(titles).toEqual([
      'Chưa có bài thi nào. Hoàn thành khóa học đầu tiên để mở bài thi.',
      'Mất kết nối',
      'Không đủ quyền (403)',
    ]);
    expect(section.querySelectorAll('ui-error-state button')).toHaveLength(1);
    expect(
      section.querySelector('ui-error-state button')?.textContent,
    ).toContain('Thử lại');
  });
});
