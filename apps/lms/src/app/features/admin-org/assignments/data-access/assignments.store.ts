import {
  computed,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  assignmentEndpoints,
  courseEndpoints,
  identityEndpoints,
  MAX_PAGE_SIZE,
  type AssignCourseCommand,
  type AssignmentSummary,
  type CourseCard,
  type CreateGroupCommand,
  type LearningGroup,
  type Page,
  type RescheduleAssignmentCommand,
} from '@lms/contracts';
import { switchMap } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';
import { courseCatalogStatus } from '../../../../shared/status/catalog-status';
import { randomId } from '../../../../core/browser/secure-context';

export const ASSIGNMENTS_PAGE_SIZE = 10;

export type AssignmentsTab = 'assignments' | 'groups';

/** A table row: the table wants a string `id`. */
export interface AssignmentRow {
  readonly id: string;
  readonly summary: AssignmentSummary;
  readonly assignment: AssignmentSummary['assignment'];
  /** The course title, else a fallback with the assignment id. */
  readonly title: string;
  readonly revoked: boolean;
  /** Every active recipient has finished: nobody left to remind. */
  readonly done: boolean;
}

/** What the schedule form sends; the store adds the assignment's version. */
export type ScheduleRequest = Omit<
  RescheduleAssignmentCommand,
  'expectedVersion'
>;

/** A learning group as the groups table lists it. */
export interface GroupRow {
  readonly id: string;
  readonly group: LearningGroup;
}

/**
 * What the assign form sends. The store adds the published revision, the assigning org and the
 * idempotency key.
 */
export type AssignRequest = Omit<
  AssignCourseCommand,
  'revisionId' | 'assigningOrgId' | 'idempotencyKey'
> & { readonly courseId: number };

interface AssignmentsQuery {
  /** Absent: every course. */
  readonly courseId: number | undefined;
  readonly orgId: number;
  readonly page: number;
  readonly size: number;
}

interface Assigning {
  /** Made when the editor opens and sent again on a retry, so a lost reply never assigns twice. */
  readonly idempotencyKey: string;
  readonly courseId: number | undefined;
}

const idParam = (value: string | null): number | undefined => {
  const id = Number(value);
  return value && Number.isInteger(id) && id > 0 ? id : undefined;
};

const newIdempotencyKey = (): string => `assign-${randomId()}`;

/**
 * Course assignment (the mockup's `assignments`): an org's assignments across courses or of one
 * course with the server's recipient counts, the assignment editor with several targets, schedule
 * changes, reminders, revoking an assignment or one recipient, and the org's learning groups. The
 * server resolves targets into recipients once, when the assignment is made; counts, due dates and
 * progress are its results.
 */
