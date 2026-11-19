import { computed, inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  externalConnectionEndpoints,
  oauthConsentEndpoints,
  type OAuthConsentResult,
} from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { PAGE_LOCATION } from '../../../../core/errors/stale-build';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';

/**
 * Cho phép kết nối (ADR 0005): the pending request a Trợ lý ngoài's sign-in left (`?request=`),
 * and the user's answer. Either answer sends the browser back to the client, which takes over.
 */
@Injectable()
export class ConsentStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly location = inject(PAGE_LOCATION);
  private readonly requestId =
    inject(ActivatedRoute).snapshot.queryParamMap.get('request') ?? '';

  // 1. State
  private readonly state = {
    /** An answer came back and the browser is on its way to the client. */
    leaving: signal(false),
  };

  // 2. Resources
  private readonly statusData = serverData(() =>
    this.client.call(externalConnectionEndpoints.status),
  );

  private readonly requestData = serverData(
    (requestId: string) =>
      this.client.call(oauthConsentEndpoints.read, { params: { requestId } }),
    {
      params: () =>
        this.available$() && this.requestId ? this.requestId : undefined,
    },
  );

  private readonly approveMutation = serverMutation(
    () =>
      this.client.call(oauthConsentEndpoints.approve, {
        params: { requestId: this.requestId },
      }),
    { errors: 'alert', onSuccess: (result) => this.leave(result) },
  );

  private readonly denyMutation = serverMutation(
    () =>
      this.client.call(oauthConsentEndpoints.deny, {
        params: { requestId: this.requestId },
      }),
    { errors: 'alert', onSuccess: (result) => this.leave(result) },
  );

  // 3. Selectors
  readonly isLoading$ = computed(
    () => this.statusData.isLoading() || this.requestData.isLoading(),
  );
  readonly statusError$ = this.statusData.error;
  /** The feature is on and the caller may connect now. */
  readonly available$ = computed(() => {
    const status = this.statusData.value();
    return !!status?.enabled && status.allowed;
  });
  /** The request is gone: used, expired, unknown, or the page was opened without one. */
  readonly isMissing$ = computed(
    () =>
      this.available$() &&
      (!this.requestId ||
        this.requestData.error()?.messageCode === 'CORE-RESOURCE_NOT_FOUND'),
  );
  readonly requestError$ = computed(() =>
    this.isMissing$() ? null : this.requestData.error(),
  );
  readonly request$ = this.requestData.value;
  readonly account$ = computed(() => {
    const user = this.session.user$();
    return user ? `${user.fullName} (${user.username})` : '';
  });
  readonly isAnswering$ = computed(
    () =>
      this.approveMutation.isPending() ||
      this.denyMutation.isPending() ||
      this.state.leaving(),
  );
  readonly isLeaving$ = this.state.leaving.asReadonly();
  readonly answerError$ = computed(
    () => this.approveMutation.error() ?? this.denyMutation.error(),
  );

  // 4. Setters
  setLeaving(leaving: boolean): void {
    this.state.leaving.set(leaving);
  }

  // 5. Commands
  approve(): void {
    this.denyMutation.reset();
    this.approveMutation.run(undefined);
  }

  deny(): void {
    this.approveMutation.reset();
    this.denyMutation.run(undefined);
  }

  retryLoad(): void {
    this.statusData.reload();
    this.requestData.reload();
  }

  /** Hands the browser back to the client: a web callback, or Claude Code listening on this machine. */
  private leave(result: OAuthConsentResult): void {
    this.setLeaving(true);
    this.location.assign(result.redirectUrl);
  }
}
