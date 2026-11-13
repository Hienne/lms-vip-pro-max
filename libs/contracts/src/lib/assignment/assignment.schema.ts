import { z } from 'zod';
import { BackendDateTimeSchema } from '../http/datetime';
import { PageQuerySchema } from '../http/page';
import { RequirementSchema } from '../course/course.schema';

// Mirrors the backend's assignment and learning-group endpoints (/api/v1/courses/{id}/assignments,
// /api/v1/learning-assignments, /api/v1/learning-groups). An assignment (đợt giao) targets people,
// teams, orgs or learning groups; the server resolves them into recipients once, when it is
// created, so later membership changes do not touch it. Recipients and members carry the staff
// code (`userId`) only.

export const TargetTypeSchema = z.enum([
  'user',
  'team',
  'org',
  'learning_group',
]);
export type TargetType = z.infer<typeof TargetTypeSchema>;

/** `continue` keeps a compatible enrolment; `retake` starts a new cycle. */
export const EnrollmentModeSchema = z.enum(['continue', 'retake']);
export type EnrollmentMode = z.infer<typeof EnrollmentModeSchema>;

/** Field rules shared by the assignment and group forms and the schemas. */
export const ASSIGNMENT_LIMITS = {
  title: 255,
  idempotencyKey: 100,
  reminderDaysBefore: 365,
  targets: 100,
  /** The server refuses an assignment that resolves to more learners. */
  recipients: 500,
  revokeReason: 2000,
  groupCode: 50,
  groupName: 255,
  groupDescription: 10000,
  groupMembers: 500,
  userId: 20,
} as const;

// ---- Read models ----------------------------------------------------------------------------

