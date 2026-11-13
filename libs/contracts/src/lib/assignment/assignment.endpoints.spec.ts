import { toUrl } from '../http/endpoint';
import { assignmentEndpoints } from './assignment.endpoints';
import {
  AssignCourseCommandSchema,
  AssignmentDetailSchema,
  ListAssignmentsQuerySchema,
  ReplaceMembersCommandSchema,
} from './assignment.schema';

const stamp = { rowVersion: 0, createTime: '2026-10-20T08:00:00' };

describe('assignment endpoints', () => {
  it('declare the backend paths and methods', () => {
    expect(
      Object.entries(assignmentEndpoints).map(([key, e]) => [
        key,
        e.method,
        e.path,
      ]),
    ).toEqual([
      [
        'revisionChangePreview',
        'get',
        '/api/v1/learning-assignments/recipients/{recipientId}/revision-change',
      ],
      [
        'changeRevision',
        'post',
        '/api/v1/learning-assignments/recipients/{recipientId}/revision-change',
      ],
      ['courseAssignments', 'get', '/api/v1/courses/{courseId}/assignments'],
      ['assignCourse', 'post', '/api/v1/courses/{courseId}/assignments'],
      ['getAssignment', 'get', '/api/v1/learning-assignments/{assignmentId}'],
      ['orgAssignments', 'get', '/api/v1/learning-assignments'],
      [
        'rescheduleAssignment',
        'put',
        '/api/v1/learning-assignments/{assignmentId}/schedule',
      ],
      [
        'remindAssignment',
        'post',
        '/api/v1/learning-assignments/{assignmentId}/remind',
      ],
      [
        'revokeAssignment',
        'post',
        '/api/v1/learning-assignments/{assignmentId}/revoke',
      ],
      [
        'revokeRecipient',
        'post',
        '/api/v1/learning-assignments/recipients/{recipientId}/revoke',
      ],
      ['listGroups', 'get', '/api/v1/learning-groups'],
      ['createGroup', 'post', '/api/v1/learning-groups'],
      ['getGroup', 'get', '/api/v1/learning-groups/{groupId}'],
      ['replaceMembers', 'put', '/api/v1/learning-groups/{groupId}/members'],
    ]);
    expect(toUrl(assignmentEndpoints.revokeRecipient, { recipientId: 5 })).toBe(
      '/api/v1/learning-assignments/recipients/5/revoke',
    );
  });

  it('requires the assigning org to list', () => {
    expect(ListAssignmentsQuerySchema.safeParse({}).success).toBe(false);
  });

  it('checks an assignment body against the backend rules', () => {
    const body = {
      revisionId: 71,
      assigningOrgId: 1,
      startAt: '2026-10-24T00:00:00+07:00',
      dueAt: '2026-11-30T17:00:00+07:00',
      requirement: 'mandatory',
      enrollmentMode: 'continue',
      reminderEnabled: true,
      reminderDaysBefore: 3,
      idempotencyKey: '7f1c2a9e-0d55-4c1b-9a3f-1b2c3d4e5f60',
      targets: [
        { targetType: 'org', orgId: 2, includeDescendants: true },
        { targetType: 'user', userId: '00123' },
        { targetType: 'learning_group', groupId: 8 },
      ],
    };
    expect(AssignCourseCommandSchema.parse(body)).toEqual(body);
    expect(
      AssignCourseCommandSchema.safeParse({
        ...body,
        targets: [{ targetType: 'role' }],
      }).success,
    ).toBe(false);
    expect(
      AssignCourseCommandSchema.safeParse({ ...body, reminderDaysBefore: 366 })
        .success,
    ).toBe(false);
  });

  it('parses an assignment with its targets and recipients', () => {
    const detail = AssignmentDetailSchema.parse({
      assignment: {
        id: 3,
        courseId: 7,
        revisionId: 71,
        assigningOrgId: 1,
        assignedBy: '00001',
        title: 'Đợt 1',
        startAt: '2026-10-24T00:00:00',
        dueAt: null,
        requirement: 'mandatory',
        enrollmentMode: 'continue',
        status: 'active',
        ...stamp,
      },
      targets: [
        {
          id: 4,
          assignmentId: 3,
          targetType: 'team',
          teamId: 6,
          targetNameSnapshot: 'Nhóm Tiền gửi',
          ...stamp,
        },
      ],
      recipients: [
        {
          id: 5,
          assignmentId: 3,
          userId: '00123',
          effectiveDueAt: null,
          status: 'active',
          ...stamp,
        },
      ],
      sources: [{ id: 9, recipientId: 5, targetId: 4, ...stamp }],
    });
    expect(detail.recipients[0].userId).toBe('00123');
  });

  it('keeps the leading zeros of staff codes in a member list', () => {
    expect(
      ReplaceMembersCommandSchema.parse({
        expectedVersion: 1,
        userIds: ['00123'],
      }).userIds,
    ).toEqual(['00123']);
  });
});
