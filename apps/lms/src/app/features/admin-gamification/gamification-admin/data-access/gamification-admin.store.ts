import { Dialog } from '@angular/cdk/dialog';
import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  gamificationEndpoints,
  MAX_CALENDAR_YEAR,
  MIN_CALENDAR_YEAR,
  trainingCatalogEndpoints,
  type AdminBadge,
  type SaveBadgeCommand,
  type SaveCalendarYearCommand,
  type SaveGamificationConfigCommand,
} from '@lms/contracts';
import { confirm, type TabItem } from '@lms/ui';
import { filter, interval } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';

export type GamificationAdminTab = 'config' | 'calendar' | 'badges' | 'history';

/** How often the badge list is read again while a badge is still being awarded in the background. */
const BACKFILL_POLL_MS = 2000;

/** The badge form: closed, creating a new badge, or editing one. */
export type BadgeEditing = 'closed' | 'new' | AdminBadge;

/**
 * The gamification admin screen: the version in force, the history of versions and the working calendar
 * of one year, plus the two saves. A save is the server's answer to show again, so every accepted save
 * bumps a token the reads reload on. Only system admins reach the endpoints; the server refuses anyone else.
 */
@Injectable()
export class GamificationAdminStore {
  private readonly client = inject(EndpointClient);
  private readonly dialog = inject(Dialog);
  private readonly session = inject(SessionStore);

  private readonly state = {
    tab: signal<GamificationAdminTab>('config'),
    year: signal(new Date().getFullYear()),
    editing: signal<BadgeEditing>('closed'),
  };

  private readonly configChanges = invalidation();
  private readonly calendarChanges = invalidation();
  private readonly badgeChanges = invalidation();

  private readonly configData = serverData(
    () => this.client.call(gamificationEndpoints.config),
    { reloadOn: this.configChanges },
  );
  private readonly versionsData = serverData(
    () => this.client.call(gamificationEndpoints.configVersions),
    { reloadOn: this.configChanges },
  );
  private readonly calendarData = serverData(
    (year: number) =>
      this.client.call(gamificationEndpoints.calendar, { params: { year } }),
    { params: () => this.state.year(), reloadOn: this.calendarChanges },
  );

  private readonly badgesData = serverData(
    () => this.client.call(gamificationEndpoints.badges),
    { reloadOn: this.badgeChanges },
  );
  private readonly programsData = serverData(
    (ownerOrgId: number) =>
      this.client.call(trainingCatalogEndpoints.listPrograms, {
        query: { ownerOrgId, size: 100 },
      }),
    { params: () => this.session.user$()?.org?.id },
  );

  private readonly saveConfigMutation = serverMutation(
    (command: SaveGamificationConfigCommand) =>
      this.client.call(gamificationEndpoints.saveConfig, { body: command }),
    {
      errors: 'toast',
      success: (_command, saved) => ({
        title: `Đã lưu phiên bản ${saved.versionNo}`,
        detail: 'Áp dụng từ bây giờ. XP đã ghi trước đó không đổi.',
      }),
      invalidates: this.configChanges,
    },
  );
  private readonly saveCalendarMutation = serverMutation(
    (input: { year: number; command: SaveCalendarYearCommand }) =>
      this.client.call(gamificationEndpoints.saveCalendar, {
        params: { year: input.year },
        body: input.command,
      }),
    {
      errors: 'toast',
      success: (input) => `Đã lưu lịch năm ${input.year}`,
      invalidates: this.calendarChanges,
    },
  );

  private readonly saveBadgeMutation = serverMutation(
    (input: { badgeId: number | null; command: SaveBadgeCommand }) =>
      input.badgeId === null
        ? this.client.call(gamificationEndpoints.createBadge, {
            body: input.command,
          })
        : this.client.call(gamificationEndpoints.updateBadge, {
            params: { badgeId: input.badgeId },
            body: input.command,
          }),
    {
      errors: 'toast',
      success: (input, saved) =>
        input.badgeId === null
          ? {
              title: `Đã tạo huy hiệu ${saved.name}`,
              detail: 'Đang trao cho những người đã đủ điều kiện.',
            }
          : `Đã lưu huy hiệu ${saved.name}`,
      onSuccess: () => this.setEditing('closed'),
      invalidates: this.badgeChanges,
    },
  );
  private readonly retireBadgeMutation = serverMutation(
    (badge: AdminBadge) =>
      this.client.call(gamificationEndpoints.retireBadge, {
        params: { badgeId: badge.badgeId },
      }),
    {
      errors: 'toast',
      success: (_badge, retired) => `Đã ngừng dùng huy hiệu ${retired.name}`,
      invalidates: this.badgeChanges,
    },
  );

