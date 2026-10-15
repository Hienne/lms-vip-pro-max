import {
  computed,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import type { UserDetail } from '@lms/contracts';
import type { TabItem } from '@lms/ui';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { toAppError } from '../../../../core/errors/app-error';
import { menuLabel } from '../../../../core/menu/menu-catalog';
import { AdminOrgApi } from '../../data-access/admin-org.api';
import { UserEditorStore } from '../../data-access/user-editor.store';

export type UserDetailTab = 'courses' | 'attempts' | 'role' | 'audit';

/** The user page (the mockup's `userDetail`): one user with the tab being read. */
@Injectable()
export class UserDetailStore {
  private readonly api = inject(AdminOrgApi);
  private readonly route = inject(ActivatedRoute);
  private readonly editor = inject(UserEditorStore);

  private readonly state = {
    tab: signal<UserDetailTab>('courses'),
  };

  private readonly userId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? undefined)),
  );

  /** Reads the editor's change counter, so an edit or a lock reloads the page. */
  private readonly detailResource = rxResource({
    params: () => {
      const userId = this.userId();
      return userId ? { userId, changes: this.editor.changes$() } : undefined;
    },
    stream: ({ params }) => this.api.user(params.userId),
  });

  /** The last detail the server sent for this user, kept on screen while a reload is under way. */
  private readonly latest = linkedSignal<
    { userId: string | undefined; detail: UserDetail | undefined },
    UserDetail | undefined
  >({
    source: () => ({
      userId: this.userId(),
      detail: this.detailResource.hasValue()
        ? this.detailResource.value()
        : undefined,
    }),
    computation: (source, previous) =>
      source.detail ??
      (previous?.source.userId === source.userId ? previous?.value : undefined),
  });

  readonly tab$ = this.state.tab.asReadonly();
  readonly detail$ = this.latest.asReadonly();
  readonly me$ = this.editor.me$;
  readonly isLoading$ = computed(
    () => this.detailResource.isLoading() && this.latest() === undefined,
  );
  readonly loadError$ = computed(() =>
    this.detailResource.error()
      ? toAppError(this.detailResource.error())
      : undefined,
  );

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
    this.detailResource.reload();
  }
}
