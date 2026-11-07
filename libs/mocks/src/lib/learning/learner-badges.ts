import type { MyBadges } from '@lms/contracts';
import type { FakeRequest } from '../backend/fake-backend';
import { learnerPointsFixtures } from './learning.fixtures';
import type { LearningDirectory } from './learning.backend';
import { refuse } from './learning-reply';

const earnedAt = '2026-11-03T04:12:00Z';

/** The starter badges the server seeds, as one learner sees them: which are earned and the programme progress. */
const catalog: MyBadges['notEarned'] = [
  {
    badgeId: 1,
    name: 'Khóa học đầu tiên',
    description: 'Hoàn thành khóa học đầu tiên của bạn.',
    icon: 'graduation-cap',
    condition: 'Hoàn thành khóa học đầu tiên',
    earnedAt: null,
    retired: false,
    progress: null,
  },
  {
    badgeId: 2,
    name: 'Thành thạo Tiền gửi',
    description: 'Hoàn thành mọi khóa học của chương trình Tiền gửi.',
    icon: 'route',
    condition: 'Hoàn thành mọi khóa học của chương trình Tiền gửi',
    earnedAt: null,
    retired: false,
    progress: { done: 1, total: 4 },
  },
  {
    badgeId: 3,
    name: 'Đều đặn 5 ngày',
    description: 'Duy trì chuỗi 5 ngày làm việc liên tiếp.',
    icon: 'flame',
    condition: 'Duy trì chuỗi 5 ngày làm việc liên tiếp',
    earnedAt: null,
    retired: false,
    progress: null,
  },
];

/** What the server shows a learner as their badges, fixed like the points: the first badge is earned, the rest not. */
export const learnerBadgeFixtures: MyBadges = {
  earned: [{ ...catalog[0], earnedAt }],
  notEarned: catalog.slice(1),
};

/** `GET /badges`: a learner's fixed badges; anyone else is refused. */
export class LearnerBadges {
  constructor(private readonly directory: LearningDirectory) {}

  badges(request: FakeRequest): MyBadges {
    const userId = this.directory.callerId(request);
    if (!(userId in learnerPointsFixtures)) return refuse('accessDenied');
    return learnerBadgeFixtures;
  }
}
