import {
  authV1Endpoints,
  LeaderboardViewSchema,
  learnerEndpoints,
  MyPointsSchema,
  UnitLeaderboardSchema,
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

  describe('hiding the name', () => {
    const board = (username: string) =>
      LeaderboardViewSchema.parse(
        call(learnerEndpoints.leaderboard, login(username), {
          scope: 'all',
        }).body.data,
      );
    const hide = (username: string, show: boolean) =>
      call(
        learnerEndpoints.updateMyPreferences,
        login(username),
        {},
        { showOnLeaderboard: show },
      );
    const ids = (view: LeaderboardView) => view.top.map((row) => row.userId);

    it('is visible by default and the choice is kept', () => {
      const read = () =>
        call(learnerEndpoints.myPreferences, login('hocvien')).body.data;
      expect(read()).toEqual({ showOnLeaderboard: true });
      hide('hocvien', false);
      expect(read()).toEqual({ showOnLeaderboard: false });
      hide('hocvien', true);
      expect(read()).toEqual({ showOnLeaderboard: true });
    });

    it("leaves the learner out of others' boards and closes the ranks, but not out of their own", () => {
      const before = board('hocvien.tichhop');
      const ownBefore = board('hocvien').me.rank;
      hide('hocvien', false);
      const others = board('hocvien.tichhop');
      expect(ids(others)).not.toContain('000004');
      expect(others.top).toHaveLength(before.top.length - 1);
      const last = (view: LeaderboardView) =>
        Math.max(...view.top.map((row) => row.rank));
      expect(last(others)).toBe(last(before) - 1);
      const own = board('hocvien');
      expect(ids(own)).toContain('000004');
      expect(own.me.rank).toBe(ownBefore);
    });

    it('refuses a body without the value and someone who is not a learner', () => {
      expect(
        call(learnerEndpoints.updateMyPreferences, login('hocvien'), {}, {})
          .body.messageCode,
      ).toBe('CORE-VALIDATION_FAILED');
      expect(
        call(learnerEndpoints.myPreferences, login('quantri')).body.messageCode,
      ).toBe('CORE-ACCESS_DENIED');
    });
  });

  describe('the unit board', () => {
    const units = (username: string, query: Record<string, string> = {}) =>
      UnitLeaderboardSchema.parse(
        call(learnerEndpoints.unitLeaderboard, login(username), query).body
          .data,
      );

    it('ranks the one unit of five learners by the average XP of its active learners', () => {
      const board = units('hocvien');
      expect(board.top).toHaveLength(1);
      expect(board.top[0]).toMatchObject({
        rank: 1,
        averageXp: 72.5,
        participationPercent: 80,
        mine: true,
      });
      expect(board.myUnit).toEqual(board.top[0]);
      expect(board.myUnitTooSmall).toBe(false);
    });

    it('takes the period like the personal board, with nothing before this month', () => {
      expect(units('hocvien', { period: 'week' }).top[0].averageXp).toBe(23.8);
      const earlier = units('hocvien', { offset: '1' });
      expect(earlier.top[0]).toMatchObject({
        averageXp: 0,
        participationPercent: 0,
      });
      expect(earlier.offset).toBe(1);
    });

    it.each<Record<string, string>>([
      { period: 'year' },
      { offset: '-1' },
      { offset: '521' },
    ])('refuses the query %j as a validation failure', (query) => {
      const reply = call(
        learnerEndpoints.unitLeaderboard,
        login('hocvien'),
        query,
      );
      expect(reply.body.messageCode).toBe('CORE-VALIDATION_FAILED');
    });

    it('refuses someone who is not a learner', () => {
      const reply = call(learnerEndpoints.unitLeaderboard, login('quantri'));
      expect(reply.body.messageCode).toBe('CORE-ACCESS_DENIED');
    });
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
