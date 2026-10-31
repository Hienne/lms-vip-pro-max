import { toSignal } from '@angular/core/rxjs-interop';
import type { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

/** A positive integer path parameter as a signal; `undefined` when the path holds none. */
export function routeId(route: ActivatedRoute, name: string) {
  return toSignal(
    route.paramMap.pipe(
      map((params) => {
        const id = Number(params.get(name));
        return Number.isInteger(id) && id > 0 ? id : undefined;
      }),
    ),
    { initialValue: undefined },
  );
}
