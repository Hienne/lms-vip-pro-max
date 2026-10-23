import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AskForm } from './ask-form';

@Component({
  imports: [AskForm],
  template: `<app-ask-form
    [answering]="answering()"
    (ask)="asked.push($event)"
    (stop)="stops = stops + 1"
  />`,
})
class Host {
  readonly answering = signal(false);
  readonly asked: string[] = [];
  stops = 0;
}

describe('AskForm', () => {
  let host: Host;
  let el: HTMLElement;
  let fixture: ReturnType<typeof TestBed.createComponent<Host>>;

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const input = () => el.querySelector('input') as HTMLInputElement;
  const button = () => el.querySelector('button') as HTMLButtonElement;

  async function type(value: string) {
    input().value = value;
    input().dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
  }

  async function submit() {
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('labels the box for screen readers and caps its length', () => {
    expect(el.querySelector('label')?.textContent).toBe('Câu hỏi cho trợ lý');
    expect(el.querySelector('label')?.getAttribute('for')).toBe(input().id);
    expect(input().placeholder).toBe('Nhập câu hỏi…');
    expect(input().maxLength).toBe(300);
    expect(button().textContent).toContain('Hỏi');
  });

  it('sends the trimmed question and empties the box', async () => {
    await type('  Quy trình EOD?  ');
    await submit();
    expect(host.asked).toEqual(['Quy trình EOD?']);
    expect(input().value).toBe('');
  });

  it('sends nothing for a blank question', async () => {
    await type('   ');
    await submit();
    expect(host.asked).toEqual([]);
  });

  it('turns the button into Dừng while answering, and Enter sends nothing then', async () => {
    host.answering.set(true);
    fixture.detectChanges();
    expect(button().textContent?.trim()).toBe('Dừng');
    expect(button().type).toBe('button');
    button().click();
    expect(host.stops).toBe(1);

    await type('Câu khác');
    await submit();
    expect(host.asked).toEqual([]);
  });
});