  readonly tab$ = this.state.tab.asReadonly();
  readonly year$ = this.state.year.asReadonly();
  readonly canStepBack$ = computed(() => this.state.year() > MIN_CALENDAR_YEAR);
  readonly canStepForward$ = computed(
    () => this.state.year() < MAX_CALENDAR_YEAR,
  );
  readonly tabs: readonly TabItem[] = [
    { id: 'config', label: 'XP & cấp độ' },
    { id: 'calendar', label: 'Lịch nghỉ' },
    { id: 'badges', label: 'Huy hiệu' },
    { id: 'history', label: 'Lịch sử phiên bản' },
  ];

  readonly config$ = this.configData.value;
  readonly versions$ = this.versionsData.value;
  readonly calendar$ = this.calendarData.value;
  readonly badges$ = this.badgesData.value;
  readonly badgesError$ = this.badgesData.error;
  readonly isBadgesLoading$ = this.badgesData.isLoading;
  readonly programs$ = computed(() => this.programsData.value()?.items ?? []);
  readonly editing$ = this.state.editing.asReadonly();
  readonly isSavingBadge$ = this.saveBadgeMutation.isPending;
  readonly isRetiringBadge$ = this.retireBadgeMutation.isPending;
  /** True while any badge is still being awarded in the background; the list then refreshes by itself. */
  readonly isAwarding$ = computed(() =>
    (this.badgesData.value() ?? []).some((b) => b.backfillStatus === 'RUNNING'),
  );
  readonly isLoading$ = this.configData.isLoading;
  readonly loadError$ = this.configData.error;
  readonly historyError$ = this.versionsData.error;
  readonly calendarError$ = this.calendarData.error;
  readonly isCalendarLoading$ = this.calendarData.isLoading;
  readonly isSavingConfig$ = this.saveConfigMutation.isPending;
  readonly isSavingCalendar$ = this.saveCalendarMutation.isPending;

  constructor() {
    interval(BACKFILL_POLL_MS)
      .pipe(
        filter(() => this.isAwarding$()),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.badgesData.reload());
  }

  // Setters: the only writers of state
  private setEditing(editing: BadgeEditing): void {
    this.state.editing.set(editing);
  }

  private setTab(tab: GamificationAdminTab): void {
    this.state.tab.set(tab);
  }

  private setYear(year: number): void {
    this.state.year.set(year);
  }

  // Commands
  selectTab(tab: string): void {
    if (
      tab === 'config' ||
      tab === 'calendar' ||
      tab === 'badges' ||
      tab === 'history'
    ) {
      this.setTab(tab);
    }
  }

  stepYear(delta: -1 | 1): void {
    const next = this.state.year() + delta;
    if (next >= MIN_CALENDAR_YEAR && next <= MAX_CALENDAR_YEAR) {
      this.setYear(next);
    }
  }

  saveConfig(command: SaveGamificationConfigCommand): void {
    this.saveConfigMutation.run(command);
  }

  saveCalendar(command: SaveCalendarYearCommand): void {
    this.saveCalendarMutation.run({ year: this.state.year(), command });
  }

  newBadge(): void {
    this.setEditing('new');
  }

  editBadge(badge: AdminBadge): void {
    this.setEditing(badge);
  }

  closeBadgeForm(): void {
    this.setEditing('closed');
  }

  /** Saves the open badge form; it closes when the server accepts the save. */
  saveBadge(command: SaveBadgeCommand): void {
    const editing = this.state.editing();
    const badgeId =
      editing === 'new' || editing === 'closed' ? null : editing.badgeId;
    this.saveBadgeMutation.run({ badgeId, command });
  }

  /** Asks first; retiring stops new awards and leaves every holder with the badge. */
  retireBadge(badge: AdminBadge): void {
    confirm(this.dialog, {
      title: `Ngừng dùng huy hiệu "${badge.name}"?`,
      message:
        badge.holders > 0
          ? `Huy hiệu sẽ không được trao nữa. ${badge.holders} người đã nhận vẫn giữ huy hiệu.`
          : 'Huy hiệu sẽ không được trao nữa. Chưa có ai nhận huy hiệu này.',
      confirmLabel: 'Ngừng dùng',
      tone: 'danger',
    })
      .pipe(filter(Boolean))
      .subscribe(() => this.retireBadgeMutation.run(badge));
  }

  retryLoad(): void {
    this.badgesData.reload();
    this.configData.reload();
    this.versionsData.reload();
    this.calendarData.reload();
  }
}
