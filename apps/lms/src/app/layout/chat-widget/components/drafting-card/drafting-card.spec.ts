import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { DraftingCard } from '@lms/contracts';
import { DraftingCard as DraftingCardView } from './drafting-card';

const card = (state: DraftingCard['state']): DraftingCard => ({
  sessionId: 7,
  step: 2,
  state,
  courseId: 40,
});

@Component({
  selector: 'app-host',
  imports: [DraftingCardView],
  template: `<app-drafting-card
    [card]="card()"
    (confirmed)="confirmed.push($event)"
    (opened)="opened.push($event)"
  />`,
})
class Host {
  readonly card = signal(card('proposed'));
  readonly confirmed: DraftingCard[] = [];
  readonly opened: DraftingCard[] = [];
}

describe('DraftingCard', () => {
  async function render(value: DraftingCard) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.card.set(value);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = () =>
      [...el.querySelectorAll('button')].map((b) => b.textContent?.trim());
    const text = () => el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return { fixture, el, buttons, text };
  }

  it('offers "Đã chốt" on a step waiting for the author and reports the step', async () => {
    for (const state of ['proposed', 'manual'] as const) {
      TestBed.resetTestingModule();
      const { fixture, el, buttons } = await render(card(state));
      expect(buttons()).toEqual(['Đã chốt']);
      el.querySelector('button')?.click();
      expect(fixture.componentInstance.confirmed).toEqual([card(state)]);
    }
  });

  it('says a confirmed step is settled, with no button', async () => {
    const { buttons, text } = await render(card('confirmed'));
    expect(buttons()).toEqual([]);
    expect(text()).toBe('Đã chốt bước này.');
  });

  it('says the assistant writes a step again while it proposes', async () => {
    const { buttons, text } = await render(card('proposing'));
    expect(buttons()).toEqual([]);
    expect(text()).toBe('Trợ lý đang soạn lại bước này.');
  });

  it('opens the editor from a failed step', async () => {
    const { fixture, el, buttons } = await render(card('failed'));
    expect(buttons()).toEqual(['Mở trang soạn']);
    el.querySelector('button')?.click();
    expect(fixture.componentInstance.opened).toEqual([card('failed')]);
    expect(fixture.componentInstance.confirmed).toEqual([]);
  });
});
