import { TestBed } from '@angular/core/testing';
import { VIDEO_BEAT_MS, VideoBlock, type VideoSeek } from './video-block';

interface Probe {
  readonly el: HTMLElement;
  readonly video: () => HTMLVideoElement | null;
  /** The player's clock, which a real element moves by itself. */
  readonly time: (seconds: number) => void;
  readonly fire: (type: string, paused?: boolean) => void;
  readonly played: number[];
  readonly paused: number[];
  readonly beats: number[];
  readonly seeks: VideoSeek[];
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
  const seeks: VideoSeek[] = [];
  const seconds: number[] = [];
  const bookmarks: number[] = [];
  let retries = 0;
  fixture.componentInstance.played.subscribe((p) => played.push(p));
  fixture.componentInstance.paused.subscribe((p) => paused.push(p));
  fixture.componentInstance.beat.subscribe((p) => beats.push(p));
  fixture.componentInstance.jumped.subscribe((s) => seeks.push(s));
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
    seeks,
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

  it('is the native player on the content URL, with controls, metadata only and no autoplay', () => {
    const { video } = render();
    const player = video()!;
    expect(player.getAttribute('src')).toBe(
      '/api/v1/learning-assets/7/content',
    );
    expect(player.controls).toBe(true);
    expect(player.getAttribute('preload')).toBe('metadata');
    expect(player.autoplay).toBe(false);
    expect(player.getAttribute('aria-label')).toBe('Video bài giảng');
  });

  it('jumps to the resume position once the metadata is there, without reporting a seek', () => {
    const probe = render(95);
    probe.fire('loadedmetadata');
    expect(probe.video()!.currentTime).toBe(95);
    probe.fire('seeking');
    expect(probe.seeks).toEqual([]);
  });

  it('stays at the start when there is nothing to resume', () => {
    const probe = render(0);
    probe.fire('loadedmetadata');
    expect(probe.video()!.currentTime).toBe(0);
  });

  it('reports a play with its position and a beat every 10 s while it plays', () => {
    const probe = render();
    probe.time(5);
    probe.fire('play', false);
    expect(probe.played).toEqual([5]);

    probe.time(15);
    vi.advanceTimersByTime(VIDEO_BEAT_MS);
    probe.time(25);
    vi.advanceTimersByTime(VIDEO_BEAT_MS);
    expect(probe.beats).toEqual([15, 25]);
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

  it('reports a seek from the last known position, and whether it was playing', () => {
    const probe = render();
    probe.fire('play', false);
    probe.time(40);
    probe.fire('timeupdate');
    probe.time(300);
    probe.fire('seeking');
    expect(probe.seeks).toEqual([{ from: 40, to: 300, playing: true }]);

    probe.fire('pause', true);
    probe.time(10);
    probe.fire('seeking', true);
    expect(probe.seeks[1]).toEqual({ from: 300, to: 10, playing: false });
  });

  it('tells the whole second only when it changes', () => {
    const probe = render();
    for (const time of [0.4, 5.2, 5.9, 6.1, 6.1]) {
      probe.time(time);
      probe.fire('timeupdate');
    }
    expect(probe.seconds).toEqual([5, 6]);
  });

  it('moves to a jump and reports it as a seek, like one the learner made', () => {
    const probe = render();
    probe.fire('loadedmetadata');
    probe.time(30);
    probe.fire('timeupdate');
    probe.set('jump', { value: 75, seq: 1 });
    expect(probe.video()!.currentTime).toBe(75);
    probe.fire('seeking', true);
    expect(probe.seeks).toEqual([{ from: 30, to: 75, playing: false }]);

    probe.time(10);
    probe.fire('timeupdate');
    probe.set('jump', { value: 75, seq: 2 });
    expect(probe.video()!.currentTime).toBe(75);
  });

  it('waits for the metadata before it moves to a jump, and does so only once', () => {
    const probe = render(95);
    probe.set('jump', { value: 40, seq: 1 });
    expect(probe.video()!.currentTime).toBe(0);
    probe.fire('loadedmetadata');
    expect(probe.video()!.currentTime).toBe(40);
    probe.fire('seeking', true);
    expect(probe.seeks).toHaveLength(1);

    probe.time(12);
    probe.fire('loadedmetadata');
    expect(probe.video()!.currentTime).toBe(95);
  });

  it('bookmarks the second on screen from a toggle button that shows and waits', () => {
    const probe = render();
    const button = () => probe.el.querySelector('button')!;
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
});
