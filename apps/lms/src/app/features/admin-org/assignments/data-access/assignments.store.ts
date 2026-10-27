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
  organizationEndpoints,
  type AssignCourseCommand,
  type CourseAssignment,
  type CourseCard,
  type CreateGroupCommand,
  type LearningGroup,
  type Page,
  type TargetInput,
} from '@lms/contracts';
import { switchMap } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';
import { courseCatalogStatus } from '../../../../shared/status/catalog-status';

export const ASSIGNMENTS_PAGE_SIZE = 10;

export type AssignmentsTab = 'assignments' | 'groups';

/** A table row: the table wants a string `id`. */
export interface AssignmentRow {
  readonly id: string;
  readonly assignment: CourseAssignment;
  readonly title: string;
}

/** A learning group as the groups table lists it. */
export interface GroupRow {
  readonly id: string;
  readonly group: LearningGroup;
}

/** A chosen target with the name the form shows for it. */
export type TargetPick = TargetInput & { readonly label: string };

/**
 * What the assign form sends. The store adds the published revision, the assigning org and the
 * idempotency key.
 */
export type AssignRequest = Omit<
  AssignCourseCommand,
  'revisionId' | 'assigningOrgId' | 'idempotencyKey'
> & { readonly courseId: number };

interface AssignmentsQuery {
  readonly courseId: number;
  readonly orgId: number;
  readonly page: number;
}

interface Assigning {
  /** Made when the drawer opens and sent again on a retry, so a lost reply never assigns twice. */
  readonly idempotencyKey: string;
  readonly courseId: number | undefined;
}

const idParam = (value: string | null): number | undefined => {
  const id = Number(value);
  return value && Number.isInteger(id) && id > 0 ? id : undefined;
};

const newIdempotencyKey = (): string => `assign-${crypto.randomUUID()}`;

/**
 * Course assignment (the mockup's `assignments`): an org's assignments of one published course,
 * the assign drawer with several targets, the detail of one assignment with per-recipient revoke,
 * and the org's learning groups. The server resolves targets into recipients once, when the
 * assignment is made; due dates and progress are its results. There is no API yet to change a due
 * date, send a reminder or delete an assignment.
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
    /** The course whose assignments are listed: the linked one, else the first assignable. */
    courseId: linkedSignal<readonly CourseCard[], number | undefined>({
      source: () => this.courses$(),
      computation: (courses, previous) => {
        const has = (id: number | undefined) =>
          id !== undefined && courses.some((c) => c.courseId === id);
        if (has(previous?.value)) return previous?.value;
        if (has(this.linkedCourseId)) return this.linkedCourseId;
        return courses[0]?.courseId;
      },
    }),
    page: signal(1),
    /** The assign drawer; a link from the course list opens it on that course. */
    assigning: signal<Assigning | null>(
      this.linkedCourseId
        ? {
            idempotencyKey: newIdempotencyKey(),
            courseId: this.linkedCourseId,
          }
        : null,
    ),
    /** The org whose teams the target picker offers. */
    targetOrgId: signal<number | undefined>(undefined),
    viewingId: signal<number | null>(null),
    revokingId: signal<number | null>(null),
    creatingGroup: signal(false),
    membersOfId: signal<number | null>(null),
    /** The last page the server sent: the table stays while the next one loads. */
    shown: linkedSignal<
      Page<CourseAssignment> | undefined,
      Page<CourseAssignment> | undefined
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
    ({ courseId, orgId, page }: AssignmentsQuery) =>
      this.client.call(assignmentEndpoints.courseAssignments, {
        params: { courseId },
        query: {
          assigningOrgId: orgId,
          page: page - 1,
          size: ASSIGNMENTS_PAGE_SIZE,
        },
      }),
    {
      params: (): AssignmentsQuery | undefined => {
        const courseId = this.state.courseId();
        const orgId = this.orgId();
        return courseId && orgId
          ? { courseId, orgId, page: this.state.page() }
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

  // The people, orgs and groups in the caller's scope: the target picker's options and the names
  // of recipients and members. One page of each is enough for the selects.
  private readonly peopleData = serverData(() =>
    this.client.call(identityEndpoints.listUsers, {
      query: { size: MAX_PAGE_SIZE, sort: 'fullName,asc', status: 'active' },
    }),
  );

  private readonly orgsData = serverData(() =>
    this.client.call(organizationEndpoints.listOrgs, {
      query: { size: MAX_PAGE_SIZE, sort: 'name,asc' },
    }),
  );

  private readonly teamsData = serverData(
    (orgId: number) =>
      this.client.call(organizationEndpoints.listTeams, {
        params: { orgId },
        query: { size: MAX_PAGE_SIZE, sort: 'name,asc' },
      }),
    { params: () => this.state.targetOrgId() },
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
      onSuccess: (detail) => {
        this.setAssigning(null);
        this.setCourseId(detail.assignment.courseId);
        this.setPage(1);
        this.setViewingId(detail.assignment.id);
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
    (this.state.shown()?.items ?? []).map((assignment) => ({
      id: String(assignment.id),
      assignment,
      title: assignment.title || `Lượt giao #${assignment.id}`,
    })),
  );
  readonly total$ = computed(() => this.state.shown()?.totalElements ?? 0);

  readonly people$ = computed(() => this.peopleData.value()?.items ?? []);
  /** Staff code to full name, for recipients and members. */
  readonly names$ = computed(
    () => new Map(this.people$().map((p) => [p.userId, p.fullName])),
  );
  readonly orgs$ = computed(() => this.orgsData.value()?.items ?? []);
  readonly teams$ = computed(() => this.teamsData.value()?.items ?? []);
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
      (this.state.courseId() !== undefined &&
        this.state.shown() === undefined &&
        this.assignmentsData.isLoading()),
  );
  readonly loadError$ = computed(
    () => this.coursesData.error() ?? this.assignmentsData.error(),
  );
  readonly groupsLoading$ = this.groupsData.isLoading;
  readonly groupsError$ = this.groupsData.error;

  readonly isAssigning$ = this.assignMutation.isPending;
  readonly assignError$ = this.assignMutation.error;
  readonly isRevoking$ = this.revokeMutation.isPending;
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

  private setTargetOrgId(orgId: number | undefined): void {
    this.state.targetOrgId.set(orgId);
  }

  private setViewingId(id: number | null): void {
    this.state.viewingId.set(id);
  }

  private setRevokingId(id: number | null): void {
    this.state.revokingId.set(id);
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

  startAssign(): void {
    this.assignMutation.reset();
    this.setTargetOrgId(undefined);
    this.setAssigning({
      idempotencyKey: newIdempotencyKey(),
      courseId: this.state.courseId(),
    });
  }

  cancelAssign(): void {
    this.setAssigning(null);
  }

  /** The target picker's org changed: offer that org's teams. */
  pickTargetOrg(orgId: number | undefined): void {
    this.setTargetOrgId(orgId);
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
