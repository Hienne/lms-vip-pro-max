import {
  authV1Endpoints,
  learningReportEndpoints as e,
  type AnyEndpoint,
} from '@lms/contracts';
import { z } from 'zod';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';

describe('the learning reports of the mock backend', () => {
  let backend: FakeBackend;
  beforeEach(() => (backend = new FakeBackend()));

  const call = (
    endpoint: AnyEndpoint,
    token: string | null,
    query: Record<string, string> = {},
  ): FakeReply =>
    backend.handle(endpoint, {
      token,
      params: {},
      query,
      body: undefined,
    }) as FakeReply;

  const login = (username: string): string =>
    (
      backend.handle(authV1Endpoints.login, {
        token: null,
        params: {},
        query: {},
        body: { username, password: SEED_PASSWORD },
      })!.body.data as { accessToken: string }
    ).accessToken;

  const data = <T extends AnyEndpoint>(
    endpoint: T,
    token: string,
    query: Record<string, string> = {},
  ): z.infer<T['response']> =>
    endpoint.response.parse(call(endpoint, token, query).body.data) as z.infer<
      T['response']
    >;

  it('answers every report in the shape of its contract', () => {
    const token = login('quantri.ban');
    const summary = data(e.summary, token);
    expect(summary.timeZone).toBe('Asia/Ho_Chi_Minh');
    expect(summary.counts.enrollments).toBeGreaterThan(0);
    const rows = data(e.enrollments, token, { size: '100' });
    expect(rows.totalElements).toBe(summary.counts.enrollments);
    expect(rows.items[0].fullName).toBeTruthy();
  });

  it('counts the same enrolments in the summary and across the groups', () => {
    const token = login('super.admin');
    const total = data(e.summary, token).counts.enrollments;
    for (const groupBy of ['course', 'org', 'team', 'user']) {
      const groups = data(e.groups, token, { groupBy, size: '100' });
      const sum = groups.items.reduce((n, g) => n + g.enrollments, 0);
      if (groupBy === 'team') expect(sum).toBeLessThanOrEqual(total);
      else expect(sum).toBe(total);
      expect(groups.items.every((g) => typeof g.id === 'string')).toBe(true);
    }
  });

  it('narrows to the filter and sorts on the server', () => {
    const token = login('super.admin');
    const overdue = data(e.enrollments, token, { overdue: 'true' });
    expect(overdue.items.every((row) => row.enrollment.overdue)).toBe(true);
    expect(data(e.summary, token, { overdue: 'true' }).counts.overdue).toBe(
      overdue.totalElements,
    );
    const sorted = data(e.enrollments, token, {
      sort: 'progressPercent,desc',
      size: '100',
    }).items.map((row) => row.enrollment.progressPercent);
    expect(sorted).toEqual([...sorted].sort((a, b) => b - a));
  });

  it('keeps each role to its report scope', () => {
    const all = data(e.summary, login('super.admin')).counts.enrollments;
    const team = data(e.enrollments, login('baocao'), { size: '100' });
    expect(team.totalElements).toBeLessThan(all);
    expect(team.items.every((row) => row.enrollment.teamId === 1)).toBe(true);
    expect(call(e.summary, login('hocvien')).body.messageCode).toBe(
      'CORE-ACCESS_DENIED',
    );
  });

  it('refuses a grouping the server does not know', () => {
    expect(
      call(e.groups, login('super.admin'), { groupBy: 'quiz' }).body,
    ).toMatchObject({ status: 'ERROR', messageCode: 'CORE-VALIDATION_FAILED' });
  });

  it('exports the filtered rows as a CSV with the backend header', async () => {
    const token = login('super.admin');
    const rows = data(e.enrollments, token, { overdue: 'true' });
    const reply = call(e.exportEnrollments, token, { overdue: 'true' });
    expect(reply.file?.type).toBe('text/csv');
    const lines = (await reply.file!.text()).trimEnd().split('\r\n');
    expect(lines[0]).toBe(
      'Mã cán bộ,Họ tên,Đơn vị,Nhóm,Mã khóa,Khóa học,Chương trình,Trạng thái,Tiến độ %,Được giao,Bắt buộc,Ghi danh,Bắt đầu,Truy cập gần nhất,Hoàn thành,Hạn hoàn thành,Quá hạn',
    );
    expect(lines).toHaveLength(rows.totalElements + 1);
  });

  it('refuses an export over the row limit', () => {
    backend.limitProgressExport(1);
    expect(
      call(e.exportEnrollments, login('super.admin')).body.messageCode,
    ).toBe('LEARNING-EXPORT_TOO_LARGE');
  });
});
