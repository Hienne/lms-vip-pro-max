import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ActionCard } from '../../../../core/assistant/agent-chat.model';
import { ActionCard as ActionCardView } from './action-card';

const card = (patch: Partial<ActionCard> = {}): ActionCard => ({
  pending: {
    id: 'a1',
    tool: 'update_profile',
    title: 'Cập nhật hồ sơ cá nhân',
    changes: [
      {
        field: 'positionName',
        label: 'Chức danh',
        from: 'Chuyên viên nghiệp vụ',
        to: 'Chuyên viên chính',
      },
    ],
    expiresAt: '2026-10-24T09:10:00Z',
  },
  status: 'pending',
  message: null,
  ...patch,
});

@Component({
  selector: 'app-host',
  imports: [ActionCardView],
  template: `<app-action-card
    [card]="card()"
    [busy]="busy()"
    (confirm)="confirmed = confirmed + 1"
    (cancel)="cancelled = cancelled + 1"
  />`,
})
class Host {
  readonly card = signal(card());
  readonly busy = signal(false);
  confirmed = 0;
  cancelled = 0;
}

describe('ActionCard', () => {
  async function render(value: ActionCard = card()) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.card.set(value);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = () =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('button')).map((b) =>
        b.textContent?.trim(),
      );
    const text = () => el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return { fixture, el, host: fixture.componentInstance, buttons, text };
  }

  it('shows the title and each change as "label: old → new"', async () => {
    const { el, text } = await render();
    expect(el.querySelector('h3')?.textContent).toBe('Cập nhật hồ sơ cá nhân');
    const row = el.querySelector('dl > div');
    expect(row?.querySelector('dt')?.textContent).toBe('Chức danh');
    expect(row?.querySelector('.change__from')?.textContent).toBe(
      'Chuyên viên nghiệp vụ',
    );
    expect(row?.querySelector('.change__to')?.textContent).toBe(
      'Chuyên viên chính',
    );
    expect(text()).toContain('đổi thành');
  });

  it('shows an empty value as (trống), on either side', async () => {
    const { el } = await render(
      card({
        pending: {
          ...card().pending,
          changes: [
            {
              field: 'email',
              label: 'Email',
              from: null,
              to: 'moi@example.test',
            },
            {
              field: 'positionName',
              label: 'Chức danh',
              from: 'Chuyên viên',
              to: null,
            },
          ],
        },
      }),
    );
    const rows = el.querySelectorAll('dl > div');
    expect(rows[0].querySelector('.change__from')?.textContent).toBe('(trống)');
    expect(rows[1].querySelector('.change__to')?.textContent).toBe('(trống)');
  });

  it('offers Xác nhận and Huỷ while pending, and tells the store which was clicked', async () => {
    const { el, host, buttons } = await render();
    expect(buttons()).toEqual(['Xác nhận', 'Huỷ']);
    const [confirm, cancel] = Array.from(
      el.querySelectorAll<HTMLButtonElement>('button'),
    );
    confirm.click();
    cancel.click();
    expect([host.confirmed, host.cancelled]).toEqual([1, 1]);
  });

  it('disables both buttons while this card or another one is confirming', async () => {
    const { fixture, el, host } = await render();
    const disabled = () =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('button')).map(
        (b) => b.disabled,
      );
    host.busy.set(true);
    await fixture.whenStable();
    expect(disabled()).toEqual([true, true]);
    host.busy.set(false);
    host.card.set(card({ status: 'confirming' }));
    await fixture.whenStable();
    expect(disabled()).toEqual([true, true]);
    expect(el.querySelector('[role="status"]')).not.toBeNull();
  });

  it.each([
    ['confirmed', 'Đã cập nhật hồ sơ.'],
    ['cancelled', 'Đã huỷ thay đổi.'],
  ] as const)(
    'replaces the buttons with the result line once %s',
    async (status, message) => {
      const { el, buttons, text } = await render(card({ status, message }));
      expect(buttons()).toEqual([]);
      expect(text()).toContain(message);
      expect(el.querySelector('.card__result--error')).toBeNull();
    },
  );

  it.each([
    [
      'expired',
      'Yêu cầu này đã hết hạn hoặc đã được xử lý. Vui lòng yêu cầu lại trợ lý.',
    ],
    [
      'failed',
      'Dữ liệu đã thay đổi từ lúc trợ lý đề xuất. Vui lòng yêu cầu lại.',
    ],
  ] as const)(
    'shows the server’s message for a %s card in the danger style, with no buttons',
    async (status, message) => {
      const { el, buttons } = await render(card({ status, message }));
      expect(buttons()).toEqual([]);
      expect(el.querySelector('.card__result--error')?.textContent).toContain(
        message,
      );
    },
  );

  it('keeps the buttons and shows the message when a pending card could not be sent', async () => {
    const { el, buttons } = await render(
      card({ message: 'Mất kết nối — không gửi được câu hỏi.' }),
    );
    expect(buttons()).toEqual(['Xác nhận', 'Huỷ']);
    expect(el.querySelector('.card__result--error')?.textContent).toContain(
      'Mất kết nối',
    );
  });
});
