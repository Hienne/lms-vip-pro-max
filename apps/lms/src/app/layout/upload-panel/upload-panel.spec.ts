import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AgentChatStore } from '../../core/assistant/agent-chat.store';
import {
  BackgroundUploads,
  type BackgroundUpload,
} from '../../core/uploads/background-uploads';
import { UploadPanel } from './upload-panel';

const upload = (
  id: string,
  patch: Partial<BackgroundUpload> = {},
): BackgroundUpload => ({
  id,
  name: `${id}.mp4`,
  place: 'Chương 1 · Bài 2',
  percent: 40,
  state: 'uploading',
  cancellable: true,
  ...patch,
});

describe('UploadPanel', () => {
  const chatOpen = signal(false);
  const cancel = vi.fn();
  const open = vi.fn();

  function render() {
    chatOpen.set(false);
    cancel.mockReset();
    open.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: AgentChatStore, useValue: { isOpen$: chatOpen } }],
    });
    const registry = TestBed.inject(BackgroundUploads);
    const fixture = TestBed.createComponent(UploadPanel);
    const el = fixture.nativeElement as HTMLElement;
    const publish = async (
      items: readonly BackgroundUpload[],
      drawerOpen = false,
    ) => {
      registry.publish({ items, drawerOpen, cancel, open });
      TestBed.tick();
      await fixture.whenStable();
      TestBed.tick();
    };
    return { fixture, el, publish };
  }

  const rows = (el: HTMLElement) =>
    Array.from(el.querySelectorAll<HTMLElement>('.upload-panel__row'));
  const text = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim();
  const button = (el: HTMLElement, label: string | RegExp) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => {
      const name = `${b.textContent} ${b.getAttribute('aria-label') ?? ''}`
        .replace(/\s+/g, ' ')
        .trim();
      return typeof label === 'string'
        ? name.includes(label)
        : label.test(name);
    });

  afterEach(() => vi.useRealTimers());

  it('shows nothing without uploads, and nothing while the lesson drawer is open', async () => {
    const { el, publish } = render();
    await publish([]);
    expect(el.querySelector('.upload-panel')).toBeNull();

    await publish([upload('a')], true);
    expect(el.querySelector('.upload-panel')).toBeNull();

    await publish([upload('a')], false);
    expect(el.querySelector('.upload-panel')).not.toBeNull();
  });

  it('counts the uploads in its header and shows each file with its place, bar and percent', async () => {
    const { el, publish } = render();
    await publish([upload('a', { percent: 40 }), upload('b', { percent: 75 })]);

    expect(text(el.querySelector('.upload-panel__title')!)).toBe(
      'Đang tải lên (2)',
    );
    const [first] = rows(el);
    expect(text(first)).toContain('a.mp4');
    expect(text(first)).toContain('Chương 1 · Bài 2');
    expect(text(first)).toContain('40%');
    expect(first.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('lists three uploads at most, and "Xem tất cả" opens the whole list in place', async () => {
    const { el, publish } = render();
    await publish(['a', 'b', 'c', 'd', 'e'].map((id) => upload(id)));

    expect(rows(el)).toHaveLength(3);
    expect(el.querySelector('.upload-panel__list--scroll')).toBeNull();
    button(el, 'Xem tất cả (5)')!.click();
    TestBed.tick();

    expect(rows(el)).toHaveLength(5);
    expect(el.querySelector('.upload-panel__list--scroll')).not.toBeNull();
    expect(button(el, 'Xem tất cả')).toBeUndefined();

    button(el, 'Thu gọn')!.click();
    TestBed.tick();
    expect(rows(el)).toHaveLength(3);
  });

  it('offers no "Xem tất cả" for three uploads or fewer', async () => {
    const { el, publish } = render();
    await publish(['a', 'b', 'c'].map((id) => upload(id)));
    expect(button(el, 'Xem tất cả')).toBeUndefined();
  });

  it('has "Hủy" only on an upload that can still be cancelled, and calls the page', async () => {
    const { el, publish } = render();
    await publish([
      upload('a'),
      upload('b', { state: 'processing', cancellable: false }),
    ]);

    const [first, second] = rows(el);
    expect(button(second, 'Hủy')).toBeUndefined();
    button(first, 'Hủy')!.click();
    expect(cancel).toHaveBeenCalledWith('a');
    expect(open).not.toHaveBeenCalled();
  });

  it('opens the upload’s place when its row is clicked', async () => {
    const { el, publish } = render();
    await publish([upload('a'), upload('b')]);

    rows(el)[1]
      .querySelector<HTMLButtonElement>('.upload-panel__open')!
      .click();
    expect(open).toHaveBeenCalledWith('b');
  });

  it('shows ✓ for a finished upload for about four seconds, then it leaves', async () => {
    vi.useFakeTimers();
    const { el, publish } = render();
    await publish([
      upload('a', { state: 'done', percent: 100, cancellable: false }),
    ]);

    expect(text(rows(el)[0])).toContain('Đã tải lên');
    expect(rows(el)[0].querySelector('.upload-panel__done')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(3900);
    TestBed.tick();
    expect(rows(el)).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(200);
    TestBed.tick();
    expect(el.querySelector('.upload-panel')).toBeNull();
  });

  it('keeps a failed or stalled upload until it is dealt with', async () => {
    vi.useFakeTimers();
    const { el, publish } = render();
    await publish([
      upload('a', { state: 'error', status: 'Lỗi mạng', cancellable: false }),
      upload('b', { state: 'stalled', cancellable: false }),
    ]);

    await vi.advanceTimersByTimeAsync(60_000);
    TestBed.tick();
    expect(rows(el)).toHaveLength(2);
    expect(text(rows(el)[0])).toContain('Lỗi mạng');
  });

  it('shows a restarted upload again after its earlier ✓ left', async () => {
    vi.useFakeTimers();
    const { el, publish } = render();
    await publish([
      upload('a', { state: 'done', percent: 100, cancellable: false }),
    ]);
    await vi.advanceTimersByTimeAsync(4100);
    TestBed.tick();
    expect(el.querySelector('.upload-panel')).toBeNull();

    await publish([upload('a', { percent: 10 })]);
    expect(rows(el)).toHaveLength(1);
  });

  it('minimises to the header with the overall percent, and opens again', async () => {
    const { el, publish } = render();
    await publish([upload('a', { percent: 20 }), upload('b', { percent: 60 })]);

    button(el, 'Thu nhỏ')!.click();
    TestBed.tick();
    expect(rows(el)).toHaveLength(0);
    expect(text(el.querySelector('.upload-panel__head')!)).toContain(
      'Đang tải lên (2)',
    );
    expect(text(el.querySelector('.upload-panel__head')!)).toContain('40%');

    button(el, 'Mở rộng')!.click();
    TestBed.tick();
    expect(rows(el)).toHaveLength(2);
  });

  it('minimises itself when the chat panel opens, and stays minimised until opened', async () => {
    const { el, publish } = render();
    await publish([upload('a')]);
    expect(rows(el)).toHaveLength(1);

    chatOpen.set(true);
    TestBed.tick();
    expect(rows(el)).toHaveLength(0);

    chatOpen.set(false);
    TestBed.tick();
    expect(rows(el)).toHaveLength(0);
    button(el, 'Mở rộng')!.click();
    TestBed.tick();
    expect(rows(el)).toHaveLength(1);
  });
});
