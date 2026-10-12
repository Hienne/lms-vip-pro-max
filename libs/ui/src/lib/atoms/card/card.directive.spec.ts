import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Card, type CardVariant } from './card.directive';
import { CardBody } from './card-body.directive';
import { CardHeader } from './card-header.directive';

@Component({
  imports: [Card, CardHeader, CardBody],
  template: `
    <article
      uiCard
      [variant]="variant()"
      [padded]="padded()"
      [interactive]="interactive()"
    >
      <div uiCardHeader><h3>Tiến độ</h3></div>
      <div uiCardBody>Nội dung</div>
    </article>
    <a uiCard interactive href="/course/1" id="link">Khóa học</a>
  `,
})
class Host {
  readonly variant = signal<CardVariant>('default');
  readonly padded = signal(false);
  readonly interactive = signal(false);
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    root,
    card: root.querySelector('article') as HTMLElement,
    host: fixture.componentInstance,
  };
}

describe('Card', () => {
  it('is a bordered surface with a header and a body part', () => {
    const { card } = render();
    expect(card.className).toBe('card');
    expect(card.querySelector('.card__header h3')?.textContent).toBe('Tiến độ');
    expect(card.querySelector('.card__body')?.textContent).toBe('Nội dung');
  });

  it.each(['tint', 'reward'] as const)('applies the %s variant', (variant) => {
    const { fixture, card, host } = render();
    host.variant.set(variant);
    fixture.detectChanges();
    expect(card.classList.contains(`card--${variant}`)).toBe(true);
  });

  it('pads itself with the padded flag', () => {
    const { fixture, card, host } = render();
    host.padded.set(true);
    fixture.detectChanges();
    expect(card.classList.contains('card--pad')).toBe(true);
  });

  it('can be an interactive card that is a native link', () => {
    const { fixture, root, card, host } = render();
    host.interactive.set(true);
    fixture.detectChanges();
    expect(card.classList.contains('card--interactive')).toBe(true);
    const link = root.querySelector('#link') as HTMLAnchorElement;
    expect(link.classList.contains('card--interactive')).toBe(true);
    expect(link.getAttribute('href')).toBe('/course/1');
    expect(link.hasAttribute('tabindex')).toBe(false);
  });
});
