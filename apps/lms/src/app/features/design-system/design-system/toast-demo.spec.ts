import { TestBed } from '@angular/core/testing';
import { Toaster } from '@lms/ui';
import {
  openDesignSystem,
  placeholderMismatches,
} from './design-system.testing';

describe('toast demo', () => {
  afterEach(() => {
    TestBed.inject(Toaster).dismissAll();
    TestBed.tick();
    document.querySelector('.cdk-overlay-container')?.remove();
  });

  it('replaces the placeholder with buttons that show toasts', async () => {
    const { page } = await openDesignSystem();
    const section = page.querySelector('#ds-feedback') as HTMLElement;
    expect(placeholderMismatches(section, ['toast'])).toEqual([]);

    const buttons = Array.from(section.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Toast'),
    );
    expect(buttons.map((b) => b.textContent?.trim())).toEqual([
      'Toast thành công',
      'Toast lỗi',
      'Toast cảnh báo',
      'Toast thông tin',
    ]);

    buttons[1].click();
    TestBed.tick();
    const toast = document.body.querySelector('.toast--error');
    expect(toast?.querySelector('.toast__title')?.textContent).toBe(
      'Không lưu được',
    );
  });
});
