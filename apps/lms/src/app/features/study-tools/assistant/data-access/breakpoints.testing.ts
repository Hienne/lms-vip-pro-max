import { BreakpointObserver, type BreakpointState } from '@angular/cdk/layout';
import type { Provider } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';

/** A viewport whose width a spec sets: `wide` matches every `min-width` query the screen asks. */
export class FakeBreakpoints {
  readonly wide = new BehaviorSubject(true);

  isMatched(): boolean {
    return this.wide.value;
  }

  observe() {
    return this.wide.pipe(
      map((matches): BreakpointState => ({ matches, breakpoints: {} })),
    );
  }
}

export function provideFakeBreakpoints(fake: FakeBreakpoints): Provider {
  return { provide: BreakpointObserver, useValue: fake };
}
