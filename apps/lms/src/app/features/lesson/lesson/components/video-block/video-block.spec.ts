import { TestBed } from '@angular/core/testing';
import { VIDEO_BEAT_MS, VideoBlock } from './video-block';

interface Probe {
  readonly el: HTMLElement;
  readonly video: () => HTMLVideoElement | null;
  /** The player's clock, which a real element moves by itself. */
  readonly time: (seconds: number) => void;
  readonly fire: (type: string, paused?: boolean) => void;
  readonly played: number[];
  readonly paused: number[];
  readonly beats: number[];
  readonly seconds: number[];
  readonly bookmarks: number[];
  readonly set: (name: string, value: unknown) => void;
  readonly retries: () => number;
}

function render(startAt = 0): Probe {
  const fixture = TestBed.createComponent(VideoBlock);
  fixture.componentRef.setInput('src', '/api/v1/learning-assets/7/content');
  fixture.componentRef.setInput('startAt', startAt);
  fixture.componentRef.setInput('title', 'Video bài giảng');
  const played: number[] = [];
  const paused: number[] = [];
  const beats: number[] = [];
  const seconds: number[] = [];
  const bookmarks: number[] = [];
  let retries = 0;
  fixture.componentInstance.played.subscribe((p) => played.push(p));
  fixture.componentInstance.paused.subscribe((p) => paused.push(p));
  fixture.componentInstance.beat.subscribe((p) => beats.push(p));
  fixture.componentInstance.secondChange.subscribe((s) => seconds.push(s));
  fixture.componentInstance.bookmark.subscribe((s) => bookmarks.push(s));
  fixture.componentInstance.retry.subscribe(() => (retries += 1));
  fixture.detectChanges();

  const el = fixture.nativeElement as HTMLElement;
  const video = () => el.querySelector('video');
  let now = 0;
  let isPaused = true;
  const element = video()!;
  Object.defineProperty(element, 'currentTime', {
    get: () => now,
    set: (value: number) => {
      now = value;
    },
  });
  Object.defineProperty(element, 'paused', { get: () => isPaused });
  return {
    el,
    video,
    time: (seconds) => (now = seconds),
    fire: (type, pausedNow) => {
      if (pausedNow !== undefined) isPaused = pausedNow;
      video()!.dispatchEvent(new Event(type));
      fixture.detectChanges();
    },
    played,
    paused,
    beats,
    seconds,
    bookmarks,
    set: (name, value) => {
      fixture.componentRef.setInput(name, value);
      fixture.detectChanges();
    },
    retries: () => retries,
  };
}

