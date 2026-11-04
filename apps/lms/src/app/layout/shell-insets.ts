import {
  DestroyRef,
  Directive,
  ElementRef,
  Injectable,
  inject,
  signal,
} from '@angular/core';

/**
 * Space a page pins along the bottom of the viewport, so what floats in the bottom corner (the
 * owl) rises above it. Zero on every page without such a bar.
 */
@Injectable({ providedIn: 'root' })
export class ShellInsets {
  /** Height in px of the pinned bar. */
  readonly bottom = signal(0);
}

/**
 * Put on a bar pinned to the bottom of the viewport: it reports its height to `ShellInsets` while
 * mounted and gives the space back when it is destroyed.
 */
@Directive({ selector: '[appBottomBar]' })
export class BottomBar {
  constructor() {
    const insets = inject(ShellInsets);
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const observer = new ResizeObserver(() =>
      insets.bottom.set(element.offsetHeight),
    );
    observer.observe(element);
    inject(DestroyRef).onDestroy(() => {
      observer.disconnect();
      insets.bottom.set(0);
    });
  }
}
