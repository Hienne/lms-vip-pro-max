import { TestBed } from '@angular/core/testing';
import { NAPAS_FLOW } from '@lms/mocks';
import { FLOW_REDUCED_MOTION, FLOW_WEBGL } from '../../flow-support';
import { FLOW_STEP_MS, FlowPlayerStore } from './flow-player.store';

function setup(reducedMotion = false): FlowPlayerStore {
  TestBed.configureTestingModule({
    providers: [
      FlowPlayerStore,
      { provide: FLOW_WEBGL, useValue: true },
      { provide: FLOW_REDUCED_MOTION, useValue: reducedMotion },
    ],
  });
  const store = TestBed.inject(FlowPlayerStore);
  store.setFlow(NAPAS_FLOW);
  return store;
}

describe('FlowPlayerStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts on the first step with its counter', () => {
    const store = setup();
    expect(store.step$()?.id).toBe('s1');
    expect(store.counter$()).toBe('Bước 1/9');
    expect(store.playing$()).toBe(false);
  });

  it('moves on every 3 seconds while playing and stops at the last step', () => {
    const store = setup();
    store.play();
    vi.advanceTimersByTime(FLOW_STEP_MS - 1);
    expect(store.index$()).toBe(0);
    vi.advanceTimersByTime(1);
    expect(store.index$()).toBe(1);
    vi.advanceTimersByTime(FLOW_STEP_MS * 20);
    expect(store.index$()).toBe(8);
    expect(store.playing$()).toBe(false);
  });

  it('restarts from step 1 when played from the end', () => {
    const store = setup();
    store.seek(8);
    store.play();
    expect(store.index$()).toBe(0);
    expect(store.playing$()).toBe(true);
  });

  it('pauses, steps and seeks within bounds', () => {
    const store = setup();
    store.play();
    store.pause();
    vi.advanceTimersByTime(FLOW_STEP_MS * 3);
    expect(store.index$()).toBe(0);
    store.prev();
    expect(store.index$()).toBe(0);
    store.next();
    store.next();
    expect(store.counter$()).toBe('Bước 3/9');
    store.seek(99);
    expect(store.index$()).toBe(8);
    expect(store.atEnd$()).toBe(true);
  });

  it('a seek while playing restarts the 3 seconds of the new step', () => {
    const store = setup();
    store.play();
    vi.advanceTimersByTime(FLOW_STEP_MS - 100);
    store.seek(4);
    vi.advanceTimersByTime(FLOW_STEP_MS - 1);
    expect(store.index$()).toBe(4);
    vi.advanceTimersByTime(1);
    expect(store.index$()).toBe(5);
  });

  it('never auto-advances under reduced motion', () => {
    const store = setup(true);
    store.play();
    vi.advanceTimersByTime(FLOW_STEP_MS * 3);
    expect(store.playing$()).toBe(false);
    expect(store.index$()).toBe(0);
    store.next();
    expect(store.index$()).toBe(1);
  });

  it('counts as started after a play or a step, until stop', () => {
    const store = setup();
    expect(store.started$()).toBe(false);
    store.seek(3);
    expect(store.started$()).toBe(true);
    store.play();
    store.stop();
    expect(store.playing$()).toBe(false);
    expect(store.started$()).toBe(false);
    vi.advanceTimersByTime(FLOW_STEP_MS);
    expect(store.step$()?.id).toBe('s4');
  });

  it('falls back to the list when the scene fails', () => {
    const store = setup();
    expect(store.showScene$()).toBe(true);
    store.sceneFailed();
    expect(store.showScene$()).toBe(false);
  });
});
