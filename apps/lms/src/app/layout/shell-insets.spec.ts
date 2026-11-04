import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BottomBar, ShellInsets } from './shell-insets';

/** A ResizeObserver whose callback the test fires by hand, reading the element's height. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly disconnect = vi.fn();
  readonly observe = vi.fn();
  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  fire(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

@Component({
  imports: [BottomBar],
  template: `@if (shown()) {<div appBottomBar></div>}`,
})
class Host {
  readonly shown = signal(true);
}

describe('appBottomBar', () => {
  let insets: ShellInsets;

  beforeEach(() => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    insets = TestBed.inject(ShellInsets);
  });
  afterEach(() => vi.unstubAllGlobals());

  const mount = () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const bar = fixture.nativeElement.querySelector('div') as HTMLElement;
    Object.defineProperty(bar, 'offsetHeight', {
      configurable: true,
      value: 72,
    });
    return { fixture, bar };
  };

  it('leaves no inset while no bar is mounted', () => {
    expect(insets.bottom()).toBe(0);
  });

  it("reports the bar's height as the bottom inset", () => {
    mount();
    FakeResizeObserver.instances[0].fire();
    expect(insets.bottom()).toBe(72);
  });

  it('keeps focused fields clear of the bar and lets go of that on destroy', () => {
    const root = document.documentElement;
    const { fixture } = mount();
    FakeResizeObserver.instances[0].fire();
    expect(root.style.scrollPaddingBottom).toBe('72px');
    fixture.componentInstance.shown.set(false);
    fixture.detectChanges();
    expect(root.style.scrollPaddingBottom).toBe('');
  });

  it('observes the bar it sits on', () => {
    const { bar } = mount();
    expect(FakeResizeObserver.instances[0].observe).toHaveBeenCalledWith(bar);
  });

  it('resets the inset and stops observing when the bar is destroyed', () => {
    const { fixture } = mount();
    FakeResizeObserver.instances[0].fire();
    fixture.componentInstance.shown.set(false);
    fixture.detectChanges();
    expect(insets.bottom()).toBe(0);
    expect(FakeResizeObserver.instances[0].disconnect).toHaveBeenCalled();
  });
});
