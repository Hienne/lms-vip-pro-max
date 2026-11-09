import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SectionCard } from './section-card';

@Component({
  imports: [SectionCard],
  template: `
    <ui-section-card id="a" title="Khóa học của tôi" [flush]="flush()">
      @if (withAction()) {
        <a slot="action" href="/catalog">Xem tất cả</a>
      }
      <p>Nội dung</p>
    </ui-section-card>
    <ui-section-card id="b" title="Hạn hoàn thành" />
  `,
})
class Host {
  readonly flush = signal(false);
  readonly withAction = signal(true);
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    card: (id: string) => root.querySelector(`#${id}`) as HTMLElement,
  };
}

describe('SectionCard', () => {
  it('is a card region named by its h2 title', () => {
    const el = render().card('a');
    const heading = el.querySelector('h2') as HTMLElement;
    expect(el.classList.contains('card')).toBe(true);
    expect(el.getAttribute('role')).toBe('region');
    expect(heading.textContent?.trim()).toBe('Khóa học của tôi');
    expect(el.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('gives every card its own heading id', () => {
    const { card } = render();
    expect(card('a').querySelector('h2')?.id).not.toBe(
      card('b').querySelector('h2')?.id,
    );
  });

  it('projects the action into the header and the content into the body', () => {
    const el = render().card('a');
    expect(
      el.querySelector('.section-card__header .section-card__action a')
        ?.textContent,
    ).toBe('Xem tất cả');
    expect(el.querySelector('.section-card__body p')?.textContent).toBe(
      'Nội dung',
    );
    expect(el.querySelector('.section-card__header p')).toBeNull();
  });

  it('leaves the action area empty without an action', () => {
    const { fixture, host, card } = render();
    host.withAction.set(false);
    fixture.detectChanges();
    expect(
      card('a').querySelector('.section-card__action')?.children,
    ).toHaveLength(0);
    expect(
      card('b').querySelector('.section-card__action')?.children,
    ).toHaveLength(0);
  });

  it('pads the body unless flush', () => {
    const { fixture, host, card } = render();
    expect(card('a').querySelector('.section-card__body--flush')).toBeNull();
    host.flush.set(true);
    fixture.detectChanges();
    expect(
      card('a').querySelector('.section-card__body--flush'),
    ).not.toBeNull();
  });
});
