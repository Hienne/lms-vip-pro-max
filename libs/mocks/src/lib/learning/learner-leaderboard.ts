import {
  LeaderboardQuerySchema,
  UnitLeaderboardQuerySchema,
  type LeaderboardView,
  type UnitLeaderboard,
  type LeaderboardPeriod,
  type LeaderboardRow,
  type LeaderboardScope,
  type MyPoints,
} from '@lms/contracts';
import type { FakeRequest } from '../backend/fake-backend';
import {
  boardLearnerFixtures,
  learnerPointsFixtures,
} from './learning.fixtures';
import type { LearningDirectory } from './learning.backend';
import { refuse } from './learning-reply';

interface Learner {
  readonly userId: string;
  readonly fullName: string;
  readonly orgId: number | null;
  readonly teamId: number | null;
  readonly points: MyPoints;
}

const byName = new Intl.Collator('vi');

/** Rows of the top of the board. */
const TOP = 10;

/** A unit with fewer learners is not ranked. */
const MIN_UNIT_LEARNERS = 5;

const numeric = (value: string | undefined): number | undefined =>
  value === undefined || value === '' ? undefined : Number(value);

/**
 * The learning points and the leaderboard. Each learner's points are fixed (`learnerPointsFixtures`);
 * what the mock does is what a list does: pick the scope's members, order them (points, then name),
 * give ties one rank (1, 1, 3) and cut the top ten. The fixtures hold one total per learner, so the mock reads it
 * as the XP of the current month and of all time, a third of it as the current week, and nothing for earlier periods.
 * Only a learner may ask.
 */
export class LearnerLeaderboard {
  constructor(private readonly directory: LearningDirectory) {}

  /** `GET /points`: the caller's fixed figures. */
  points(request: FakeRequest): MyPoints {
    return this.caller(request).points;
  }

  /** `GET /leaderboard`: the scope's learners ranked by the period's XP, the top ten and the caller's own row. */
  leaderboard(request: FakeRequest): LeaderboardView {
    const caller = this.caller(request);
    const parsed = LeaderboardQuerySchema.safeParse({
      scope: request.query['scope'],
      period: request.query['period'],
      offset: numeric(request.query['offset']),
    });
    if (!parsed.success) return refuse('validationFailed');
    const { scope = 'org', period = 'month', offset = 0 } = parsed.data;
    const back = period === 'all' ? 0 : offset;

    const rows = this.rank(
      this.members(caller, scope),
      caller.userId,
      period,
      back,
    );
    const top = rows.slice(0, TOP);
    const at = rows.findIndex((row) => row.me);
    const outside = at >= TOP;
    const above = outside ? rows.slice(Math.max(TOP, at - 2), at) : [];
    const mine = rows[at] ?? {
      ...this.row(caller, null, this.xp(caller, period, back)),
      me: true,
    };
    const higher = outside
      ? rows
          .slice(0, at)
          .reverse()
          .find((row) => row.points > mine.points)
      : undefined;
    return {
      period,
      offset: back,
      from: null,
      to: null,
      top,
      me: mine,
      above,
      gapToAbove: higher ? higher.points - mine.points : null,
    };
  }

