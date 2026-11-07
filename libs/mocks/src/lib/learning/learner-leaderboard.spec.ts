import {
  authV1Endpoints,
  LeaderboardViewSchema,
  learnerEndpoints,
  MyPointsSchema,
  type AnyEndpoint,
  type LeaderboardView,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';
import {
  boardLearnerFixtures,
  learnerPointsFixtures,
} from './learning.fixtures';

describe('the points and the leaderboard of the mock backend', () => {
  let backend: FakeBackend;
  beforeEach(() => (backend = new FakeBackend()));

  const call = (
    endpoint: AnyEndpoint,
    token: string | null,
    query: Record<string, string> = {},
    body?: unknown,
  ): FakeReply =>
    backend.handle(endpoint, { token, params: {}, query, body }) as FakeReply;

  const login = (username: string): string =>
    (
      call(
        authV1Endpoints.login,
        null,
        {},
        { username, password: SEED_PASSWORD },
      ).body.data as { accessToken: string }
    ).accessToken;

  const board = (
    username: string,
    query: Record<string, string> = {},
  ): LeaderboardView =>
    LeaderboardViewSchema.parse(
      call(learnerEndpoints.leaderboard, login(username), query).body.data,
    );

  const names = (page: LeaderboardView) =>
    page.top.map((row) => [row.rank, row.fullName, row.points]);

  it("answers the caller's fixed points, whose total is the sum of the parts", () => {
    const points = MyPointsSchema.parse(
      call(learnerEndpoints.myPoints, login('hocvien')).body.data,
    );
    expect(points).toEqual(learnerPointsFixtures['000004']);
    for (const { total, parts } of [
      ...Object.values(learnerPointsFixtures),
      ...boardLearnerFixtures.map((learner) => learner.points),
    ]) {
      expect(total).toBe(
        parts.lessons + parts.quizzes + parts.firstTryBonus + parts.courses,
      );
    }
  });

  it('ranks the org by points, ties share a rank and the next one skips', () => {
    expect(names(board('hocvien'))).toEqual([
      [1, 'Học viên tích hợp Demo', 90],
      [2, 'Học viên tiền gửi Demo', 80],
      [2, 'Học viên tín dụng Demo', 80],
      [4, 'Giảng viên Demo', 40],
      [5, 'Học viên thẻ Demo', 0],
    ]);
  });

  it('marks only the caller and gives the rank of the caller in the scope', () => {
    const page = board('hocvien');
    expect(page.top.filter((row) => row.me)).toEqual([
      expect.objectContaining({ userId: '000004', rank: 2 }),
    ]);
    expect(page.me).toMatchObject({ userId: '000004', rank: 2, me: true });
  });

  it('lists the team of the caller alone, with the team name on each row', () => {
    const page = board('hocvien', { scope: 'team' });
    expect(names(page)).toEqual([[1, 'Học viên tiền gửi Demo', 80]]);
    expect(page.top[0].teamName).toBe('Nhóm BA&QC Tiền gửi');
    expect(page.me.rank).toBe(1);
  });

  it('lists every learner in the system for all, here the one org', () => {
    expect(board('hocvien', { scope: 'all' }).top).toHaveLength(5);
  });

  it('has no paging fields and no count of learners', () => {
    const page = board('hocvien');
    expect(page).not.toHaveProperty('page');
    expect(page).not.toHaveProperty('totalElements');
    expect(page.period).toBe('month');
  });

  it('reads the fixture as this month and all time, a third of it as this week and nothing before', () => {
    expect(names(board('hocvien', { period: 'week' }))[0]).toEqual([
      1,
      'Học viên tích hợp Demo',
      30,
    ]);
    expect(board('hocvien', { period: 'all' }).me.points).toBe(80);
    const last = board('hocvien', { period: 'month', offset: '1' });
    expect(last.top.map((row) => row.points)).toEqual([0, 0, 0, 0, 0]);
    expect(last.top.map((row) => row.rank)).toEqual([1, 1, 1, 1, 1]);
    expect(last.offset).toBe(1);
  });

  it('puts a learner with no XP after everyone, with a rank and no streak', () => {
    const last = board('giangvien').top.at(-1);
    expect(last).toMatchObject({ rank: 5, points: 0, streakDays: 0 });
  });

  it('keeps me in place in the top ten, with nothing above and no gap', () => {
    const page = board('hocvien');
    expect(page.above).toEqual([]);
    expect(page.gapToAbove).toBeNull();
  });

  it.each<Record<string, string>>([
    { scope: 'x' },
    { period: 'year' },
    { offset: '-1' },
    { offset: '521' },
  ])('refuses the query %j as a validation failure', (query) => {
    const reply = call(learnerEndpoints.leaderboard, login('hocvien'), query);
    expect(reply.body.messageCode).toBe('CORE-VALIDATION_FAILED');
  });

  it.each(['quantri', 'baocao'])(
    'refuses %s, who is not a learner, on both reads',
    (username) => {
      const token = login(username);
      for (const endpoint of [
        learnerEndpoints.myPoints,
        learnerEndpoints.leaderboard,
      ]) {
        expect(call(endpoint, token).body.messageCode).toBe(
          'CORE-ACCESS_DENIED',
        );
      }
    },
  );

  it('refuses a caller who is not signed in', () => {
    expect(call(learnerEndpoints.leaderboard, null).status).toBe(401);
  });
});
