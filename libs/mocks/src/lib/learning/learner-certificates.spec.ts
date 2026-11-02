import {
  authV1Endpoints,
  certificateEndpoints as e,
  CertificateSchema,
  learnerEndpoints,
  type AnyEndpoint,
  type Certificate,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';

describe('the certificates of the mock backend', () => {
  let backend: FakeBackend;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T09:00:00Z'));
    backend = new FakeBackend();
  });
  afterEach(() => vi.useRealTimers());

  const call = (
    endpoint: AnyEndpoint,
    token: string,
    request: {
      params?: Record<string, string>;
      query?: Record<string, string>;
    } = {},
  ): FakeReply =>
    backend.handle(endpoint, {
      token,
      params: request.params ?? {},
      query: request.query ?? {},
      body: undefined,
    }) as FakeReply;

  const login = (username: string): string =>
    (
      backend.handle(authV1Endpoints.login, {
        token: null,
        params: {},
        query: {},
        body: { username, password: SEED_PASSWORD },
      })?.body.data as { accessToken: string }
    ).accessToken;

  const list = (token: string, query: Record<string, string> = {}) =>
    e.certificates.response.parse(
      call(e.certificates, token, { query }).body.data,
    );

  const card = (token: string, courseId: number) =>
    (
      call(learnerEndpoints.course, token, {
        params: { courseId: String(courseId) },
      }).body.data as {
        card: { enrollmentId: number | null; certificateId?: number | null };
      }
    ).card;

  it("lists the caller's completed cycle, parsed by the contract", () => {
    const page = list(login('hocvien'));
    expect(page.totalElements).toBe(1);
    expect(page.items[0]).toMatchObject({
      courseId: 5,
      userId: '000004',
      cycleNo: 1,
      bestScorePercent: 90,
    });
    expect(CertificateSchema.safeParse(page.items[0]).success).toBe(true);
  });

  it('writes the name of the person and the verification code of the cycle', () => {
    const [certificate] = list(login('hocvien')).items;
    expect(certificate.fullName).toBe('Học viên tiền gửi Demo');
    expect(certificate.verificationCode).toBe(
      `CBA-${certificate.courseCode}-000004-1`.toUpperCase(),
    );
    expect(certificate.completedAt).toBe('2026-10-30T09:00:00.000Z');
  });

  it('lists nothing for a learner who completed nothing, and never the others', () => {
    const page = list(login('hocvien.tichhop'));
    expect(page.items).toEqual([]);
    expect(page.totalElements).toBe(0);
    expect(page.totalPages).toBe(0);
  });

  it('opens one certificate by its enrollment id', () => {
    const token = login('hocvien');
    const [certificate] = list(token).items;
    const reply = call(e.certificate, token, {
      params: { enrollmentId: String(certificate.id) },
    });
    expect(e.certificate.response.parse(reply.body.data)).toEqual(certificate);
  });

  it('answers "not found" for another learner, a cycle in progress and a missing id', () => {
    const token = login('hocvien');
    const mine = list(token).items[0];
    const inProgress = card(token, 1).enrollmentId;
    expect(inProgress).not.toBeNull();
    for (const [who, id] of [
      ['hocvien.tichhop', String(mine.id)],
      ['hocvien', String(inProgress)],
      ['hocvien', '999999'],
      ['hocvien', 'abc'],
    ]) {
      const reply = call(e.certificate, login(who), {
        params: { enrollmentId: id },
      });
      expect(reply.body, `${who} ${id}`).toMatchObject({
        status: 'ERROR',
        messageCode: 'LEARNING-NOT_FOUND',
      });
    }
  });

  it('pages the list and refuses a size over 100', () => {
    const token = login('hocvien');
    expect(list(token, { size: '1' }).totalPages).toBe(1);
    expect(list(token, { page: '3' }).items).toEqual([]);
    expect(
      call(e.certificates, token, { query: { size: '101' } }).body.messageCode,
    ).toBe('CORE-VALIDATION_FAILED');
  });

  it('derives the course card certificate id from the completed cycle only', () => {
    const token = login('hocvien');
    const done = list(token).items[0] as Certificate;
    expect(card(token, done.courseId).certificateId).toBe(done.id);
    expect(card(token, 1).certificateId).toBeNull();
    expect(
      card(login('hocvien.tichhop'), done.courseId).certificateId,
    ).toBeNull();
  });

  it('puts the certificate id on the catalogue card as well, and null without an enrolment', () => {
    const token = login('hocvien');
    const cards = (
      call(learnerEndpoints.catalog, token, { query: { size: '100' } }).body
        .data as {
        items: { courseId: number; certificateId?: number | null }[];
      }
    ).items;
    expect(cards.filter((c) => c.certificateId != null)).toHaveLength(1);
    expect(cards.every((c) => c.certificateId !== undefined)).toBe(true);
  });
});
