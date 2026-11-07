import { computed, inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  communityReviewEndpoints,
  ReviewStatusSchema,
  type ReviewListQuery,
} from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { CommunityChanges } from '../../data-access/community-changes';

@Injectable()
export class ReviewsStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly changes = inject(CommunityChanges);
  private readonly initial = this.route.snapshot.queryParams;
  private readonly state = {
    q: signal<string>(
      typeof this.initial['q'] === 'string' ? this.initial['q'] : '',
    ),
    status: signal(
      ReviewStatusSchema.safeParse(this.initial['status']).data ?? '',
    ),
    page: signal(Math.max(1, Number(this.initial['page']) || 1)),
  };
  private readonly query = computed(
    (): ReviewListQuery => ({
      page: this.state.page() - 1,
      size: 20,
      ...(this.state.q().trim()
        ? { q: this.state.q().trim().slice(0, 300) }
        : {}),
      ...(ReviewStatusSchema.safeParse(this.state.status()).success
        ? { status: ReviewStatusSchema.parse(this.state.status()) }
        : {}),
    }),
  );
  private readonly data = serverData(
    (query: ReviewListQuery) =>
      this.client.call(communityReviewEndpoints.list, { query }),
    { params: () => this.query(), reloadOn: this.changes.contents },
  );
  readonly q$ = this.state.q.asReadonly();
  readonly status$ = this.state.status.asReadonly();
  readonly page$ = this.state.page.asReadonly();
  readonly items$ = computed(() => this.data.value()?.items ?? []);
  readonly total$ = computed(() => this.data.value()?.totalElements ?? 0);
  readonly isLoading$ = this.data.isLoading;
  readonly error$ = this.data.error;
  private setQ(value: string): void {
    this.state.q.set(value);
  }
  private setStatus(value: string): void {
    this.state.status.set(value);
  }
  private setPage(value: number): void {
    this.state.page.set(value);
  }
  search(value: string): void {
    this.setQ(value);
    this.setPage(1);
    this.syncUrl();
  }
  filter(value: string): void {
    this.setStatus(value);
    this.setPage(1);
    this.syncUrl();
  }
  goToPage(value: number): void {
    this.setPage(value);
    this.syncUrl();
  }
  retry(): void {
    this.data.reload();
  }
  private syncUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.state.q() || null,
        status: this.state.status() || null,
        page: this.state.page() > 1 ? this.state.page() : null,
      },
      replaceUrl: true,
    });
  }
}
