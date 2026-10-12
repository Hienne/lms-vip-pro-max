import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OptionCard, type OptionCardTone } from './option-card';

@Component({
  imports: [OptionCard],
  template: `
    <ui-option-card
      id="a"
      title="Bắt buộc"
      description="Phải hoàn thành trước hạn"
    >
      <input type="radio" name="kind" value="required" />
    </ui-option-card>
    <ui-option-card id="b" title="Tự chọn" letter="B">
      <input type="radio" name="kind" value="optional" />
    </ui-option-card>
    <ui-option-card id="c" title="Trộn đáp án">
      <input type="checkbox" [disabled]="true" />
    </ui-option-card>
    <ui-option-card
      id="r"
      [title]="'Kiểm tra giao dịch'"
      [tone]="tone()"
      [chosen]="chosen()"
    />
  `,
})
class Host {
  readonly tone = signal<OptionCardTone>('correct');
  readonly chosen = signal(false);
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const card = (id: string) => root.querySelector(`#${id}`) as HTMLElement;
  return { fixture, card, host: fixture.componentInstance };
}

describe('OptionCard', () => {
  it('wraps the projected native control, title and description in one label', () => {
    const el = render().card('a');
    const label = el.querySelector('label.option-card') as HTMLElement;
    expect(label.querySelector('input[type="radio"]')).not.toBeNull();
    expect(label.querySelector('strong')?.textContent).toBe('Bắt buộc');
    expect(label.textContent).toContain('Phải hoàn thành trước hạn');
  });

  it('selects the native radio when the label is clicked, and keeps it focusable', () => {
    const { card } = render();
    const b = card('b').querySelector('input') as HTMLInputElement;
    (card('b').querySelector('label') as HTMLElement).click();
    expect(b.checked).toBe(true);
    b.focus();
    expect(document.activeElement).toBe(b);
  });

  it('shows an optional letter badge hidden from assistive technology', () => {
    const { card } = render();
    const badge = card('b').querySelector('.badge');
    expect(badge?.textContent?.trim()).toBe('B');
    expect(badge?.getAttribute('aria-hidden')).toBe('true');
    expect(card('a').querySelector('.badge')).toBeNull();
  });

  it('leaves a disabled control disabled', () => {
    const input = render().card('c').querySelector('input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('is a plain row, not a label, in review mode', () => {
    const el = render().card('r');
    expect(el.querySelector('label')).toBeNull();
    expect(el.querySelector('.answer')).not.toBeNull();
  });

  it('marks a correct answer with an icon and the text "Đáp án đúng"', () => {
    const el = render().card('r');
    expect(el.querySelector('.answer--correct')).not.toBeNull();
    expect(el.querySelector('ui-icon')?.getAttribute('aria-label')).toBe(
      'Đúng',
    );
    expect(el.textContent).toContain('Đáp án đúng');
  });

  it('marks a wrong chosen answer with an icon and "Bạn chọn", not colour alone', () => {
    const { fixture, card, host } = render();
    host.tone.set('wrong');
    host.chosen.set(true);
    fixture.detectChanges();
    const el = card('r');
    expect(el.querySelector('.answer--wrong')).not.toBeNull();
    expect(el.querySelector('ui-icon')?.getAttribute('aria-label')).toBe('Sai');
    expect(el.textContent).toContain('Bạn chọn');
    expect(el.textContent).not.toContain('Đáp án đúng');
  });

  it('shows both marks when the chosen answer is correct, and a neutral row has neither', () => {
    const { fixture, card, host } = render();
    host.chosen.set(true);
    fixture.detectChanges();
    expect(card('r').textContent).toContain('Bạn chọn');
    expect(card('r').textContent).toContain('Đáp án đúng');
    host.tone.set('neutral');
    host.chosen.set(false);
    fixture.detectChanges();
    expect(
      card('r').querySelector('.answer--correct, .answer--wrong'),
    ).toBeNull();
    expect(
      card('r').querySelector('ui-icon')?.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(card('r').textContent).not.toContain('Đáp án đúng');
  });
});
