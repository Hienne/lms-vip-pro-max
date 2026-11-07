import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import {
  AssignCourseCommandSchema,
  AssignmentDetailSchema,
  AssignmentRecipientSchema,
  AssignmentSummarySchema,
  CourseAssignmentSchema,
  CreateGroupCommandSchema,
  GroupDetailSchema,
  LearningGroupSchema,
  ListAssignmentsQuerySchema,
  ListGroupsQuerySchema,
  ListOrgAssignmentsQuerySchema,
  RemindResultSchema,
  RescheduleAssignmentCommandSchema,
  ReplaceMembersCommandSchema,
  RevokeRecipientCommandSchema,
} from './assignment.schema';

const courseParams = z.object({ courseId: z.number().int() });
const groupParams = z.object({ groupId: z.number().int() });
const assignmentParams = z.object({ assignmentId: z.number().int() });

/** The backend's assignment and learning-group endpoints. */
export const assignmentEndpoints = {
  /** An org's assignments of a course, after checking the org's scope and use rights. */
  courseAssignments: defineEndpoint({
    method: 'get',
    path: '/api/v1/courses/{courseId}/assignments',
    params: courseParams,
    query: ListAssignmentsQuerySchema,
    response: PageSchema(CourseAssignmentSchema),
  }),
  /** Resolves the targets into recipients now; at most 500 learners. */
  assignCourse: defineEndpoint({
    method: 'post',
    path: '/api/v1/courses/{courseId}/assignments',
    params: courseParams,
    body: AssignCourseCommandSchema,
    response: AssignmentDetailSchema,
  }),
  /** The assignment with its targets and recipients; managers of the assigning org only. */
  getAssignment: defineEndpoint({
    method: 'get',
    path: '/api/v1/learning-assignments/{assignmentId}',
    params: assignmentParams,
    response: AssignmentDetailSchema,
  }),
  /** An org's assignments across courses with recipient counts; managers of the org only. */
  orgAssignments: defineEndpoint({
    method: 'get',
    path: '/api/v1/learning-assignments',
    query: ListOrgAssignmentsQuerySchema,
    response: PageSchema(AssignmentSummarySchema),
  }),
  /** New dates and reminder for an active assignment and its active recipients. */
  rescheduleAssignment: defineEndpoint({
    method: 'put',
    path: '/api/v1/learning-assignments/{assignmentId}/schedule',
    params: assignmentParams,
    body: RescheduleAssignmentCommandSchema,
    response: AssignmentDetailSchema,
  }),
  /** An in-app reminder now for active recipients who have not finished; once a day each. */
  remindAssignment: defineEndpoint({
    method: 'post',
    path: '/api/v1/learning-assignments/{assignmentId}/remind',
    params: assignmentParams,
    response: RemindResultSchema,
  }),
  /** Revokes every active recipient with one reason; enrolments and progress stay. */
  revokeAssignment: defineEndpoint({
    method: 'post',
    path: '/api/v1/learning-assignments/{assignmentId}/revoke',
    params: assignmentParams,
    body: RevokeRecipientCommandSchema,
    response: AssignmentDetailSchema,
  }),
  /** Ends one recipient's obligation; access stays if another source grants it. */
  revokeRecipient: defineEndpoint({
    method: 'post',
    path: '/api/v1/learning-assignments/recipients/{recipientId}/revoke',
    params: z.object({ recipientId: z.number().int() }),
    body: RevokeRecipientCommandSchema,
    response: AssignmentRecipientSchema,
  }),
  listGroups: defineEndpoint({
    method: 'get',
    path: '/api/v1/learning-groups',
    query: ListGroupsQuerySchema,
    response: PageSchema(LearningGroupSchema),
  }),
  createGroup: defineEndpoint({
    method: 'post',
    path: '/api/v1/learning-groups',
    body: CreateGroupCommandSchema,
    response: GroupDetailSchema,
  }),
  /** The group and its current members; past memberships are kept on the server. */
  getGroup: defineEndpoint({
    method: 'get',
    path: '/api/v1/learning-groups/{groupId}',
    params: groupParams,
    response: GroupDetailSchema,
  }),
  /** Replaces the members in one transaction; past assignments keep their recipients. */
  replaceMembers: defineEndpoint({
    method: 'put',
    path: '/api/v1/learning-groups/{groupId}/members',
    params: groupParams,
    body: ReplaceMembersCommandSchema,
    response: GroupDetailSchema,
  }),
} as const;
