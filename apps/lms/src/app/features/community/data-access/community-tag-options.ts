import { Injectable, inject } from '@angular/core';
import { communityEndpoints } from '@lms/contracts';
import { EndpointClient } from '../../../core/http/endpoint-client';
import { serverData } from '../../../core/data-access/server-data';
import { map } from 'rxjs';

/** The tag catalogue is small (a dozen tags per organisation); one page of this size holds it. */
const TAG_PAGE_SIZE = 100;

/**
 * The tags a filter or the tag picker offers (C21), loaded once per screen. Provide it in the
 * route component's `providers`; every consumer under it shares one read.
 */
@Injectable()
export class CommunityTagOptions {
  private readonly client = inject(EndpointClient);

  private readonly tagData = serverData(() =>
    this.client
      .call(communityEndpoints.tags, { query: { size: TAG_PAGE_SIZE } })
      .pipe(map((page) => page.items)),
  );

  readonly tags$ = this.tagData.value;
  readonly isLoading$ = this.tagData.isLoading;
  readonly error$ = this.tagData.error;

  retryLoad(): void {
    this.tagData.reload();
  }
}
