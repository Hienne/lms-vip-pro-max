import {
  openDesignSystem,
  placeholderMismatches,
} from './design-system.testing';

describe('breadcrumb and page header demos', () => {
  it('shows the breadcrumb trail with the current page last', async () => {
    const { page } = await openDesignSystem();
    const nav = page.querySelector<HTMLElement>(
      '#ds-nav nav[aria-label="Đường dẫn"]',
    );
    expect(nav).not.toBeNull();
    expect(
      nav?.querySelector('[aria-current="page"]')?.textContent?.trim(),
    ).toBe('Tổng quan Core Banking');
    expect(nav?.querySelectorAll('a')).toHaveLength(2);
  });

  it('shows the page header with its title, breadcrumb and actions', async () => {
    const { page } = await openDesignSystem();
    const header = page.querySelector<HTMLElement>('#ds-nav ui-page-header');
    expect(header?.querySelector('h1')?.textContent?.trim()).toBe(
      'Nền tảng nghiệp vụ Core Banking',
    );
    expect(header?.querySelector('nav')).not.toBeNull();
    expect(
      header?.querySelectorAll('.page-header__actions button'),
    ).toHaveLength(2);
  });

  it('no longer shows "Chưa migrate" for either piece', async () => {
    const { page } = await openDesignSystem();
    expect(
      placeholderMismatches(page.querySelector('#ds-nav') as HTMLElement, [
        'breadcrumb',
        'page-header',
      ]),
    ).toEqual([]);
  });
});
