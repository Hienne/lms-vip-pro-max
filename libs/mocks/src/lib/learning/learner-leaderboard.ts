import {
  LeaderboardQuerySchema,
  type LeaderboardPage,
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

const numeric = (value: string | undefined): number | undefined =>
  value === undefined || value === '' ? undefined : Number(value);

/**
 * The learning points and the leaderboard. Each learner's points are fixed (`learnerPointsFixtures`);
 * what the mock does is what a list does: pick the scope's members, order them (points, then name),
 * give ties one rank (1, 1, 3) and cut a page. Only a learner may ask.
 */
export class LearnerLeaderboard {
  constructor(private readonly directory: LearningDirectory) {}

  /** `GET /points`: the caller's fixed figures. */
  points(request: FakeRequest): MyPoints {
    return this.caller(request).points;
  }

  /** `GET /leaderboard`: the scope's learners, ranked, one page, and the caller's own row. */
  leaderboard(request: FakeRequest): LeaderboardPage {
    const caller = this.caller(request);
    const parsed = LeaderboardQuerySchema.safeParse({
      scope: request.query['scope'],
      page: numeric(request.query['page']),
      size: numeric(request.query['size']),
    });
    if (!parsed.success) return refuse('validationFailed');
    const { scope = 'org', page = 0, size = 20 } = parsed.data;

    const rows = this.rank(this.members(caller, scope), caller.userId);
    const mine = rows.find((row) => row.me);
    return {
      page: {
        items: rows.slice(page * size, page * size + size),
        page,
        size,
        totalElements: rows.length,
        totalPages: Math.ceil(rows.length / size),
      },
      me: mine ?? { ...this.row(caller, null), me: true },
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

  /** Points first, then the name; equal points share the rank of the first of them. */
  private rank(
    members: readonly Learner[],
    callerId: string,
  ): LeaderboardRow[] {
    const ordered = [...members].sort(
      (a, b) =>
        b.points.total - a.points.total ||
        byName.compare(a.fullName, b.fullName),
    );
    return ordered.map((entry) => ({
      ...this.row(
        entry,
        ordered.findIndex((o) => o.points.total === entry.points.total) + 1,
      ),
      me: entry.userId === callerId,
    }));
  }

  private row<Rank extends number | null>(entry: Learner, rank: Rank) {
    return {
      rank,
      userId: entry.userId,
      fullName: entry.fullName,
      teamName:
        entry.teamId === null
          ? null
          : (this.directory.nameOf('team', entry.teamId) ?? null),
      points: entry.points.total,
      streakDays: entry.points.streakDays,
    };
  }
}