@Injectable()
export class AssignmentsStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);

  private readonly linkedCourseId = idParam(
    this.route.snapshot.queryParamMap.get('course'),
  );

  private readonly state = {
    tab: signal<AssignmentsTab>('assignments'),
    /** The course whose assignments are listed: the linked one, else every course. */
    courseId: signal<number | undefined>(this.linkedCourseId),
    page: signal(1),
    pageSize: signal(ASSIGNMENTS_PAGE_SIZE),
    /** The assign drawer; a link from the course list opens it on that course. */
    assigning: signal<Assigning | null>(
      this.linkedCourseId
        ? {
            idempotencyKey: newIdempotencyKey(),
            courseId: this.linkedCourseId,
          }
        : null,
    ),
    viewingId: signal<number | null>(null),
    revokingId: signal<number | null>(null),
    reschedulingId: signal<number | null>(null),
    withdrawingId: signal<number | null>(null),
    remindingId: signal<number | null>(null),
    creatingGroup: signal(false),
    membersOfId: signal<number | null>(null),
    /** The last page the server sent: the table stays while the next one loads. */
    shown: linkedSignal<
      Page<AssignmentSummary> | undefined,
      Page<AssignmentSummary> | undefined
    >({
      source: () => this.assignmentsData.value(),
      computation: (next, previous) => next ?? previous?.value,
    }),
  };

  private readonly orgId = computed(() => this.session.user$()?.org?.id);

  private readonly assignmentChanges = invalidation();
  private readonly groupChanges = invalidation();

  // Published courses the caller manages; paused and archived ones cannot be assigned.
  private readonly coursesData = serverData(() =>
    this.client.call(courseEndpoints.instructorCourses, {
      query: { state: 'published', size: MAX_PAGE_SIZE, sort: 'title,asc' },
    }),
  );

  private readonly assignmentsData = serverData(
    ({ courseId, orgId, page, size }: AssignmentsQuery) =>
      this.client.call(assignmentEndpoints.orgAssignments, {
        query: {
          assigningOrgId: orgId,
          ...(courseId ? { courseId } : {}),
          page: page - 1,
          size,
          sort: 'id,desc',
        },
      }),
    {
      params: (): AssignmentsQuery | undefined => {
        const orgId = this.orgId();
        return orgId
          ? {
              courseId: this.state.courseId(),
              orgId,
              page: this.state.page(),
              size: this.state.pageSize(),
            }
          : undefined;
      },
      reloadOn: this.assignmentChanges,
    },
  );

  private readonly detailData = serverData(
    (assignmentId: number) =>
      this.client.call(assignmentEndpoints.getAssignment, {
        params: { assignmentId },
      }),
    {
      params: () => this.state.viewingId() ?? undefined,
      reloadOn: this.assignmentChanges,
    },
  );

  // The people in the caller's scope: the names of recipients and members. One page is enough.
  private readonly peopleData = serverData(() =>
    this.client.call(identityEndpoints.listUsers, {
      query: { size: MAX_PAGE_SIZE, sort: 'fullName,asc', status: 'active' },
    }),
  );

  private readonly groupsData = serverData(
    (ownerOrgId: number) =>
      this.client.call(assignmentEndpoints.listGroups, {
        query: { ownerOrgId, size: MAX_PAGE_SIZE },
      }),
    { params: () => this.orgId(), reloadOn: this.groupChanges },
  );

  private readonly groupData = serverData(
    (groupId: number) =>
      this.client.call(assignmentEndpoints.getGroup, { params: { groupId } }),
    {
      params: () => this.state.membersOfId() ?? undefined,
      reloadOn: this.groupChanges,
    },
  );

  // The course list may carry the draft's revision; the server assigns the published one.
  private readonly assignMutation = serverMutation(
    ({
      courseId,
      ...command
    }: AssignRequest & { assigningOrgId: number; idempotencyKey: string }) =>
      this.client
        .call(courseEndpoints.getCourse, { params: { courseId }, query: {} })
        .pipe(
          switchMap(({ course }) =>
            this.client.call(assignmentEndpoints.assignCourse, {
              params: { courseId },
              body: { ...command, revisionId: course.publishedRevisionId ?? 0 },
            }),
          ),
        ),
    {
      errors: 'alert',
      success: (_command, detail) => ({
        title: 'Đã giao khóa học',
        detail: `${detail.recipients.length} học viên nhận lượt giao.`,
      }),
      onSuccess: () => {
        this.setAssigning(null);
        this.setPage(1);
      },
      invalidates: this.assignmentChanges,
    },
  );

  private readonly revokeMutation = serverMutation(
    ({ recipientId, reason }: { recipientId: number; reason: string }) =>
      this.client.call(assignmentEndpoints.revokeRecipient, {
        params: { recipientId },
        body: { reason },
      }),
    {
      errors: 'toast',
      success: () => ({
        title: 'Đã thu hồi',
        detail: 'Tiến độ đã học của học viên vẫn được giữ.',
      }),
      onSuccess: () => this.setRevokingId(null),
      invalidates: this.assignmentChanges,
    },
  );

  private readonly rescheduleMutation = serverMutation(
    ({ id, ...command }: RescheduleAssignmentCommand & { id: number }) =>
      this.client.call(assignmentEndpoints.rescheduleAssignment, {
        params: { assignmentId: id },
        body: command,
      }),
    {
      errors: 'alert',
      success: () => ({
        title: 'Đã cập nhật hạn',
        detail: 'Học viên nhận hạn mới ngay.',
      }),
      onSuccess: () => this.setReschedulingId(null),
      invalidates: this.assignmentChanges,
    },
  );

  private readonly remindMutation = serverMutation(
    (assignmentId: number) =>
      this.client.call(assignmentEndpoints.remindAssignment, {
        params: { assignmentId },
      }),
    {
      errors: 'toast',
      success: (_id, result) =>
        result.reminded
          ? {
              title: `Đã gửi nhắc ${result.reminded} học viên`,
              detail: 'Học viên nhận thông báo trong ứng dụng.',
            }
          : {
              title: 'Không có học viên cần nhắc',
              detail: 'Người chưa hoàn thành đã được nhắc hôm nay.',
            },
    },
  );

  private readonly withdrawMutation = serverMutation(
    ({ id, reason }: { id: number; reason: string }) =>
      this.client.call(assignmentEndpoints.revokeAssignment, {
        params: { assignmentId: id },
        body: { reason },
      }),
    {
      errors: 'alert',
      success: () => ({
        title: 'Đã thu hồi lượt giao',
        detail: 'Tiến độ đã học của học viên vẫn được giữ.',
      }),
      onSuccess: () => this.setWithdrawingId(null),
      invalidates: this.assignmentChanges,
    },
  );

  private readonly createGroupMutation = serverMutation(
    (command: CreateGroupCommand) =>
      this.client.call(assignmentEndpoints.createGroup, { body: command }),
    {
      errors: 'alert',
      success: (command) => `Đã tạo nhóm ${command.name}`,
      onSuccess: (detail) => {
        this.setCreatingGroup(false);
        this.setMembersOfId(detail.group.id);
      },
      invalidates: this.groupChanges,
    },
  );

  private readonly membersMutation = serverMutation(
    ({ group, userIds }: { group: LearningGroup; userIds: string[] }) =>
      this.client.call(assignmentEndpoints.replaceMembers, {
        params: { groupId: group.id },
        body: { expectedVersion: group.rowVersion, userIds },
      }),
    {
      errors: 'alert',
      success: (_input, detail) => ({
        title: 'Đã cập nhật thành viên',
        detail: `${detail.group.name} có ${detail.members.length} thành viên. Lượt giao đã có không đổi.`,
      }),
      onSuccess: () => this.setMembersOfId(null),
      invalidates: this.groupChanges,
    },
  );

  // Selectors
  readonly tab$ = this.state.tab.asReadonly();
  readonly courseId$ = this.state.courseId.asReadonly();
  readonly page$ = this.state.page.asReadonly();
  readonly pageSize$ = this.state.pageSize.asReadonly();
  readonly assigning$ = this.state.assigning.asReadonly();
  readonly revokingId$ = this.state.revokingId.asReadonly();
  readonly creatingGroup$ = this.state.creatingGroup.asReadonly();

  readonly courses$ = computed((): readonly CourseCard[] =>
    (this.coursesData.value()?.items ?? []).filter(
      (card) => courseCatalogStatus(card) === 'published',
    ),
  );
  readonly course$ = computed(() =>
    this.courses$().find((c) => c.courseId === this.state.courseId()),
  );

  readonly rows$ = computed((): readonly AssignmentRow[] =>
    (this.state.shown()?.items ?? []).map((summary) => ({
      id: String(summary.assignment.id),
      summary,
      assignment: summary.assignment,
      title: summary.courseTitle || `Lượt giao #${summary.assignment.id}`,
      revoked: summary.assignment.status === 'revoked',
      done: summary.people > 0 && summary.completed === summary.people,
    })),
  );
  /** The row whose schedule is being changed. */
  readonly rescheduling$ = computed(() =>
    this.rows$().find((r) => r.assignment.id === this.state.reschedulingId()),
  );
  /** The row being revoked as a whole. */
  readonly withdrawing$ = computed(() =>
    this.rows$().find((r) => r.assignment.id === this.state.withdrawingId()),
  );
  readonly total$ = computed(() => this.state.shown()?.totalElements ?? 0);

  readonly people$ = computed(() => this.peopleData.value()?.items ?? []);
  /** Staff code to full name, for recipients and members. */
  readonly names$ = computed(
    () => new Map(this.people$().map((p) => [p.userId, p.fullName])),
  );
  readonly groups$ = computed((): readonly GroupRow[] =>
    (this.groupsData.value()?.items ?? []).map((group) => ({
      id: String(group.id),
      group,
    })),
  );

  readonly detail$ = computed(() =>
    this.state.viewingId() === null ? undefined : this.detailData.value(),
  );
  readonly isViewing$ = computed(() => this.state.viewingId() !== null);
  readonly detailError$ = this.detailData.error;
  readonly groupDetail$ = computed(() =>
    this.state.membersOfId() === null ? undefined : this.groupData.value(),
  );
  readonly isEditingMembers$ = computed(
    () => this.state.membersOfId() !== null,
  );
  readonly groupError$ = this.groupData.error;

  readonly isLoading$ = computed(
    () =>
      this.coursesData.isLoading() ||
      (this.state.shown() === undefined && this.assignmentsData.isLoading()),
  );
  readonly loadError$ = computed(
    () => this.coursesData.error() ?? this.assignmentsData.error(),
  );
  readonly groupsLoading$ = this.groupsData.isLoading;
  readonly groupsError$ = this.groupsData.error;

  readonly isAssigning$ = this.assignMutation.isPending;
  readonly assignError$ = this.assignMutation.error;
  readonly isRevoking$ = this.revokeMutation.isPending;
  readonly isRescheduling$ = this.rescheduleMutation.isPending;
  readonly rescheduleError$ = this.rescheduleMutation.error;
  readonly isWithdrawing$ = this.withdrawMutation.isPending;
  readonly withdrawError$ = this.withdrawMutation.error;
  /** The assignment a reminder is being sent for. */
  readonly remindingId$ = computed(() =>
    this.remindMutation.isPending() ? this.state.remindingId() : null,
  );
  readonly isCreatingGroup$ = this.createGroupMutation.isPending;
  readonly createGroupError$ = this.createGroupMutation.error;
  readonly isSavingMembers$ = this.membersMutation.isPending;
  readonly membersError$ = this.membersMutation.error;

  readonly counts$ = computed(() => ({
    assignments: this.state.shown()?.totalElements,
    groups: this.groupsData.value()?.totalElements,
  }));

  // Setters
  private setTab(tab: AssignmentsTab): void {
    this.state.tab.set(tab);
  }

  private setCourseId(courseId: number | undefined): void {
    this.state.courseId.set(courseId);
  }

  private setPage(page: number): void {
    this.state.page.set(page);
  }

  private setAssigning(assigning: Assigning | null): void {
    this.state.assigning.set(assigning);
  }

  private setViewingId(id: number | null): void {
    this.state.viewingId.set(id);
  }

  private setRevokingId(id: number | null): void {
    this.state.revokingId.set(id);
  }

  private setReschedulingId(id: number | null): void {
    this.state.reschedulingId.set(id);
  }

  private setWithdrawingId(id: number | null): void {
    this.state.withdrawingId.set(id);
  }

  private setRemindingId(id: number | null): void {
    this.state.remindingId.set(id);
  }

  private setCreatingGroup(creating: boolean): void {
    this.state.creatingGroup.set(creating);
  }

  private setMembersOfId(id: number | null): void {
    this.state.membersOfId.set(id);
  }

  // Commands
  showTab(tab: string): void {
    if (tab === 'assignments' || tab === 'groups') this.setTab(tab);
  }

  pickCourse(value: string): void {
    this.setCourseId(idParam(value));
    this.setPage(1);
  }

  goToPage(page: number): void {
    this.setPage(page);
  }

  /** A new page size starts again at the first page. */
  changePageSize(size: number): void {
    this.state.pageSize.set(size);
    this.setPage(1);
  }

  startAssign(): void {
    this.assignMutation.reset();
    this.setAssigning({
      idempotencyKey: newIdempotencyKey(),
      courseId: this.state.courseId(),
    });
  }

  cancelAssign(): void {
    if (this.isAssigning$()) return;
    this.setAssigning(null);
  }

  assign(request: AssignRequest): void {
    const assigning = this.state.assigning();
    const assigningOrgId = this.orgId();
    if (!assigning || !assigningOrgId) return;
    this.assignMutation.run({
      ...request,
      assigningOrgId,
      idempotencyKey: assigning.idempotencyKey,
    });
  }

  view(assignmentId: number): void {
    this.setRevokingId(null);
    this.setViewingId(assignmentId);
  }

  closeView(): void {
    this.setRevokingId(null);
    this.setViewingId(null);
  }

  startRevoke(recipientId: number): void {
    this.setRevokingId(recipientId);
  }

  cancelRevoke(): void {
    this.setRevokingId(null);
  }

  revoke(recipientId: number, reason: string): void {
    this.revokeMutation.run({ recipientId, reason });
  }

  startReschedule(assignmentId: number): void {
    this.rescheduleMutation.reset();
    this.setReschedulingId(assignmentId);
  }

  cancelReschedule(): void {
    if (!this.isRescheduling$()) this.setReschedulingId(null);
  }

  reschedule(request: ScheduleRequest): void {
    const row = this.rescheduling$();
    if (!row) return;
    this.rescheduleMutation.run({
      ...request,
      id: row.assignment.id,
      expectedVersion: row.assignment.rowVersion,
    });
  }

  remind(assignmentId: number): void {
    this.setRemindingId(assignmentId);
    this.remindMutation.run(assignmentId);
  }

  startWithdraw(assignmentId: number): void {
    this.withdrawMutation.reset();
    this.setWithdrawingId(assignmentId);
  }

  cancelWithdraw(): void {
    if (!this.isWithdrawing$()) this.setWithdrawingId(null);
  }

  withdraw(reason: string): void {
    const row = this.withdrawing$();
    if (row) this.withdrawMutation.run({ id: row.assignment.id, reason });
  }

  startCreateGroup(): void {
    this.createGroupMutation.reset();
    this.setCreatingGroup(true);
  }

  cancelCreateGroup(): void {
    this.setCreatingGroup(false);
  }

  createGroup(command: Omit<CreateGroupCommand, 'ownerOrgId'>): void {
    const ownerOrgId = this.orgId();
    if (ownerOrgId) this.createGroupMutation.run({ ...command, ownerOrgId });
  }

  editMembers(groupId: number): void {
    this.membersMutation.reset();
    this.setMembersOfId(groupId);
  }

  closeMembers(): void {
    this.setMembersOfId(null);
  }

  saveMembers(group: LearningGroup, userIds: string[]): void {
    this.membersMutation.run({ group, userIds });
  }

  retryLoad(): void {
    this.coursesData.reload();
    this.assignmentsData.reload();
  }

  retryGroups(): void {
    this.groupsData.reload();
  }

  retryDetail(): void {
    this.detailData.reload();
  }

  retryGroup(): void {
    this.groupData.reload();
  }
}