export const CourseAssignmentSchema = z.object({
  id: z.number().int(),
  courseId: z.number().int(),
  revisionId: z.number().int(),
  assigningOrgId: z.number().int(),
  assignedBy: z.string().nullish(),
  title: z.string().nullish(),
  startAt: BackendDateTimeSchema,
  /** Absent when there is no deadline. */
  dueAt: BackendDateTimeSchema.nullish(),
  requirement: RequirementSchema,
  enrollmentMode: EnrollmentModeSchema,
  reminderEnabled: z.boolean().nullish(),
  reminderDaysBefore: z.number().int().nullish(),
  status: z.string(),
  activatedAt: BackendDateTimeSchema.nullish(),
  idempotencyKey: z.string().nullish(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type CourseAssignment = z.infer<typeof CourseAssignmentSchema>;

export const AssignmentTargetSchema = z.object({
  id: z.number().int(),
  assignmentId: z.number().int(),
  targetType: TargetTypeSchema,
  userId: z.string().nullish(),
  teamId: z.number().int().nullish(),
  orgId: z.number().int().nullish(),
  groupId: z.number().int().nullish(),
  includeDescendants: z.boolean().nullish(),
  /** The target's name when the assignment was made. */
  targetNameSnapshot: z.string().nullish(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type AssignmentTarget = z.infer<typeof AssignmentTargetSchema>;

/** One person's obligation from one assignment. */
export const AssignmentRecipientSchema = z.object({
  id: z.number().int(),
  assignmentId: z.number().int(),
  userId: z.string(),
  enrollmentId: z.number().int().nullish(),
  orgIdSnapshot: z.number().int().nullish(),
  teamIdSnapshot: z.number().int().nullish(),
  resolvedAt: BackendDateTimeSchema.nullish(),
  effectiveStartAt: BackendDateTimeSchema.nullish(),
  effectiveDueAt: BackendDateTimeSchema.nullish(),
  requirement: RequirementSchema.nullish(),
  status: z.string(),
  revokedAt: BackendDateTimeSchema.nullish(),
  revokeReason: z.string().nullish(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type AssignmentRecipient = z.infer<typeof AssignmentRecipientSchema>;

/** Links a recipient to the target(s) that brought them in. */
export const RecipientTargetSourceSchema = z.object({
  id: z.number().int(),
  recipientId: z.number().int(),
  targetId: z.number().int(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type RecipientTargetSource = z.infer<typeof RecipientTargetSourceSchema>;

export const AssignmentDetailSchema = z.object({
  assignment: CourseAssignmentSchema,
  targets: z.array(AssignmentTargetSchema),
  recipients: z.array(AssignmentRecipientSchema),
  sources: z.array(RecipientTargetSourceSchema),
});
export type AssignmentDetail = z.infer<typeof AssignmentDetailSchema>;

export const LearningGroupSchema = z.object({
  id: z.number().int(),
  ownerOrgId: z.number().int(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  status: z.string(),
  /** Send it as `expectedVersion` to replace the members. */
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type LearningGroup = z.infer<typeof LearningGroupSchema>;

export const LearningGroupMemberSchema = z.object({
  id: z.number().int(),
  groupId: z.number().int(),
  userId: z.string(),
  joinedAt: BackendDateTimeSchema.nullish(),
  leftAt: BackendDateTimeSchema.nullish(),
  addedBy: z.string().nullish(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type LearningGroupMember = z.infer<typeof LearningGroupMemberSchema>;

/**
 * One row of an org's assignment list: the course and revision title it assigned, its targets and the
 * server's counts over active recipients (`completed` by enrolment status, `overdue` past the
 * recipient's due date and not completed).
 */
export const AssignmentSummarySchema = z.object({
  assignment: CourseAssignmentSchema,
  courseCode: z.string().nullish(),
  courseTitle: z.string().nullish(),
  targets: z.array(AssignmentTargetSchema),
  people: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  progressPercent: z.number().int().min(0).max(100),
  overdue: z.number().int().nonnegative(),
});
export type AssignmentSummary = z.infer<typeof AssignmentSummarySchema>;

/** How many learners a manual reminder reached; repeats on the same day reach nobody new. */
export const RemindResultSchema = z.object({
  reminded: z.number().int().nonnegative(),
});
export type RemindResult = z.infer<typeof RemindResultSchema>;

/** A group with its current members. */
export const GroupDetailSchema = z.object({
  group: LearningGroupSchema,
  members: z.array(LearningGroupMemberSchema),
});
export type GroupDetail = z.infer<typeof GroupDetailSchema>;

// ---- Queries and commands -------------------------------------------------------------------

/** One target: the id that matches `targetType`; `includeDescendants` for an org. */
export const TargetInputSchema = z.object({
  targetType: TargetTypeSchema,
  userId: z.string().max(ASSIGNMENT_LIMITS.userId).optional(),
  teamId: z.number().int().positive().optional(),
  orgId: z.number().int().positive().optional(),
  groupId: z.number().int().positive().optional(),
  includeDescendants: z.boolean().optional(),
});
export type TargetInput = z.infer<typeof TargetInputSchema>;

/**
 * Assigns a published revision (`AssignmentRequest`). Make `idempotencyKey` once per submit and
 * send the same key when retrying the same payload.
 */
export const AssignCourseCommandSchema = z.object({
  revisionId: z.number().int().positive(),
  assigningOrgId: z.number().int().positive(),
  title: z.string().max(ASSIGNMENT_LIMITS.title).optional(),
  startAt: z.iso.datetime({ offset: true }),
  dueAt: z.iso.datetime({ offset: true }).optional(),
  requirement: RequirementSchema,
  enrollmentMode: EnrollmentModeSchema,
  reminderEnabled: z.boolean().optional(),
  reminderDaysBefore: z
    .number()
    .int()
    .min(0)
    .max(ASSIGNMENT_LIMITS.reminderDaysBefore)
    .optional(),
  idempotencyKey: z.string().max(ASSIGNMENT_LIMITS.idempotencyKey),
  targets: z.array(TargetInputSchema).max(ASSIGNMENT_LIMITS.targets),
});
export type AssignCourseCommand = z.infer<typeof AssignCourseCommandSchema>;

/** An org's assignments of one course; the org is required. */
export const ListAssignmentsQuerySchema = PageQuerySchema.omit({
  sort: true,
}).extend({
  assigningOrgId: z.number().int().positive(),
});
export type ListAssignmentsQuery = z.infer<typeof ListAssignmentsQuerySchema>;

/** Ends one obligation; enrolment, scores and progress stay. */
export const RevokeRecipientCommandSchema = z.object({
  reason: z.string().max(ASSIGNMENT_LIMITS.revokeReason),
});
export type RevokeRecipientCommand = z.infer<
  typeof RevokeRecipientCommandSchema
>;

export const ListGroupsQuerySchema = PageQuerySchema.omit({
  sort: true,
}).extend({
  ownerOrgId: z.number().int().positive(),
});
export type ListGroupsQuery = z.infer<typeof ListGroupsQuerySchema>;

/** A learning group is separate from teams and grants no role. */
export const CreateGroupCommandSchema = z.object({
  ownerOrgId: z.number().int().positive(),
  code: z.string().max(ASSIGNMENT_LIMITS.groupCode),
  name: z.string().max(ASSIGNMENT_LIMITS.groupName),
  description: z.string().max(ASSIGNMENT_LIMITS.groupDescription).optional(),
});
export type CreateGroupCommand = z.infer<typeof CreateGroupCommandSchema>;

/** The whole member list, replacing the current one; `expectedVersion` is the group's `rowVersion`. */
export const ReplaceMembersCommandSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  userIds: z
    .array(z.string().max(ASSIGNMENT_LIMITS.userId))
    .max(ASSIGNMENT_LIMITS.groupMembers),
});
export type ReplaceMembersCommand = z.infer<typeof ReplaceMembersCommandSchema>;

/** Sorts the org assignment list accepts. */
export const ASSIGNMENT_SORTS = ['id', 'startAt', 'dueAt', 'title'] as const;

/** An org's assignments across courses, optionally of one course. */
export const ListOrgAssignmentsQuerySchema = PageQuerySchema.extend({
  assigningOrgId: z.number().int().positive(),
  courseId: z.number().int().positive().optional(),
});
export type ListOrgAssignmentsQuery = z.infer<
  typeof ListOrgAssignmentsQuerySchema
>;

/**
 * Replaces an active assignment's schedule for it and its active recipients; `expectedVersion` is the
 * assignment's `rowVersion`. No `dueAt` means no deadline.
 */
export const RescheduleAssignmentCommandSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  startAt: z.iso.datetime({ offset: true }),
  dueAt: z.iso.datetime({ offset: true }).optional(),
  reminderEnabled: z.boolean(),
  reminderDaysBefore: z
    .number()
    .int()
    .min(0)
    .max(ASSIGNMENT_LIMITS.reminderDaysBefore),
});
export type RescheduleAssignmentCommand = z.infer<
  typeof RescheduleAssignmentCommandSchema
>;

/** Server eligibility for one learner; zero percent alone never implies an untouched enrollment. */
export const RevisionChangePreviewSchema = z.object({
  enrollmentId: z.number().int().positive(),
  expectedVersion: z.number().int().nonnegative(),
  currentRevisionId: z.number().int().positive(),
  currentRevisionNo: z.number().int().positive(),
  targetRevisionId: z.number().int().positive().nullable(),
  targetRevisionNo: z.number().int().positive().nullable(),
  learningStatus: z.string(),
  activeObligations: z.number().int().nonnegative(),
  impactToken: z.string().min(1).max(64),
  canTransfer: z.boolean(),
  canRelearn: z.boolean(),
  blockReason: z.string().nullable(),
});
export const RevisionChangeCommandSchema = z.object({
  impactToken: z.string().min(1).max(64),
  enrollmentId: z.number().int().positive(),
  expectedVersion: z.number().int().nonnegative(),
  targetRevisionId: z.number().int().positive(),
  mode: z.enum(['transfer_unstarted', 'relearn']),
  reason: z.string().trim().min(1).max(2000),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
  idempotencyKey: z.string().min(1).max(100),
});
export type RevisionChangeCommand = z.infer<typeof RevisionChangeCommandSchema>;
export const RevisionChangeResultSchema = z.object({
  previousEnrollmentId: z.number().int().positive(),
  enrollmentId: z.number().int().positive(),
  assignmentId: z.number().int().positive(),
  revisionId: z.number().int().positive(),
});