describe('VideoBlock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is the native player on the content URL, without native controls, with metadata only and no autoplay', () => {
    const { video } = render();
    const player = video()!;
    expect(player.getAttribute('src')).toBe(
      '/api/v1/learning-assets/7/content',
    );
    expect(player.controls).toBe(false);
    expect(player.getAttribute('preload')).toBe('metadata');
    expect(player.autoplay).toBe(false);
    expect(player.getAttribute('aria-label')).toBe('Video bài giảng');
  });

  it('jumps to the resume position once the metadata is there, without reporting a seek', () => {
    const probe = render(95);
    probe.fire('loadedmetadata');
    expect(probe.video()!.currentTime).toBe(95);
    probe.fire('seeking');
  });

  it('stays at the start when there is nothing to resume', () => {
    const probe = render(0);
    probe.fire('loadedmetadata');
    expect(probe.video()!.currentTime).toBe(0);
  });

  it('reopens an already completed video at the start when it was left at the end', () => {
    const probe = render(95);
    probe.set('completed', true);
    Object.defineProperty(probe.video(), 'duration', { value: 95 });
    probe.fire('loadedmetadata');
    expect(probe.video()!.currentTime).toBe(0);
  });

  it('does not report a heartbeat from an in-progress seek', () => {
    const probe = render();
    probe.fire('play', false);
    Object.defineProperty(probe.video(), 'seeking', { value: true });
    probe.time(20);
    vi.advanceTimersByTime(VIDEO_BEAT_MS);
    expect(probe.beats).toEqual([]);
  });

  it('reports a play with its position and a beat every 20 s while it plays', () => {
    const probe = render();
    probe.time(5);
    probe.fire('play', false);
    expect(probe.played).toEqual([5]);

    probe.time(25);
    vi.advanceTimersByTime(19_999);
    expect(probe.beats).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(probe.beats).toEqual([25]);

    probe.time(45);
    vi.advanceTimersByTime(20_000);
    expect(probe.beats).toEqual([25, 45]);
  });

  it('stops beating at a pause and reports where it paused', () => {
    const probe = render();
    probe.fire('play', false);
    probe.time(12);
    probe.fire('pause', true);
    expect(probe.paused).toEqual([12]);
    vi.advanceTimersByTime(VIDEO_BEAT_MS * 3);
    expect(probe.beats).toEqual([]);
  });

  it('reports the fractional duration once when the video finishes', () => {
    const probe = render();
    probe.fire('play', false);
    Object.defineProperty(probe.video(), 'ended', { value: true });
    Object.defineProperty(probe.video(), 'duration', { value: 11.136125 });
    probe.time(11.12);
    probe.fire('pause', true);
    probe.fire('ended');
    expect(probe.paused).toEqual([11.136125]);
    vi.advanceTimersByTime(VIDEO_BEAT_MS * 2);
    expect(probe.beats).toEqual([]);
  });

  it('restores the last playing position after a seek attempt', () => {
    const probe = render();
    probe.fire('loadedmetadata');
    probe.fire('play', false);
    probe.time(40);
    probe.fire('timeupdate');
    probe.time(300);
    probe.fire('seeking');
    expect(probe.video()!.currentTime).toBe(40);
    expect(probe.seconds).toEqual([40]);
  });

  it('tells the whole second only when it changes', () => {
    const probe = render();
    for (const time of [0.4, 5.2, 5.9, 6.1, 6.1]) {
      probe.time(time);
      probe.fire('timeupdate');
    }
    expect(probe.seconds).toEqual([5, 6]);
  });

  it('bookmarks the second on screen from a toggle button that shows and waits', () => {
    const probe = render();
    const button = () =>
      probe.el.querySelector<HTMLButtonElement>('.video__bookmark')!;
    expect(button().textContent).toContain('Đánh dấu mốc 0:00');
    probe.time(75.6);
    probe.fire('timeupdate');
    expect(button().textContent).toContain('Đánh dấu mốc 1:15');
    expect(button().getAttribute('aria-pressed')).toBe('false');

    button().click();
    expect(probe.bookmarks).toEqual([75]);

    probe.set('bookmarked', true);
    expect(button().getAttribute('aria-pressed')).toBe('true');
    probe.set('busy', true);
    expect(button().disabled).toBe(true);
  });

  it('shows an error with "Thử lại" instead of the player when the file cannot be loaded', () => {
    const probe = render();
    probe.fire('error');
    expect(probe.video()).toBeNull();
    expect(probe.el.textContent).toContain('Không phát được video.');
    const retry = probe.el.querySelector('button')!;
    expect(retry.textContent).toContain('Thử lại');

    retry.click();
    expect(probe.retries()).toBe(1);
  });

  it('stops its timer when the block goes away', () => {
    const fixture = TestBed.createComponent(VideoBlock);
    fixture.componentRef.setInput('src', '/x');
    const beats: number[] = [];
    fixture.componentInstance.beat.subscribe((p) => beats.push(p));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('video')
      .dispatchEvent(new Event('play'));
    fixture.destroy();
    vi.advanceTimersByTime(VIDEO_BEAT_MS * 2);
    expect(beats).toEqual([]);
  });

  describe('chapters', () => {
    const chapters = [
      { startSeconds: 0, title: 'Giới thiệu' },
      { startSeconds: 10, title: 'Khái niệm chính' },
      { startSeconds: 20.5, title: 'Tổng kết' },
    ];
    const items = (probe: Probe) =>
      Array.from(probe.el.querySelectorAll<HTMLElement>('.chapters__item'));

    it('shows no row for a video without chapters', () => {
      const probe = render();
      expect(probe.el.querySelector('.chapters')).toBeNull();
    });

    it('lists each chapter as "time · title"', () => {
      const probe = render();
      probe.set('chapters', chapters);
      expect(items(probe).map((b) => b.textContent?.trim())).toEqual([
        '0:00 · Giới thiệu',
        '0:10 · Khái niệm chính',
        '0:20 · Tổng kết',
      ]);
    });

    it('marks the chapter being played and follows the time', () => {
      const probe = render();
      probe.set('chapters', chapters);
      const current = () =>
        items(probe).findIndex(
          (b) => b.getAttribute('aria-current') === 'true',
        );

      expect(current()).toBe(0);
      probe.time(9);
      probe.fire('timeupdate');
      expect(current()).toBe(0);
      probe.time(10);
      probe.fire('timeupdate');
      expect(current()).toBe(1);
      probe.time(20);
      probe.fire('timeupdate');
      expect(current()).toBe(2);
    });

    it('marks no chapter before the first one starts', () => {
      const probe = render();
      probe.set('chapters', [{ startSeconds: 5, title: 'Sau lời mở đầu' }]);
      expect(items(probe)[0].getAttribute('aria-current')).toBeNull();
      probe.time(5);
      probe.fire('timeupdate');
      expect(items(probe)[0].getAttribute('aria-current')).toBe('true');
    });
  });

  describe('transcript', () => {
    const lines = [
      { startSeconds: 0, text: 'Xin chào, đây là video giới thiệu.' },
      { startSeconds: 5, text: 'Hệ thống Core Banking xử lý sổ cái.' },
      { startSeconds: 10.5, text: 'Tổng kết bài học.' },
    ];
    const details = (probe: Probe) =>
      probe.el.querySelector<HTMLDetailsElement>('details.transcript')!;
    const buttons = (probe: Probe) =>
      Array.from(probe.el.querySelectorAll<HTMLElement>('.transcript__line'));
    const search = (probe: Probe, text: string) => {
      const input = probe.el.querySelector<HTMLInputElement>(
        'input[type="search"]',
      )!;
      input.value = text;
      input.dispatchEvent(new Event('input'));
      probe.fire('timeupdate');
    };

    it('shows nothing for a video without lines', () => {
      const probe = render();
      expect(probe.el.querySelector('details')).toBeNull();
    });

    it('is closed by default and counts its lines', () => {
      const probe = render();
      probe.set('transcript', lines);
      expect(details(probe).open).toBe(false);
      expect(
        probe.el.querySelector('.transcript__summary')?.textContent?.trim(),
      ).toBe('Transcript (3 đoạn)');
    });

    it('lists each line as "time text"', () => {
      const probe = render();
      probe.set('transcript', lines);
      expect(buttons(probe).map((b) => b.textContent?.trim())).toEqual([
        '0:00 Xin chào, đây là video giới thiệu.',
        '0:05 Hệ thống Core Banking xử lý sổ cái.',
        '0:10 Tổng kết bài học.',
      ]);
    });

    it('marks the line being played and follows the time', () => {
      const probe = render();
      probe.set('transcript', lines);
      const current = () =>
        buttons(probe).findIndex(
          (b) => b.getAttribute('aria-current') === 'true',
        );

      expect(current()).toBe(0);
      probe.time(5);
      probe.fire('timeupdate');
      expect(current()).toBe(1);
      probe.time(10);
      probe.fire('timeupdate');
      expect(current()).toBe(2);
    });

    it('filters by a substring, ignoring case and accents, and keeps marking the played line', () => {
      const probe = render();
      probe.set('transcript', lines);

      search(probe, 'TONG KET');
      expect(buttons(probe).map((b) => b.textContent?.trim())).toEqual([
        '0:10 Tổng kết bài học.',
      ]);

      search(probe, 'đây');
      expect(buttons(probe)).toHaveLength(1);
      search(probe, 'day');
      expect(buttons(probe)).toHaveLength(1);

      probe.time(5);
      search(probe, 'core');
      expect(buttons(probe)).toHaveLength(1);
      expect(buttons(probe)[0].getAttribute('aria-current')).toBe('true');
    });

    it('says so when no line matches, and lists all again when the search is emptied', () => {
      const probe = render();
      probe.set('transcript', lines);

      search(probe, 'không có từ này');
      expect(buttons(probe)).toHaveLength(0);
      expect(probe.el.textContent).toContain('Không có đoạn nào khớp.');

      search(probe, '');
      expect(buttons(probe)).toHaveLength(3);
      expect(probe.el.textContent).not.toContain('Không có đoạn nào khớp.');
    });

    it('does not scroll the page to the line being played', () => {
      const probe = render();
      probe.set('transcript', lines);
      const scroll = vi.fn();
      Element.prototype.scrollIntoView = scroll;
      probe.time(10);
      probe.fire('timeupdate');
      expect(scroll).not.toHaveBeenCalled();
    });
  });
});
