import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Chip } from './chip.directive';

@Component({
  imports: [Chip],
  template: `
    <button uiChip id="toggle" [(pressed)]="active">Vận hành</button>
    <button uiChip id="plain" (click)="clicks.set(clicks() + 1)">
      Quản lý thay đổi
    </button>
  `,
})
class Host {
  readonly active = signal<boolean | undefined>(true);
  readonly clicks = signal(0);
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    toggle: root.querySelector('#toggle') as HTMLButtonElement,
    plain: root.querySelector('#plain') as HTMLButtonElement,
    host: fixture.componentInstance,
  };
}

describe('Chip', () => {
  it('is a native button that never submits a form by accident', () => {
    const { toggle } = render();
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.type).toBe('button');
    expect(toggle.classList.contains('chip')).toBe(true);
  });

  it('reflects its state in aria-pressed', () => {
    const { toggle } = render();
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('toggles on click and updates the two-way model', () => {
    const { fixture, toggle, host } = render();
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(host.active()).toBe(false);
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('follows the model when it changes from outside', () => {
    const { fixture, toggle, host } = render();
    host.active.set(false);
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('is a plain button without aria-pressed when pressed is not bound', () => {
    const { fixture, plain, host } = render();
    expect(plain.hasAttribute('aria-pressed')).toBe(false);
    plain.click();
    fixture.detectChanges();
    expect(plain.hasAttribute('aria-pressed')).toBe(false);
    expect(host.clicks()).toBe(1);
  });
});
