import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, type Observable } from 'rxjs';
import { reportContent } from './report-dialog';
import type { ReportDraft } from './report-dialog.form';

async function open() {
  const dialog = TestBed.inject(Dialog);
  const result: Promise<ReportDraft | undefined> = firstValueFrom(
    reportContent(dialog) as Observable<ReportDraft | undefined>,
  );
  await settle();
  const pane = () => document.querySelector<HTMLElement>('app-report-dialog')!;
  return { dialog, result, pane };
}

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

describe('reportContent', () => {
  it('lists the reasons and keeps the submit disabled until one is chosen', async () => {
    const { pane } = await open();
    const radios = pane().querySelectorAll<HTMLInputElement>(
      'input[type="radio"]',
    );
    expect(radios.length).toBe(5);
    expect(pane().querySelector('h2')?.textContent?.trim()).toBe(
      'Báo cáo vi phạm',
    );
    expect(
      pane().querySelector<HTMLButtonElement>('button[type="submit"]')!
        .disabled,
    ).toBe(true);
  });

  it('closes with the reason and the trimmed description', async () => {
    const { result, pane } = await open();
    const radios = pane().querySelectorAll<HTMLInputElement>(
      'input[type="radio"]',
    );
    radios[3].click();
    await settle();
    const text = pane().querySelector<HTMLTextAreaElement>('textarea')!;
    text.value = '  Có mật khẩu trong log  ';
    text.dispatchEvent(new Event('input'));
    await settle();
    pane().querySelector<HTMLFormElement>('form')!.requestSubmit();
    expect(await result).toEqual({
      reasonCode: 'sensitive_data',
      description: 'Có mật khẩu trong log',
    });
  });

  it('closes without a value on cancel', async () => {
    const { result, pane } = await open();
    Array.from(pane().querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.trim() === 'Hủy')!
      .click();
    expect(await result).toBeUndefined();
  });
});
