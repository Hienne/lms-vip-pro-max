import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Rating } from './rating';
import { Stars } from './stars';

@Component({
  imports: [Stars],
  template: `<ui-stars [value]="value()" [count]="count()" />`,
})
class StarsHost {
  readonly value = signal(4.26);
  readonly count = signal<number | undefined>(18);
}

@Component({
  imports: [Rating],
  template: `<ui-rating label="Đánh giá từ 1 đến 5 sao" [(value)]="value" />`,
})
class RatingHost {
  readonly value = signal(0);
}

describe('Stars', () => {
  async function render() {
    const fixture = TestBed.createComponent(StarsHost);
    fixture.detectChanges();
    await fixture.whenStable();
    return {
      fixture,
      root: fixture.nativeElement as HTMLElement,
      host: fixture.componentInstance,
    };
  }

  it('hides the star glyphs from assistive technology and carries the value in a sentence', async () => {
    const { root } = await render();
    expect(
      root.querySelector('[aria-hidden="true"]')?.querySelectorAll('ui-icon'),
    ).toHaveLength(5);
    expect(root.querySelector('.sr-only')?.textContent).toBe('4,3 trên 5 sao');
  });

  it('shows the rounded score and the review count', async () => {
    const { root } = await render();
    expect(root.textContent).toContain('4,3');
    expect(root.textContent).toContain('(18 đánh giá)');
  });

  it('fills the stars up to the rounded value and dims the rest', async () => {
    const { root } = await render();
    const dim = Array.from(root.querySelectorAll('.stars__star')).map((s) =>
      s.classList.contains('stars__star--off'),
    );
    expect(dim).toEqual([false, false, false, false, true]);
  });

  it('omits the count when there is none', async () => {
    const { fixture, root, host } = await render();
    host.count.set(undefined);
    fixture.detectChanges();
    expect(root.textContent).not.toContain('đánh giá');
  });
});

describe('Rating', () => {
  async function render() {
    const fixture = TestBed.createComponent(RatingHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const stars = () =>
      Array.from(root.querySelectorAll<HTMLElement>('[role="radio"]'));
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const press = async (key: string) => {
      (document.activeElement as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true }),
      );
      await settle();
    };
    return {
      fixture,
      root,
      stars,
      settle,
      press,
      host: fixture.componentInstance,
    };
  }

  it('is a named radio group of five radios called "n sao"', async () => {
    const { root, stars } = await render();
    expect(
      root.querySelector('[role="radiogroup"]')?.getAttribute('aria-label'),
    ).toBe('Đánh giá từ 1 đến 5 sao');
    expect(stars().map((s) => s.getAttribute('aria-label'))).toEqual([
      '1 sao',
      '2 sao',
      '3 sao',
      '4 sao',
      '5 sao',
    ]);
  });

  it('checks the chosen star and lights every star up to it', async () => {
    const { stars, settle, host } = await render();
    host.value.set(3);
    await settle();
    expect(stars().map((s) => s.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'true',
      'false',
      'false',
    ]);
    expect(stars().map((s) => s.classList.contains('is-on'))).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it('chooses a star on click and emits the value', async () => {
    const { stars, settle, host } = await render();
    stars()[3].click();
    await settle();
    expect(host.value()).toBe(4);
  });

  it('puts the first star in the tab order until one is chosen, then the chosen one', async () => {
    const { stars, settle, host } = await render();
    expect(stars().map((s) => s.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
      '-1',
      '-1',
    ]);
    host.value.set(2);
    await settle();
    expect(stars().map((s) => s.getAttribute('tabindex'))).toEqual([
      '-1',
      '0',
      '-1',
      '-1',
      '-1',
    ]);
  });

  it('moves focus and selection with the arrow keys, wrapping at the ends', async () => {
    const { stars, press, host } = await render();
    stars()[0].focus();
    await press('ArrowRight');
    expect(host.value()).toBe(2);
    expect(document.activeElement).toBe(stars()[1]);
    await press('ArrowDown');
    expect(host.value()).toBe(3);
    await press('ArrowLeft');
    expect(host.value()).toBe(2);
    await press('Home');
    expect(host.value()).toBe(1);
    await press('ArrowLeft');
    expect(host.value()).toBe(5);
    expect(document.activeElement).toBe(stars()[4]);
  });
});
