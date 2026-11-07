import type { MyLevel } from '@lms/contracts';
import type { FakeRequest } from '../backend/fake-backend';
import { learnerPointsFixtures } from './learning.fixtures';
import type { LearningDirectory } from './learning.backend';
import { refuse } from './learning-reply';

/**
 * What the server shows each learner as their level, fixed like the points (the server computes the level
 * from the ladder; the mock never does). The three seed learners are below 200 XP, so all are on level 1.
 */
export const learnerLevelFixtures: Readonly<Record<string, MyLevel>> = {
  '000004': {
    level: 1,
    name: 'Giao dịch viên tập sự',
    xp: 80,
    xpToNext: 120,
    progressPercent: 40,
  },
  '000005': {
    level: 1,
    name: 'Giao dịch viên tập sự',
    xp: 40,
    xpToNext: 160,
    progressPercent: 20,
  },
  '000007': {
    level: 1,
    name: 'Giao dịch viên tập sự',
    xp: 90,
    xpToNext: 110,
    progressPercent: 45,
  },
};

/** `GET /level`: a learner's fixed level; anyone else is refused. */
export class LearnerLevel {
  constructor(private readonly directory: LearningDirectory) {}

  level(request: FakeRequest): MyLevel {
    const userId = this.directory.callerId(request);
    if (!(userId in learnerPointsFixtures)) return refuse('accessDenied');
    return learnerLevelFixtures[userId];
  }
}
