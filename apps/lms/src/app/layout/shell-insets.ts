import { DOCUMENT } from '@angular/common';
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
  private readonly state = { bottom: signal(0) };

  /** Height in px of the pinned bar. */
  readonly bottom = this.state.bottom.asReadonly();

  setBottom(height: number): void {
    this.state.bottom.set(height);
  }
}

/**
 * Put on a bar pinned to the bottom of the viewport: it reports its height to `ShellInsets` while
 * mounted, keeps focused fields clear of it (`scroll-padding-bottom` on the root) and gives the
 * space back when it is destroyed.
 */
@Directive({ selector: '[appBottomBar]' })
export class BottomBar {
  constructor() {
    const insets = inject(ShellInsets);
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const root = inject(DOCUMENT).documentElement;
    const observer = new ResizeObserver(() => {
      const height = element.offsetHeight;
      insets.setBottom(height);
      // a field focused with Tab scrolls into view above the bar
      root.style.scrollPaddingBottom = `${height}px`;
    });
    observer.observe(element);
    inject(DestroyRef).onDestroy(() => {
      observer.disconnect();
      insets.setBottom(0);
      root.style.removeProperty('scroll-padding-bottom');
    });
  }
}
