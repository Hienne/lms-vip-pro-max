import { computed, type Injector, type Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { courseEndpoints, type AssetContentQuery } from '@lms/contracts';
import { Observable, of, switchMap } from 'rxjs';
import type { EndpointClient } from '../../core/http/endpoint-client';

/** A course's cover image as a page shows it. */
export type CoverPreview =
  | { readonly state: 'none' | 'loading' | 'failed' }
  | { readonly state: 'ready'; readonly src: string };

/**
 * The cover image of the asset `assetId` names, for a store to expose. The content endpoint takes
 * the `academy_media` cookie only inside a learner's study session, so the file is read with the
 * session's token and handed to the `<img>` as an object URL, revoked when the cover changes or the
 * store goes. The server decides who may read it: a refusal is `failed`, and the page shows nothing.
 */
export function coverPreview(
  client: EndpointClient,
  injector: Injector,
  assetId: () => number | null | undefined,
  query: AssetContentQuery = {},
): Signal<CoverPreview> {
  return toSignal(
    toObservable(
      computed(() => assetId() ?? null),
      { injector },
    ).pipe(
      switchMap((id) =>
        id ? coverFile(client, id, query) : of<CoverPreview>({ state: 'none' }),
      ),
    ),
    { initialValue: { state: 'none' }, injector },
  );
}

/** The `src` of a ready cover, else null. */
export const coverSrc = (cover: CoverPreview): string | null =>
  cover.state === 'ready' ? cover.src : null;

function coverFile(
  client: EndpointClient,
  assetId: number,
  query: AssetContentQuery,
): Observable<CoverPreview> {
  return new Observable<CoverPreview>((subscriber) => {
    let src: string | undefined;
    subscriber.next({ state: 'loading' });
    const read = client
      .call(courseEndpoints.getAssetContent, { params: { assetId }, query })
      .subscribe({
        next: (blob) => {
          src = URL.createObjectURL(blob);
          subscriber.next({ state: 'ready', src });
        },
        error: () => subscriber.next({ state: 'failed' }),
      });
    return () => {
      read.unsubscribe();
      if (src) URL.revokeObjectURL(src);
    };
  });
}
