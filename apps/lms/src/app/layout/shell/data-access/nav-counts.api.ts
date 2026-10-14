import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { type NavCounts, shellEndpoints, toUrl } from '@lms/contracts';
import type { Observable } from 'rxjs';
import { parseResponse } from '../../../core/http/parse-response';

@Service()
export class NavCountsApi {
  private readonly http = inject(HttpClient);

  navCounts(): Observable<NavCounts> {
    const endpoint = shellEndpoints.navCounts;
    return this.http
      .get<unknown>(toUrl(endpoint))
      .pipe(parseResponse(endpoint.response));
  }
}
