import {
  authV1Endpoints,
  courseEndpoints,
  CourseShareSchema,
  ShareCourseCommandSchema,
  type AnyEndpoint,
  type CourseShare,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';

describe('course shares in the mock backend', () => {
  let backend: FakeBackend;
  let token: string;
  beforeEach(() => {
    backend = new FakeBackend();
    token = (
      backend.handle(authV1Endpoints.login, {
        token: null,
        params: {},
        query: {},
        body: { username: 'quantri', password: SEED_PASSWORD },
      })?.body.data as { accessToken: string }
    ).accessToken;
  });

  const call = (endpoint: AnyEndpoint, courseId: number, body?: unknown) =>
    backend.handle(endpoint, {
      token,
      params: { courseId: String(courseId) },
      query: {},
      body,
    }) as FakeReply;
  const share = (courseId: number, body: unknown) =>
    call(courseEndpoints.share, courseId, body);
  const shares = (courseId: number): CourseShare[] =>
    (call(courseEndpoints.shares, courseId).body.data as unknown[]).map((row) =>
      CourseShareSchema.parse(row),
    );
  const command = (over: Record<string, unknown> = {}) => ({
    orgId: 2,
    includeDescendants: false,
    canAssign: true,
    canSelfEnroll: false,
    active: true,
    ...over,
  });
  const messageCode = (reply: FakeReply) => reply.body.messageCode;

  it('needs every field of the command, as the backend takes none by default', () => {
    expect(ShareCourseCommandSchema.safeParse(command()).success).toBe(true);
    for (const missing of [
      'includeDescendants',
      'canAssign',
      'canSelfEnroll',
      'active',
    ]) {
      const rest: Record<string, unknown> = command();
      delete rest[missing];
      expect(ShareCourseCommandSchema.safeParse(rest).success).toBe(false);
    }
  });

  it('refuses a command that leaves a field out', () => {
    const { active: _active, ...rest } = command();
    expect(messageCode(share(1, rest))).toBe('CORE-VALIDATION_FAILED');
    expect(shares(1)).toEqual([]);
  });

  it('keeps the rights as sent', () => {
    const reply = share(
      1,
      command({
        includeDescendants: true,
        canAssign: false,
        canSelfEnroll: true,
      }),
    );

    expect(reply.body.status).toBe('SUCCESS');
    expect(CourseShareSchema.parse(reply.body.data)).toMatchObject({
      courseId: 1,
      orgId: 2,
      includeDescendants: true,
      canAssign: false,
      canSelfEnroll: true,
      status: 'active',
      revokedAt: null,
    });
  });

  it('changes the one row of an org instead of adding another, and counts its version', () => {
    share(1, command());
    share(1, command({ canSelfEnroll: true }));

    expect(shares(1)).toHaveLength(1);
    expect(shares(1)[0]).toMatchObject({ canSelfEnroll: true, rowVersion: 1 });
    share(1, command({ orgId: 3 }));
    expect(
      shares(1)
        .map((row) => row.orgId)
        .sort(),
    ).toEqual([2, 3]);
    expect(shares(2)).toEqual([]);
  });

  it('revokes by sending active false: the row stays, with its revoke time', () => {
    share(1, command());
    share(1, command({ active: false }));

    expect(shares(1)).toHaveLength(1);
    const [revoked] = shares(1);
    expect(revoked.status).toBe('revoked');
    expect(revoked.revokedAt).toEqual(expect.any(String));

    share(1, command());
    expect(shares(1)[0]).toMatchObject({ status: 'active', revokedAt: null });
  });

  it('refuses the unit that owns the course', () => {
    const owner = (
      call(courseEndpoints.getCourse, 1).body.data as {
        course: { ownerOrgId: number };
      }
    ).course.ownerOrgId;

    const reply = share(1, command({ orgId: owner }));

    expect(messageCode(reply)).toBe('LEARNING-INVALID_REFERENCE');
    expect(shares(1)).toEqual([]);
  });
});
