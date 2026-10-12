import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Alert, AlertAction, type AlertTone } from './alert';

@Component({
  imports: [Alert, AlertAction],
  template: `
    <ui-alert [tone]="tone()" [heading]="heading()" [announce]="announce()"
      >Đã xuất bản khóa học.
      <button uiAlertAction type="button">Xem</button>
    </ui-alert>
  `,
})
class Host {
  readonly tone = signal<AlertTone>('info');
  readonly heading = signal('');
  readonly announce = signal(true);
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const alert = fixture.nativeElement.querySelector('ui-alert') as HTMLElement;
  return { fixture, host: fixture.componentInstance, alert };
}

describe('Alert', () => {
  it.each([
    ['info', 'status'],
    ['success', 'status'],
    ['warning', 'status'],
    ['danger', 'alert'],
  ] as const)('%s: tone class and role', (tone, role) => {
    const { fixture, host, alert } = render();
    host.tone.set(tone);
    fixture.detectChanges();

    expect(alert.classList.contains('alert')).toBe(true);
    expect(alert.classList.contains(`alert--${tone}`)).toBe(tone !== 'info');
    expect(alert.getAttribute('role')).toBe(role);
  });

  it('defaults to the info tone', () => {
    const { alert } = render();
    expect(alert.className).not.toMatch(/alert--/);
  });

  it('shows a decorative icon that differs per tone, so meaning is not colour alone', () => {
    const { fixture, host, alert } = render();
    const shapes = new Set<string>();
    for (const tone of ['info', 'success', 'warning', 'danger'] as const) {
      host.tone.set(tone);
      fixture.detectChanges();
      const icon = alert.querySelector('ui-icon') as HTMLElement;
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      shapes.add(icon.innerHTML);
    }
    expect(shapes.size).toBe(4);
  });

  it('drops the live-region role for a static alert', () => {
    const { fixture, host, alert } = render();
    host.tone.set('danger');
    host.announce.set(false);
    fixture.detectChanges();
    expect(alert.hasAttribute('role')).toBe(false);
  });

  it('shows the message, an optional heading and projected actions', () => {
    const { fixture, host, alert } = render();
    expect(alert.querySelector('.alert__title')).toBeNull();
    host.heading.set('Còn 3 câu chưa trả lời');
    fixture.detectChanges();

    expect(alert.querySelector('.alert__title')?.textContent).toContain(
      'Còn 3 câu chưa trả lời',
    );
    expect(alert.querySelector('.alert__body')?.textContent).toContain(
      'Đã xuất bản khóa học.',
    );
    expect(alert.querySelector('.alert__actions button')?.textContent).toBe(
      'Xem',
    );
  });
});
