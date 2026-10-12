import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import {
  openDesignSystem,
  placeholderMismatches,
} from './design-system.testing';

const dialogPanel = () => document.querySelector('[role="alertdialog"]');
const drawerPanel = () =>
  document.querySelector('[role="dialog"].cdk-dialog-container');
const buttonIn = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
    b.textContent?.includes(label),
  );

afterEach(() => {
  TestBed.inject(Dialog).closeAll();
  document.querySelector('.cdk-overlay-container')?.remove();
});

describe('design system dialog and drawer demos', () => {
  it('shows no placeholder for the modal and drawer pieces', async () => {
    const { page } = await openDesignSystem();

    expect(placeholderMismatches(page, ['modal', 'drawer'])).toEqual([]);
  });

  it('records the confirm result on the page', async () => {
    const { page } = await openDesignSystem();
    buttonIn(page, 'Hộp xác nhận')?.click();
    TestBed.tick();
    await vi.waitFor(() => expect(dialogPanel()).not.toBeNull());

    buttonIn(document, 'Xuất bản')?.click();

    await vi.waitFor(() => {
      TestBed.tick();
      expect(page.textContent).toContain('Đã chọn Xuất bản');
    });
  });

  it('opens the drawer and closes it from its footer', async () => {
    const { page } = await openDesignSystem();
    buttonIn(page, 'Mở drawer')?.click();
    TestBed.tick();
    await vi.waitFor(() => expect(drawerPanel()).not.toBeNull());
    expect(drawerPanel()?.textContent).toContain('Drawer mẫu');

    const footer = document.querySelector('.drawer__footer') as HTMLElement;
    buttonIn(footer, 'Đóng')?.click();

    await vi.waitFor(() => expect(drawerPanel()).toBeNull());
  });
});
