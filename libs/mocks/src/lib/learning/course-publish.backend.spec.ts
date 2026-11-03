import {
  assignmentEndpoints,
  authV1Endpoints,
  courseEndpoints,
  CourseDetailSchema,
  EnvelopeSchema,
  organizationEndpoints,
  type AnyEndpoint,
  type CreateCourseCommand,
  type PublishAssignment,
  type PublishCourseCommand,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';

describe('publishing a course with assignments and shares on the mock backend', () => {
  let backend: FakeBackend;
  let token: string;
  beforeEach(() => {
    backend = new FakeBackend();
    token = (
      call(authV1Endpoints.login, {
        body: { username: 'quantri', password: SEED_PASSWORD },
      }).body.data as { accessToken: string }
    ).accessToken;
  });

  const call = (
    endpoint: AnyEndpoint,
    request: {
      params?: Record<string, string>;
      query?: Record<string, string>;
      body?: unknown;
    } = {},
  ): FakeReply =>
    backend.handle(endpoint, {
      token: endpoint === authV1Endpoints.login ? null : token,
      params: request.params ?? {},
      query: request.query ?? {},
      body: request.body,
    }) as FakeReply;

  const draft: NonNullable<CreateCourseCommand['draft']> = {
    title: 'Khóa giao khi xuất bản',
    level: 'basic',
    defaultRequirement: 'mandatory',
    objectives: [],
    chapters: [
      {
        title: 'Chương 1',
        lessons: [
          {
            title: 'Bài 1',
            lessonType: 'content',
            estimatedDurationSeconds: 600,
            isRequired: true,
            blocks: [],
          },
        ],
      },
    ],
  };

  let sequence = 0;
  const created = () =>
    CourseDetailSchema.parse(
      call(courseEndpoints.createCourse, {
        body: { ownerOrgId: 1, code: `PUB-MOCK-${sequence++}`, draft },
      }).body.data,
    );

  const publish = (
    detail: ReturnType<typeof created>,
    extra: Partial<PublishCourseCommand> = {},
  ) =>
    call(courseEndpoints.publish, {
      params: {
        courseId: String(detail.course.id),
        revisionId: String(detail.revision.id),
      },
      body: { expectedVersion: detail.revision.rowVersion, ...extra },
    });

  const assignmentsOf = (courseId: number) =>
    (
      call(assignmentEndpoints.courseAssignments, {
        params: { courseId: String(courseId) },
        query: { assigningOrgId: '1' },
      }).body.data as {
        items: { requirement: string; idempotencyKey: string }[];
      }
    ).items;

  const sharesOf = (courseId: number) =>
    call(courseEndpoints.shares, { params: { courseId: String(courseId) } })
      .body.data as { orgId: number; status: string }[];

  const row = (
    target: PublishAssignment['target'],
    extra: Partial<PublishAssignment> = {},
  ): PublishAssignment => ({
    startAt: '2026-11-04T00:00:00+07:00',
    dueAt: '2026-12-04T00:00:00+07:00',
    reminderEnabled: true,
    reminderDaysBefore: 3,
    target,
    ...extra,
  });

  const fieldOf = (reply: FakeReply) => {
    const envelope = EnvelopeSchema.parse(reply.body);
    return {
      code: envelope.messageCode,
      errors: envelope.errors?.map((e) => [e.field, e.code]),
    };
  };

  it('publishes with the version alone, as before', () => {
    const detail = created();
    const reply = publish(detail);
    expect(reply.body.status).toBe('SUCCESS');
    expect(assignmentsOf(detail.course.id)).toEqual([]);
  });

  it('applies a row as an assignment of the new revision with the course requirement', () => {
    const detail = created();
    const reply = publish(detail, {
      assignments: [row({ targetType: 'user', userId: '000004' })],
    });
    expect(reply.body.status).toBe('SUCCESS');
    const [assignment] = assignmentsOf(detail.course.id);
    expect(assignment.requirement).toBe('mandatory');
    expect(assignment.idempotencyKey).toBe(`publish-${detail.revision.id}-0`);
  });

  it('applies a new share and leaves an active one as it is', () => {
    const org = (
      call(organizationEndpoints.createOrg, {
        body: { orgType: 'UNIT', code: 'PUB-ORG', name: 'Đơn vị B', sortNo: 1 },
      }).body.data as { id: number }
    ).id;
    const detail = created();
    publish(detail, { shareOrgIds: [org] });
    const [share] = sharesOf(detail.course.id);
    expect([share.orgId, share.status]).toEqual([org, 'active']);
    expect(sharesOf(detail.course.id)).toHaveLength(1);
  });

  it('refuses the empty row, names it, and leaves the draft with nothing assigned', () => {
    const detail = created();
    const reply = publish(detail, {
      assignments: [
        row({ targetType: 'user', userId: '000004' }),
        row({ targetType: 'team', teamId: 999 }),
      ],
    });
    expect(fieldOf(reply)).toEqual({
      code: 'CORE-VALIDATION_FAILED',
      errors: [['assignments[1]', 'LEARNING-EMPTY_TARGET']],
    });
    expect(assignmentsOf(detail.course.id)).toEqual([]);
    const read = CourseDetailSchema.parse(
      call(courseEndpoints.getCourse, {
        params: { courseId: String(detail.course.id) },
      }).body.data,
    );
    expect(read.revision.state).toBe('draft');
    expect(publish(detail).body.status).toBe('SUCCESS');
  });

  it('refuses a due date that is not after the start on that row', () => {
    const reply = publish(created(), {
      assignments: [
        row(
          { targetType: 'user', userId: '000004' },
          { dueAt: '2026-11-04T00:00:00+07:00' },
        ),
      ],
    });
    expect(fieldOf(reply).errors).toEqual([['assignments[0]', 'OUT_OF_RANGE']]);
  });

  it('refuses a share with the owner unit or an unknown unit on that share, and rolls back', () => {
    const detail = created();
    const owner = publish(detail, {
      assignments: [row({ targetType: 'user', userId: '000004' })],
      shareOrgIds: [1],
    });
    expect(fieldOf(owner)).toEqual({
      code: 'CORE-VALIDATION_FAILED',
      errors: [['shareOrgIds[0]', 'LEARNING-INVALID_REFERENCE']],
    });
    expect(assignmentsOf(detail.course.id)).toEqual([]);
    expect(sharesOf(detail.course.id)).toEqual([]);
    expect(fieldOf(publish(detail, { shareOrgIds: [9999] })).errors).toEqual([
      ['shareOrgIds[0]', 'LEARNING-INVALID_REFERENCE'],
    ]);
  });
});
