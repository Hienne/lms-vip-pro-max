import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CommunityReportStatusSchema,
  communityEndpoints,
  type CommunityReportStatus,
  type ModerationAction,
  type PersonRef,
  type Page,
  type ReportCard,
  type ReportListQuery,
} from '@lms/contracts';
import { map, switchMap, timer } from 'rxjs';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';
import { CommunityChanges } from '../../data-access/community-changes';
import { reloadOnConflict } from '../../data-access/conflict';

export const REPORTS_PAGE_SIZE = 20;
const CANDIDATES = 10;
const SEARCH_DELAY_MS = 300;

/** The queue filter: a report status, everything, or the reports assigned to the user. */
export type ReportFilter = CommunityReportStatus | 'all' | 'mine';

const FILTERS: readonly ReportFilter[] = [
  'all',
  ...CommunityReportStatusSchema.options,
  'mine',
];

export interface ActInput {
  readonly action: ModerationAction;
  readonly reason: string;
  readonly maintainerUserId?: string;
}

const ACTION_DONE: Readonly<Record<ModerationAction, string>> = {
  hide: 'Đã ẩn nội dung',
  restore: 'Đã khôi phục nội dung',
  restore_deleted: 'Đã khôi phục nội dung',
  soft_delete: 'Đã xóa mềm nội dung',
  close: 'Đã đóng câu hỏi',
  assign_maintainer: 'Đã chuyển người duy trì',
  warn: 'Đã cảnh báo tác giả',
  dismiss: 'Đã bác bỏ báo cáo',
};

/**
 * Báo cáo (CM-08): the report queue and one report case. The queue filter and page live in the
 * URL; the open case is `?report=<id>`, so Back returns to the queue. A 403 on the queue means the
 * user is not a moderator, and the page hides the tab.
 */
@Injectable()
export class ReportsStore {
  private readonly client = inject(EndpointClient);
  private readonly changes = inject(CommunityChanges);
  private readonly session = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly initial = this.route.snapshot.queryParams;

