import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { adminOrgEndpoints, identityEndpoints } from '@lms/contracts';
import type { TabItem } from '@lms/ui';
import { map } from 'rxjs';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { scopeLabel } from '../../../../shared/status/scope-label';
import { UserEditorStore } from '../../data-access/user-editor.store';

export type UserDetailTab =
  | 'info'
  | 'grants'
  | 'courses'
  | 'attempts'
  | 'audit';

/**
 * The user page (the mockup's `userDetail`): one user from the backend with the tab being read.
 * The info and grants tabs are the backend's; the courses, attempts and activity tabs have no
 * backend endpoint yet, so they exist only while their endpoints are served (the mock API).
 */
@Injectable()
export class UserDetailStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  private readonly editor = inject(UserEditorStore);

  private readonly state = {
    tab: signal<UserDetailTab>('info'),
  };

  private readonly userId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? undefined)),
  );

  /** The viewed user; the editor's token reloads it in place after an edit or a grant. */
  private readonly detailData = serverData(
    (userId: string) =>
      this.client.call(identityEndpoints.getUser, { params: { userId } }),
    { params: () => this.userId(), reloadOn: this.editor.changes },
  );

  // The tabs the backend lacks read when opened, so a signed-in user without them costs no request.
  private readonly hasLearningTabs = [
    adminOrgEndpoints.userCourses,
    adminOrgEndpoints.userAttempts,
    adminOrgEndpoints.userAudit,
  ].every((endpoint) => this.client.isServed(endpoint));
  private readonly onTab = (tab: UserDetailTab) =>
    this.hasLearningTabs && this.state.tab() === tab
      ? this.userId()
      : undefined;
  private readonly coursesData = serverData(
    (userId: string) =>
      this.client.call(adminOrgEndpoints.userCourses, { params: { userId } }),
    { params: () => this.onTab('courses') },
  );
  private readonly attemptsData = serverData(
    (userId: string) =>
      this.client.call(adminOrgEndpoints.userAttempts, { params: { userId } }),
    { params: () => this.onTab('attempts') },
  );
  private readonly auditData = serverData(
    (userId: string) =>
      this.client.call(adminOrgEndpoints.userAudit, { params: { userId } }),
    { params: () => this.onTab('audit') },
  );

  readonly tab$ = this.state.tab.asReadonly();
  readonly detail$ = this.detailData.value;
  readonly isLoading$ = this.detailData.isLoading;
  readonly loadError$ = this.detailData.error;
  readonly courses$ = this.coursesData.value;
  readonly attempts$ = this.attemptsData.value;
  readonly audit$ = this.auditData.value;

  readonly isSelf$ = computed(
    () => this.detail$()?.user.userId === this.editor.me$()?.userId,
  );

  /** One row per grant, with the scope worded and whether the caller may revoke it. */
  readonly grants$ = computed(() =>
    (this.detail$()?.roleGrants ?? []).map((grant) => ({
      ...grant,
      scopeText: scopeLabel(grant.scope, {
        orgName: grant.orgName,
        teamName: grant.teamName,
      }),
    })),
  );

  readonly tabs$ = computed((): readonly TabItem[] => [
    { id: 'info', label: 'Thông tin' },
    { id: 'grants', label: 'Vai trò & quyền', count: this.grants$().length },
    ...(this.hasLearningTabs
      ? [
          { id: 'courses', label: 'Khóa học được giao' },
          { id: 'attempts', label: 'Lịch sử thi' },
          { id: 'audit', label: 'Hoạt động' },
        ]
      : []),
  ]);

  // Setters: the only writers of state
  private setTab(tab: UserDetailTab): void {
    this.state.tab.set(tab);
  }

  // Commands
  selectTab(tab: string): void {
    this.setTab(tab as UserDetailTab);
  }

  retryLoad(): void {
    this.detailData.reload();
  }
}
