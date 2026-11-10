import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Feedback, RateAnswerCommand } from '@lms/contracts';
import { AnswerFeedback } from './answer-feedback';

@Component({
  selector: 'app-host',
  imports: [AnswerFeedback],
  template: `<app-answer-feedback
    [value]="value()"
    [saving]="saving()"
    [failed]="failed()"
    (rated)="sent.push($event)"
  />`,
})
class Host {
  readonly value = signal<Feedback | null>(null);
  readonly saving = signal(false);
  readonly failed = signal(false);
  readonly sent: RateAnswerCommand[] = [];
}

describe('AnswerFeedback', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, host: fixture.componentInstance, el };
  }

  afterEach(() => document.body.replaceChildren());

  const named = (el: HTMLElement, name: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
  const text = (el: HTMLElement, label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === label,
    );

  it('has two buttons with names, neither pressed before a rating', async () => {
    const { el } = await render();
    expect(named(el, 'Câu trả lời hữu ích')?.getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(
      named(el, 'Câu trả lời chưa tốt')?.getAttribute('aria-pressed'),
    ).toBe('false');
    expect(el.querySelector('form')).toBeNull();
  });

  it('sends a thumbs-up at once', async () => {
    const { el, host } = await render();
    named(el, 'Câu trả lời hữu ích')?.click();
    expect(host.sent).toEqual([{ helpful: true }]);
  });

  it('shows the saved choice as pressed', async () => {
    const { fixture, el, host } = await render();
    host.value.set({ helpful: false, reasonCode: 'outdated', note: null });
    await fixture.whenStable();
    expect(
      named(el, 'Câu trả lời chưa tốt')?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(named(el, 'Câu trả lời hữu ích')?.getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('opens a picker with the five reasons for a thumbs-down, and sends the reason and note', async () => {
    const { fixture, el, host } = await render();
    named(el, 'Câu trả lời chưa tốt')?.click();
    await fixture.whenStable();

    const labels = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.feedback__reason'),
    ).map((b) => b.textContent?.trim());
    expect(labels).toEqual([
      'Sai',
      'Không liên quan',
      'Lỗi thời',
      'Thiếu nguồn',
      'Khác',
    ]);

    text(el, 'Lỗi thời')?.click();
    await fixture.whenStable();
    expect(text(el, 'Lỗi thời')?.getAttribute('aria-pressed')).toBe('true');
    const note = el.querySelector<HTMLTextAreaElement>('textarea');
    note!.value = '  Số liệu năm ngoái  ';
    text(el, 'Gửi đánh giá')?.click();
    await fixture.whenStable();

    expect(host.sent).toEqual([
      { helpful: false, reasonCode: 'outdated', note: 'Số liệu năm ngoái' },
    ]);
    expect(el.querySelector('form')).toBeNull();
  });

  it('lets a thumbs-down go without a reason or a note, and Hủy sends nothing', async () => {
    const { fixture, el, host } = await render();
    named(el, 'Câu trả lời chưa tốt')?.click();
    await fixture.whenStable();
    text(el, 'Hủy')?.click();
    await fixture.whenStable();
    expect(host.sent).toEqual([]);

    named(el, 'Câu trả lời chưa tốt')?.click();
    await fixture.whenStable();
    text(el, 'Gửi đánh giá')?.click();
    expect(host.sent).toEqual([{ helpful: false }]);
  });

  it('picking the same reason twice clears it', async () => {
    const { fixture, el, host } = await render();
    named(el, 'Câu trả lời chưa tốt')?.click();
    await fixture.whenStable();
    text(el, 'Sai')?.click();
    await fixture.whenStable();
    text(el, 'Sai')?.click();
    await fixture.whenStable();
    text(el, 'Gửi đánh giá')?.click();
    expect(host.sent).toEqual([{ helpful: false }]);
  });

  it('starts the picker from the earlier choice when it is changed', async () => {
    const { fixture, el, host } = await render();
    host.value.set({ helpful: false, reasonCode: 'other', note: 'Ghi chú cũ' });
    await fixture.whenStable();
    named(el, 'Câu trả lời chưa tốt')?.click();
    await fixture.whenStable();
    expect(text(el, 'Khác')?.getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
      'Ghi chú cũ',
    );
  });

  it('holds the buttons while saving and says when saving failed', async () => {
    const { fixture, el, host } = await render();
    host.saving.set(true);
    host.failed.set(true);
    await fixture.whenStable();
    expect(named(el, 'Câu trả lời hữu ích')?.disabled).toBe(true);
    expect(named(el, 'Câu trả lời chưa tốt')?.disabled).toBe(true);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Chưa lưu được đánh giá',
    );
  });
});
