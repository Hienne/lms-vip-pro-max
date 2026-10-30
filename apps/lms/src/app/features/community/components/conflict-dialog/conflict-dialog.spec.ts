import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { askAfterConflict } from './conflict-dialog';

async function settle() {
  TestBed.tick();
  await Promise.resolve();
  TestBed.tick();
}

afterEach(() => {
  TestBed.inject(Dialog).closeAll();
  document.querySelector('.cdk-overlay-container')?.remove();
  document.body.replaceChildren();
});

async function open() {
  const result = firstValueFrom(askAfterConflict(TestBed.inject(Dialog)));
  await settle();
  const pane = document.querySelector<HTMLElement>('ui-confirm-dialog')!;
  const button = (label: string) =>
    Array.from(pane.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === label,
    )!;
  return { result, pane, button };
}

describe('askAfterConflict', () => {
  it('explains that nothing was saved and offers a reload', async () => {
    const { pane } = await open();
    expect(pane.querySelector('h2')?.textContent).toBe(
      'Nội dung đã được người khác cập nhật',
    );
    expect(pane.textContent).toContain('chưa được lưu');
  });

  it('emits true on Tải lại and false on Đóng', async () => {
    const reload = await open();
    reload.button('Tải lại').click();
    expect(await reload.result).toBe(true);

    const close = await open();
    close.button('Đóng').click();
    expect(await close.result).toBe(false);
  });
});
