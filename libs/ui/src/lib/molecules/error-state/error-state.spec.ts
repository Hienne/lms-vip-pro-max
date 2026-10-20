import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ErrorState } from './error-state';

@Component({
  imports: [ErrorState],
  template: `
    <ui-error-state
      icon="wifi-off"
      tone="warning"
      title="Mất kết nối"
      message="Dữ liệu đang nhập được giữ nguyên."
      [headingLevel]="level()"
      [retryable]="retryable()"
      (retry)="retries.set(retries() + 1)"
    >
      <a class="secondary" href="/">Về trang chủ</a>
    </ui-error-state>
  `,
})
class Host {
  readonly retries = signal(0);
  readonly retryable = signal(true);
  readonly level = signal<2 | 3 | 4>(3);
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    root,
    retryButton: () => root.querySelector('button') as HTMLButtonElement | null,
  };
}

describe('ErrorState', () => {
  it('renders the failure as an empty block with the message', () => {
    const { root } = render();
    expect(root.querySelector('ui-empty')?.classList).toContain('empty');
    expect(root.querySelector('h3')?.textContent?.trim()).toBe('Mất kết nối');
    expect(root.querySelector('p')?.textContent?.trim()).toBe(
      'Dữ liệu đang nhập được giữ nguyên.',
    );
    expect(root.querySelector('.empty__icon--warning')).not.toBeNull();
  });

  it('emits retry when the retry button is pressed', () => {
    const { host, retryButton } = render();
    expect(retryButton()?.textContent).toContain('Thử lại');
    retryButton()?.click();
    retryButton()?.click();
    expect(host.retries()).toBe(2);
  });

  it('hides the retry button when the failure is not retryable', () => {
    const { fixture, host, retryButton } = render();
    host.retryable.set(false);
    fixture.detectChanges();
    expect(retryButton()).toBeNull();
  });

  it('shows the secondary action next to retry', () => {
    const { root } = render();
    expect(root.querySelector('a.secondary')?.textContent).toContain(
      'Về trang chủ',
    );
  });

  it('passes the heading level through', () => {
    const { fixture, host, root } = render();
    host.level.set(2);
    fixture.detectChanges();
    expect(root.querySelector('h2')?.textContent?.trim()).toBe('Mất kết nối');
  });
});
