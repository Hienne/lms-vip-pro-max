import { TestBed } from '@angular/core/testing';
import { NetworkStore } from './network.store';

describe('NetworkStore', () => {
  const window$ = () => TestBed.inject(NetworkStore);

  it('starts online', () => {
    expect(window$().offline$()).toBe(false);
  });

  it('follows the browser online and offline events', () => {
    const store = window$();
    window.dispatchEvent(new Event('offline'));
    expect(store.offline$()).toBe(true);
    window.dispatchEvent(new Event('online'));
    expect(store.offline$()).toBe(false);
  });

  it('can be switched by commands, as the dev toolbar does', () => {
    const store = window$();
    store.goOffline();
    expect(store.offline$()).toBe(true);
    store.goOnline();
    expect(store.offline$()).toBe(false);
  });

  it('stops listening when destroyed', () => {
    const store = window$();
    TestBed.resetTestingModule();
    window.dispatchEvent(new Event('offline'));
    expect(store.offline$()).toBe(false);
  });
});
