import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import {
  ERROR_TOAST_DURATION_MS,
  MAX_TOASTS,
  Toaster,
  TOAST_DURATION_MS,
} from './toaster';

function setup() {
  const toaster = TestBed.inject(Toaster);
  const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce');
  const toasts = () =>
    Array.from(document.body.querySelectorAll<HTMLElement>('.toast'));
  const flush = () => TestBed.tick();
  return { toaster, announce, toasts, flush };
}

describe('Toaster', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    TestBed.inject(Toaster).dismissAll();
    TestBed.tick();
    document.querySelector('.cdk-overlay-container')?.remove();
    vi.useRealTimers();
  });

  it('shows a toast with its kind, title and message on an overlay', () => {
    const { toaster, toasts, flush } = setup();
    toaster.success('Đã lưu thay đổi', 'Thông báo mẫu');
    flush();

    const [toast] = toasts();
    expect(toast.classList).toContain('toast--success');
    expect(toast.querySelector('.toast__title')?.textContent).toBe(
      'Đã lưu thay đổi',
    );
    expect(toast.querySelector('.toast__msg')?.textContent).toBe(
      'Thông báo mẫu',
    );
    expect(toast.closest('.cdk-overlay-container')).not.toBeNull();
  });

  it('lets clicks through the pane around the toasts', () => {
    const { toaster, toasts, flush } = setup();
    toaster.error('Không lưu được');
    flush();

    const pane = toasts()[0].closest<HTMLElement>('.toasts-pane');
    expect(pane?.style.pointerEvents).toBe('none');
  });

  it.each(['success', 'error', 'warning', 'info'] as const)(
    'styles a %s toast',
    (kind) => {
      const { toaster, toasts, flush } = setup();
      toaster[kind]('Tiêu đề');
      flush();
      expect(toasts()[0].classList).toContain(`toast--${kind}`);
      expect(toasts()[0].querySelector('.toast__msg')).toBeNull();
    },
  );

  it('stacks toasts oldest first and keeps at most the newest MAX_TOASTS', () => {
    const { toaster, toasts, flush } = setup();
    for (let i = 1; i <= MAX_TOASTS + 2; i++) toaster.info(`Toast ${i}`);
    flush();

    const titles = toasts().map(
      (t) => t.querySelector('.toast__title')?.textContent,
    );
    expect(titles).toHaveLength(MAX_TOASTS);
    expect(titles[0]).toBe('Toast 3');
    expect(titles.at(-1)).toBe(`Toast ${MAX_TOASTS + 2}`);
  });

  it('dismisses with the close button', () => {
    const { toaster, toasts, flush } = setup();
    toaster.info('Một');
    flush();
    const close = toasts()[0].querySelector<HTMLButtonElement>('button');
    expect(close?.getAttribute('aria-label')).toBe('Đóng thông báo');

    close?.click();
    flush();
    expect(toasts()).toHaveLength(0);
  });

  it('auto-dismisses after the duration', () => {
    const { toaster, toasts, flush } = setup();
    toaster.success('Xong');
    flush();

    vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
    flush();
    expect(toasts()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    flush();
    expect(toasts()).toHaveLength(0);
  });

  it('keeps errors for 5 seconds', () => {
    const { toaster, toasts, flush } = setup();
    toaster.error('Không lưu được');
    flush();

    vi.advanceTimersByTime(ERROR_TOAST_DURATION_MS - 1);
    flush();
    expect(toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    flush();
    expect(toasts()).toHaveLength(0);
  });

  it('pauses the timer while hovered and resumes with the time left', () => {
    const { toaster, toasts, flush } = setup();
    toaster.info('Rê chuột');
    flush();
    const toast = toasts()[0];

    vi.advanceTimersByTime(TOAST_DURATION_MS - 1000);
    toast.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(TOAST_DURATION_MS * 5);
    flush();
    expect(toasts()).toHaveLength(1);

    toast.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(999);
    flush();
    expect(toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    flush();
    expect(toasts()).toHaveLength(0);
  });

  it('pauses the timer while focus is inside the toast', () => {
    const { toaster, toasts, flush } = setup();
    toaster.info('Tiêu điểm');
    flush();
    const toast = toasts()[0];

    toast.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    vi.advanceTimersByTime(TOAST_DURATION_MS * 5);
    flush();
    expect(toasts()).toHaveLength(1);

    toast.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    vi.advanceTimersByTime(TOAST_DURATION_MS);
    flush();
    expect(toasts()).toHaveLength(0);
  });

  it('offers one action that stays until used, then runs it and closes', () => {
    const { toaster, toasts, flush } = setup();
    const run = vi.fn();
    toaster.offer('Đã có phiên bản mới. Tải lại trang?', {
      label: 'Tải lại',
      run,
    });
    flush();

    vi.advanceTimersByTime(TOAST_DURATION_MS * 3);
    flush();
    const action =
      toasts()[0]?.querySelector<HTMLButtonElement>('.toast__action');
    expect(action?.textContent?.trim()).toBe('Tải lại');

    action?.click();
    flush();
    expect(run).toHaveBeenCalledOnce();
    expect(toasts()).toHaveLength(0);
  });

  it('keeps an action toast after hover ends', () => {
    const { toaster, toasts, flush } = setup();
    toaster.offer('Có bản mới', { label: 'Tải lại', run: () => undefined });
    flush();
    const [toast] = toasts();
    toast.dispatchEvent(new MouseEvent('mouseenter'));
    toast.dispatchEvent(new MouseEvent('mouseleave'));

    vi.advanceTimersByTime(TOAST_DURATION_MS * 3);
    flush();
    expect(toasts()).toHaveLength(1);
  });

  it('announces errors assertively and everything else politely', () => {
    const { toaster, announce } = setup();
    toaster.error('Không lưu được', 'Thử lại sau');
    toaster.success('Đã lưu');

    expect(announce).toHaveBeenNthCalledWith(
      1,
      'Không lưu được. Thử lại sau',
      'assertive',
    );
    expect(announce).toHaveBeenNthCalledWith(2, 'Đã lưu', 'polite');
  });
});