  readonly reportId$ = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => {
        const id = Number(params.get('report'));
        return Number.isInteger(id) && id > 0 ? id : undefined;
      }),
    ),
    { initialValue: undefined },
  );

  private readonly state = {
    filter: signal<ReportFilter>(
      FILTERS.includes(this.initial['status']) ? this.initial['status'] : 'all',
    ),
    page: signal(Math.max(1, Number(this.initial['page']) || 1)),
    /** What the person picker searches for ("Giao cho người khác", "Người duy trì"). */
    pickerQuery: signal(''),
    pickerOpen: signal(false),
    /** "Giao cho người khác" is open on the current case. */
    assigning: signal(false),
    shown: linkedSignal<
      Page<ReportCard> | undefined,
      Page<ReportCard> | undefined
    >({
      source: () => this.listData.value(),
      computation: (next, previous) => next ?? previous?.value,
    }),
  };

  private readonly query = computed((): ReportListQuery => {
    const filter = this.state.filter();
    return {
      page: this.state.page() - 1,
      size: REPORTS_PAGE_SIZE,
      ...(filter === 'mine'
        ? { assignedToMe: true }
        : filter === 'all'
          ? {}
          : { status: filter }),
    };
  });

  private readonly listData = serverData(
    (query: ReportListQuery) =>
      this.client.call(communityEndpoints.reports, { query }),
    { params: () => this.query(), reloadOn: this.changes.reports },
  );

  private readonly reportData = serverData(
    (reportId: number) =>
      this.client.call(communityEndpoints.report, { params: { reportId } }),
    { params: () => this.reportId$(), reloadOn: this.changes.reports },
  );

  private readonly evidenceData = serverData(
    (reportId: number) =>
      this.client.call(communityEndpoints.reportEvidence, {
        params: { reportId },
      }),
    {
      params: () => {
        const report = this.reportData.value();
        return report?.capabilities?.canReadEvidence
          ? report.reportId
          : undefined;
      },
      reloadOn: this.changes.reports,
    },
  );

  private readonly candidatesData = serverData(
    ({ orgId, q }: { orgId: number; q: string }) =>
      timer(SEARCH_DELAY_MS).pipe(
        switchMap(() =>
          this.client.call(communityEndpoints.moderatorCandidates, {
            query: { orgId, size: CANDIDATES, ...(q ? { q } : {}) },
          }),
        ),
      ),
    {
      params: () => {
        const orgId = this.session.user$()?.org?.id;
        return orgId && this.state.pickerOpen()
          ? { orgId, q: this.state.pickerQuery().trim().slice(0, 100) }
          : undefined;
      },
    },
  );

  /** Only an active moderator of the unit can take a report, so assignment picks from C140. */
  private readonly assigneesData = serverData(
    (orgId: number) =>
      this.client.call(communityEndpoints.moderators, {
        query: { orgId, status: 'active', size: 100 },
      }),
    {
      params: () =>
        this.state.assigning() ? this.session.user$()?.org?.id : undefined,
      reloadOn: this.changes.moderators,
    },
  );

  /** How many reports nobody has taken yet, for the tab. */
  private readonly openCountData = serverData(
    () =>
      this.client.call(communityEndpoints.reports, {
        query: { status: 'open', size: 1 },
      }),
    { reloadOn: this.changes.reports },
  );

  private readonly assignMutation = serverMutation(
    (moderatorUserId: string) => {
      const report = this.requireReport();
      return this.client
        .call(communityEndpoints.assignReport, {
          params: { reportId: report.reportId },
          body: { expectedVersion: report.version, moderatorUserId },
        })
        .pipe(reloadOnConflict(this.dialog, () => this.changes.reports.bump()));
    },
    {
      errors: 'toast',
      success: (userId) =>
        userId === this.session.user$()?.userId
          ? 'Bạn đã nhận xử lý báo cáo'
          : 'Đã giao báo cáo',
      invalidates: this.changes.reports,
      onSuccess: () => this.setAssigning(false),
    },
  );

  private readonly actMutation = serverMutation(
    (input: ActInput) => {
      const report = this.requireReport();
      const evidence = this.evidenceData.value();
      return this.client
        .call(communityEndpoints.actOnReport, {
          params: { reportId: report.reportId },
          body: {
            expectedReportVersion: report.version,
            expectedTargetVersion: evidence?.targetVersion ?? 0,
            action: input.action,
            reason: input.reason,
            ...(input.maintainerUserId
              ? { maintainerUserId: input.maintainerUserId }
              : {}),
          },
        })
        .pipe(reloadOnConflict(this.dialog, () => this.changes.reports.bump()));
    },
    {
      errors: 'toast',
      success: (input) => ACTION_DONE[input.action],
      invalidates: [this.changes.reports, this.changes.contents],
    },
  );

  // Selectors
  readonly filter$ = this.state.filter.asReadonly();
  readonly page$ = this.state.page.asReadonly();
  readonly cards$ = computed(() => this.state.shown()?.items ?? []);
  readonly total$ = computed(() => this.state.shown()?.totalElements ?? 0);
  readonly isLoading$ = computed(
    () => this.listData.isLoading() && this.state.shown() === undefined,
  );
  readonly loadError$ = this.listData.error;
  /** The server refused the queue: the user moderates nothing, so the tab is hidden. */
  readonly isForbidden$ = computed(
    () => this.listData.error()?.kind === 'forbidden',
  );
  readonly report$ = this.reportData.value;
  readonly reportLoading$ = this.reportData.isLoading;
  readonly reportError$ = this.reportData.error;
  readonly evidence$ = this.evidenceData.value;
  readonly evidenceError$ = this.evidenceData.error;
  readonly isAssignedToMe$ = computed(
    () =>
      !!this.reportData.value()?.assignedModerator &&
      this.reportData.value()?.assignedModerator?.userId ===
        this.session.user$()?.userId,
  );
  readonly isClosedCase$ = computed(() => {
    const status = this.reportData.value()?.status;
    return status === 'resolved' || status === 'dismissed';
  });
  readonly isBusy$ = computed(
    () => this.assignMutation.isPending() || this.actMutation.isPending(),
  );
  readonly candidates$ = computed(
    () => this.candidatesData.value()?.items ?? [],
  );
  readonly candidatesError$ = this.candidatesData.error;
  readonly assigning$ = this.state.assigning.asReadonly();
  /** The moderators a case can go to: everyone active but the one who has it. */
  readonly assignees$ = computed((): readonly PersonRef[] => {
    const current = this.reportData.value()?.assignedModerator?.userId;
    return (this.assigneesData.value()?.items ?? [])
      .filter((moderator) => moderator.userId !== current)
      .map((moderator) => moderator.user ?? { userId: moderator.userId });
  });
  readonly assigneesLoading$ = this.assigneesData.isLoading;
  readonly openCount$ = computed(
    () => this.openCountData.value()?.totalElements,
  );
  /** The action form sends the target's version, so it waits for the evidence that carries it. */
  readonly canSubmitAction$ = computed(
    () => !!this.evidenceData.value() && !this.actMutation.isPending(),
  );

  // Setters
  private setAssigning(assigning: boolean): void {
    this.state.assigning.set(assigning);
  }

  private setFilter(filter: ReportFilter): void {
    this.state.filter.set(filter);
  }

  private setPage(page: number): void {
    this.state.page.set(page);
  }

  // Commands
  filterBy(filter: ReportFilter): void {
    this.setFilter(filter);
    this.setPage(1);
    this.syncUrl();
  }

  goToPage(page: number): void {
    this.setPage(page);
    this.syncUrl();
  }

  openCase(reportId: number): void {
    this.setAssigning(false);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { report: reportId },
      queryParamsHandling: 'merge',
    });
  }

  closeCase(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { report: null },
      queryParamsHandling: 'merge',
    });
  }

  startAssign(): void {
    this.setAssigning(true);
  }

  cancelAssign(): void {
    this.setAssigning(false);
  }

  /** Starts or stops looking up people of the unit; the query narrows the list. */
  searchPeople(q: string): void {
    this.state.pickerOpen.set(true);
    this.state.pickerQuery.set(q);
  }

  takeCase(): void {
    const me = this.session.user$()?.userId;
    if (me) this.assignMutation.run(me);
  }

  assignTo(userId: string): void {
    this.assignMutation.run(userId);
  }

  act(input: ActInput): void {
    this.actMutation.run(input);
  }

  retryLoad(): void {
    this.listData.reload();
  }

  retryReport(): void {
    this.reportData.reload();
  }

  private requireReport() {
    const report = this.reportData.value();
    if (!report) throw new Error('No report is open');
    return report;
  }

  private syncUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: this.state.filter() === 'all' ? null : this.state.filter(),
        page: this.state.page() > 1 ? this.state.page() : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
