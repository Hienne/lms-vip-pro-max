import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NAPAS_FLOW } from '@lms/mocks';
import { FlowCanvas } from '../flow-canvas/flow-canvas';
import { FLOW_REDUCED_MOTION, FLOW_WEBGL } from '../flow-support';
import { FlowPlayer } from './flow-player';

/** Stands in for the three.js canvas, which jsdom cannot draw. */
@Component({ selector: 'app-flow-canvas', template: '' })
class FakeCanvas {}

async function render(webgl: boolean, reducedMotion = false) {
  TestBed.configureTestingModule({
    providers: [
      { provide: FLOW_WEBGL, useValue: webgl },
      { provide: FLOW_REDUCED_MOTION, useValue: reducedMotion },
    ],
  });
  TestBed.overrideComponent(FlowPlayer, {
    remove: { imports: [FlowCanvas] },
    add: { imports: [FakeCanvas] },
  });
  const fixture = TestBed.createComponent(FlowPlayer);
  fixture.componentRef.setInput('flow', NAPAS_FLOW);
  await fixture.whenStable();
  return fixture;
}

const text = (el: Element | null) =>
  el?.textContent?.replace(/\s+/g, ' ').trim();

describe('FlowPlayer', () => {
  it('announces the step, its counter and description, and lists every step', async () => {
    const fixture = await render(true);
    const el: HTMLElement = fixture.nativeElement;
    const caption = el.querySelector('[aria-live="polite"]');
    expect(text(caption)).toContain('Bước 1/9');
    expect(text(caption)).toContain('Khách hàng nhập lệnh chuyển tiền');
    expect(text(caption)).toContain('Smart OTP');
    const items = el.querySelectorAll('.flow-player__step');
    expect(items).toHaveLength(9);
    expect(text(items[3])).toContain('Core Banking → tự xử lý');
    expect(items[0].getAttribute('aria-current')).toBe('step');
  });

  it('seeks when a step of the list is clicked', async () => {
    const fixture = await render(true);
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelectorAll('.flow-player__step')[5] as HTMLButtonElement).click();
    await fixture.whenStable();
    const caption = text(el.querySelector('[aria-live="polite"]'));
    expect(caption).toContain('Bước 6/9');
    expect(caption).toContain('Gửi lệnh sang NAPAS');
    expect(
      el.querySelectorAll('.flow-player__step')[5].getAttribute('aria-current'),
    ).toBe('step');
  });

  it('disables Play under reduced motion and still steps by hand', async () => {
    const fixture = await render(true, true);
    const el: HTMLElement = fixture.nativeElement;
    const play = el.querySelector<HTMLButtonElement>('[aria-label="Phát"]')!;
    expect(play.disabled).toBe(true);
    el.querySelector<HTMLButtonElement>('[aria-label="Bước sau"]')!.click();
    await fixture.whenStable();
    expect(text(el.querySelector('[aria-live="polite"]'))).toContain(
      'Bước 2/9',
    );
  });

  it('without WebGL shows the numbered list with names, kinds and own work', async () => {
    const fixture = await render(false);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-flow-canvas')).toBeNull();
    expect(el.textContent).toContain(
      'Máy không hiển thị được 3D, các bước được liệt kê theo thứ tự.',
    );
    const items = el.querySelectorAll('.flow-player__fallback li');
    expect(items).toHaveLength(9);
    expect(text(items[0])).toContain(
      'Khách hàng (Khách hàng) → BIDV SmartBanking (Kênh (App/Web/Quầy))',
    );
    expect(text(items[3])).toContain(
      'Core Banking (Hệ thống nội bộ) → tự xử lý',
    );
    expect(text(items[6])).toContain('NAPAS phản hồi thành công');
  });
});
