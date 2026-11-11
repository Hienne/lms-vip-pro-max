import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pollWhileVisible } from './poll-while-visible';

describe('pollWhileVisible', () => {
  let state: DocumentVisibilityState = 'visible';

  beforeEach(() => {
    vi.useFakeTimers();
    state = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
      () => state,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ticks on the interval while the page is visible', () => {
    const tick = vi.fn();
    const stop = pollWhileVisible(1000, tick);
    vi.advanceTimersByTime(3000);
    expect(tick).toHaveBeenCalledTimes(3);
    stop();
  });

  it('does not tick while hidden and ticks once when visible again', () => {
    const tick = vi.fn();
    const stop = pollWhileVisible(1000, tick);
    state = 'hidden';
    vi.advanceTimersByTime(5000);
    expect(tick).not.toHaveBeenCalled();
    state = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(tick).toHaveBeenCalledTimes(1);
    stop();
  });

  it('stops ticking after it is stopped', () => {
    const tick = vi.fn();
    pollWhileVisible(1000, tick)();
    vi.advanceTimersByTime(5000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(tick).not.toHaveBeenCalled();
  });
});
