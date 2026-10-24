import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AgentComposer } from './agent-composer';

@Component({
  selector: 'app-host',
  imports: [AgentComposer],
  template: `<app-agent-composer
    [answering]="answering()"
    [offline]="offline()"
    (ask)="asked.push($event)"
    (stop)="stopped = stopped + 1"
  />`,
})
class Host {
  readonly answering = signal(false);
  readonly offline = signal(false);
  readonly asked: string[] = [];
  stopped = 0;
}

describe('AgentComposer', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const box = el.querySelector<HTMLTextAreaElement>('textarea')!;
    const type = async (text: string) => {
      box.value = text;
      box.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const press = async (init: KeyboardEventInit) => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
        ...init,
      });
      box.dispatchEvent(event);
      await fixture.whenStable();
      return event;
    };
    const button = () =>
      el.querySelector<HTMLButtonElement>('.composer__bar button')!;
    return {
      fixture,
      el,
      box,
      type,
      press,
      button,
      host: fixture.componentInstance,
    };
  }

  it('sends the trimmed message on Enter and empties the box', async () => {
    const { box, type, press, host } = await setup();
    await type('  EOD là gì?  ');
    const event = await press({});
    expect(event.defaultPrevented).toBe(true);
    expect(host.asked).toEqual(['EOD là gì?']);
    expect(box.value).toBe('');
  });

  it('keeps Shift+Enter for a new line and does not send during an input-method composition', async () => {
    const { type, press, host } = await setup();
    await type('Một dòng');
    expect((await press({ shiftKey: true })).defaultPrevented).toBe(false);
    expect((await press({ isComposing: true })).defaultPrevented).toBe(false);
    expect(host.asked).toEqual([]);
  });

  it('sends nothing for an empty or blank message and disables the button', async () => {
    const { type, press, button, host } = await setup();
    expect(button().disabled).toBe(true);
    await type('   ');
    await press({});
    expect(host.asked).toEqual([]);
    expect(button().disabled).toBe(true);
    await type('Có chữ');
    expect(button().disabled).toBe(false);
  });

  it('shows a counter from 400 characters and refuses more than 500', async () => {
    const { el, type, press, button, host } = await setup();
    await type('a'.repeat(399));
    expect(el.querySelector('.composer__note')).toBeNull();
    await type('a'.repeat(400));
    expect(el.querySelector('.composer__note')?.textContent).toContain(
      '400/500',
    );
    await type('a'.repeat(501));
    expect(el.querySelector('.composer__note--error')?.textContent).toContain(
      '501/500',
    );
    expect(button().disabled).toBe(true);
    await press({});
    expect(host.asked).toEqual([]);
  });

  it('turns the button into Dừng while a reply is on its way', async () => {
    const { fixture, button, host } = await setup();
    host.answering.set(true);
    await fixture.whenStable();
    expect(button().textContent).toContain('Dừng');
    button().click();
    expect(host.stopped).toBe(1);
  });

  it('disables the box and says so while offline', async () => {
    const { fixture, el, box, type, press, host } = await setup();
    host.offline.set(true);
    await fixture.whenStable();
    expect(box.disabled).toBe(true);
    expect(el.querySelector('.composer__note--error')?.textContent).toContain(
      'Mất kết nối',
    );
    await type('Không gửi được');
    await press({});
    expect(host.asked).toEqual([]);
  });
});
