import { Directive, input } from '@angular/core';

export type SkeletonVariant = 'text' | 'title' | 'block';

/**
 * A shimmering placeholder that keeps the layout of what is loading. Hidden from assistive
 * technology: mark the loading region (`aria-busy`) or show a `uiSpinner` status instead.
 * The shimmer stops under `prefers-reduced-motion`.
 */
@Directive({
  selector: '[uiSkeleton]',
  host: {
    class: 'skeleton',
    '[class]': '"skeleton--" + variant()',
    'aria-hidden': 'true',
  },
})
export class Skeleton {
  readonly variant = input<SkeletonVariant>('text');
}
