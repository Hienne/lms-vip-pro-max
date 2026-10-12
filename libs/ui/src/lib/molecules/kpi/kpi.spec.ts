import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Kpi } from './kpi';

@Component({
  imports: [Kpi],
  template: `
    <ui-kpi id="plain" icon="book-open" [value]="12" label="Khóa đang học" />
    <ui-kpi
      id="full"
      icon="award"
      tone="reward"
      value="78"
      suffix="%"
      label="Hoàn thành"
      delta="+4% so với tháng trước"
    />
    <ui-kpi
      id="link"
      icon="bell"
      tone="danger"
      [value]="3"
      label="Quá hạn"
      href="/learner/overdue"
    />
  `,
})
class Host {}

function render() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const kpi = (id: string) => root.querySelector(`#${id}`) as HTMLElement;
  return { kpi };
}

describe('Kpi', () => {
  it('shows icon, value and label inside a card', () => {
    const el = render().kpi('plain');
    expect(el.querySelector('.card')).not.toBeNull();
    expect(el.querySelector('.kpi__icon ui-icon')).not.toBeNull();
    expect(el.querySelector('.kpi__value')?.textContent?.trim()).toBe('12');
    expect(el.querySelector('.kpi__label')?.textContent?.trim()).toBe(
      'Khóa đang học',
    );
    expect(el.querySelector('.kpi__delta')).toBeNull();
    expect(el.querySelector('small')).toBeNull();
  });

  it('defaults to the primary tone and applies a given one', () => {
    const { kpi } = render();
    expect(kpi('plain').querySelector('.kpi__icon')?.className).not.toContain(
      'kpi__icon--',
    );
    expect(kpi('full').querySelector('.kpi__icon--reward')).not.toBeNull();
    expect(kpi('link').querySelector('.kpi__icon--danger')).not.toBeNull();
  });

  it('renders the suffix next to the value and the delta below the label', () => {
    const el = render().kpi('full');
    expect(el.querySelector('.kpi__value small')?.textContent).toBe('%');
    expect(
      el.querySelector('.kpi__value')?.textContent?.replace(/\s+/g, ''),
    ).toBe('78%');
    expect(el.querySelector('.kpi__delta')?.textContent?.trim()).toBe(
      '+4% so với tháng trước',
    );
  });

  it('is plain content without an href', () => {
    expect(render().kpi('plain').querySelector('a')).toBeNull();
  });

  it('makes the whole card one link with a readable name when given an href', () => {
    const el = render().kpi('link');
    const links = el.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/learner/overdue');
    expect(links[0].classList.contains('card--interactive')).toBe(true);
    expect(links[0].textContent?.replace(/\s+/g, ' ').trim()).toBe('3 Quá hạn');
  });
});
