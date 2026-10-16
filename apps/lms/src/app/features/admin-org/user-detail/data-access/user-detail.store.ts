import { adminOrgEndpoints } from '@lms/contracts';
import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { TabItem } from '@lms/ui';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { serverData } from '../../../../core/data-access/server-data';
import { menuLabel } from '../../../../core/menu/menu-catalog';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { UserEditorStore } from '../../data-access/user-editor.store';

export type UserDetailTab = 'courses' | 'attempts' | 'role' | 'audit';

/** The user page (the mockup's `userDetail`): one user with the tab being read. */
@Injectable()
export class UserDetailStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  private readonly editor = inject(UserEditorStore);

  private readonly state = {
    tab: signal<UserDetailTab>('courses'),
  };

  private readonly userId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? undefined)),
  );

  /** The viewed user; the editor's token reloads it in place after an edit or a lock. */
  private readonly detailData = serverData(
    (userId: string) =>
      this.client.call(adminOrgEndpoints.user, { params: { userId } }),
    { params: () => this.userId(), reloadOn: this.editor.changes },
  );

  readonly tab$ = this.state.tab.asReadonly();
  readonly detail$ = this.detailData.value;
  readonly me$ = this.editor.me$;
  readonly isLoading$ = this.detailData.isLoading;
  readonly loadError$ = this.detailData.error;

  /** The viewed user is the signed-in one: they cannot lock themselves out. */
  readonly isSelf$ = computed(
    () => this.detail$()?.user.id === this.editor.me$()?.id,
  );

  /** What the user's data access covers, named by the unit the server resolved. */
  readonly scopeName$ = computed(() => {
    const scope = this.detail$()?.user.scopeUnitId;
    if (scope === null || scope === undefined) return 'Toàn hệ thống';
    const unit = this.editor.meta$()?.allUnits.find((u) => u.id === scope);
    return unit ? `Chỉ đơn vị: ${unit.name}` : 'Một đơn vị';
  });

  /** The menus the role grants, by their sidebar names (the mockup listed raw permission keys). */
  readonly menuLabels$ = computed(() =>
    (this.detail$()?.role.menus ?? []).map(menuLabel),
  );

  readonly tabs$ = computed((): readonly TabItem[] => [
    {
      id: 'courses',
      label: 'Khóa học được giao',
      count: this.detail$()?.courses.length ?? 0,
    },
    {
      id: 'attempts',
      label: 'Lịch sử thi',
      count: this.detail$()?.attempts.length ?? 0,
    },
    { id: 'role', label: 'Vai trò & menu' },
    { id: 'audit', label: 'Hoạt động' },
  ]);

  private setTab(tab: UserDetailTab): void {
    this.state.tab.set(tab);
  }

  selectTab(tab: string): void {
    this.setTab(tab as UserDetailTab);
  }

  retryLoad(): void {
    this.detailData.reload();
  }
}