  /**
   * `GET /leaderboard/units`: the units with at least five learners ranked by the average XP per active learner (a
   * learner with XP in the period), with the share of active learners as the participation rate, the top ten and
   * the caller's unit.
   */
  units(request: FakeRequest): UnitLeaderboard {
    const caller = this.caller(request);
    const parsed = UnitLeaderboardQuerySchema.safeParse({
      period: request.query['period'],
      offset: numeric(request.query['offset']),
    });
    if (!parsed.success) return refuse('validationFailed');
    const { period = 'month', offset = 0 } = parsed.data;
    const back = period === 'all' ? 0 : offset;

    const byUnit = new Map<number, Learner[]>();
    for (const learner of this.learners()) {
      if (learner.orgId === null) continue;
      byUnit.set(learner.orgId, [
        ...(byUnit.get(learner.orgId) ?? []),
        learner,
      ]);
    }
    const ranked = [...byUnit]
      .filter(([, members]) => members.length >= MIN_UNIT_LEARNERS)
      .map(([orgId, members]) => {
        const xp = members
          .map((member) => this.xp(member, period, back))
          .filter((value) => value !== 0);
        return {
          orgId,
          unitName: this.directory.nameOf('org', orgId) ?? String(orgId),
          averageXp: xp.length
            ? Math.round((xp.reduce((a, b) => a + b, 0) * 10) / xp.length) / 10
            : 0,
          participationPercent: Math.round((xp.length * 100) / members.length),
        };
      })
      .sort(
        (a, b) =>
          b.averageXp - a.averageXp || byName.compare(a.unitName, b.unitName),
      )
      .map((unit, index, all) => ({
        ...unit,
        rank: all.findIndex((o) => o.averageXp === unit.averageXp) + 1,
        mine: unit.orgId === caller.orgId,
        index,
      }))
      .map(({ index: _index, ...unit }) => unit);
    const myUnit = ranked.find((unit) => unit.mine) ?? null;
    return {
      period,
      offset: back,
      from: null,
      to: null,
      top: ranked.slice(0, TOP),
      myUnit,
      myUnitTooSmall:
        caller.orgId !== null &&
        myUnit === null &&
        (byUnit.get(caller.orgId)?.length ?? 0) < MIN_UNIT_LEARNERS,
    };
  }

  private caller(request: FakeRequest): Learner {
    const userId = this.directory.callerId(request);
    const learner = this.learners().find((entry) => entry.userId === userId);
    return learner ?? refuse('accessDenied');
  }

  /** The seed learners the points are fixed for, then the learners only the mock lists. */
  private learners(): Learner[] {
    const seeded = this.directory
      .people()
      .filter((person) => person.userId in learnerPointsFixtures)
      .map((person) => ({
        ...person,
        fullName: this.directory.nameOf('user', person.userId) ?? person.userId,
        points: learnerPointsFixtures[person.userId],
      }));
    return [...seeded, ...boardLearnerFixtures];
  }

  private members(caller: Learner, scope: LeaderboardScope): Learner[] {
    const everyone = this.learners();
    if (scope === 'all') return everyone;
    if (scope === 'org')
      return everyone.filter((entry) => entry.orgId === caller.orgId);
    return caller.teamId === null
      ? []
      : everyone.filter((entry) => entry.teamId === caller.teamId);
  }

  /** The learner's XP in the period: the fixture total now, a third of it this week, nothing before. */
  private xp(
    learner: Learner,
    period: LeaderboardPeriod,
    back: number,
  ): number {
    if (period === 'all') return learner.points.total;
    if (back > 0) return 0;
    return period === 'week'
      ? Math.floor(learner.points.total / 3)
      : learner.points.total;
  }

  /** XP first, then the name; equal XP share the rank of the first of them. */
  private rank(
    members: readonly Learner[],
    callerId: string,
    period: LeaderboardPeriod,
    back: number,
  ): LeaderboardRow[] {
    const scored = members.map((entry) => ({
      entry,
      xp: this.xp(entry, period, back),
    }));
    scored.sort(
      (a, b) =>
        b.xp - a.xp || byName.compare(a.entry.fullName, b.entry.fullName),
    );
    return scored.map(({ entry, xp }) => ({
      ...this.row(entry, scored.findIndex((o) => o.xp === xp) + 1, xp),
      me: entry.userId === callerId,
    }));
  }

  private row<Rank extends number | null>(
    entry: Learner,
    rank: Rank,
    points: number,
  ) {
    return {
      rank,
      userId: entry.userId,
      fullName: entry.fullName,
      teamName:
        entry.teamId === null
          ? null
          : (this.directory.nameOf('team', entry.teamId) ?? null),
      points,
      streakDays: entry.points.streakDays,
    };
  }
}
