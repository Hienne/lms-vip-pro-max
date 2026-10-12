import { TestBed } from '@angular/core/testing';
import {
  openDesignSystem,
  placeholderMismatches,
} from './design-system.testing';

describe('/design-system menu demo', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.querySelector('.cdk-overlay-container')?.remove();
  });

  it('shows the menu demo instead of its placeholder', async () => {
    const { page } = await openDesignSystem();
    const section = page.querySelector('#ds-feedback') as HTMLElement;
    expect(placeholderMismatches(section, ['menu'])).toEqual([]);
    expect(section.querySelectorAll('ui-menu')).toHaveLength(2);
  });

  it('reports the action chosen from the menu', async () => {
    const { page } = await openDesignSystem();
    const section = page.querySelector('#ds-feedback') as HTMLElement;
    const trigger = section.querySelector(
      'ui-menu button',
    ) as HTMLButtonElement;
    trigger.click();
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    const copy = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((item) => item.textContent?.includes('Sao chép'));
    copy?.click();
    TestBed.tick();
    expect(section.querySelector('[role="status"]')?.textContent).toContain(
      'Đã chọn: Sao chép',
    );
  });
});
