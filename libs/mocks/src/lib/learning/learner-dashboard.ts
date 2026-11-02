import type {
  CourseCard,
  DashboardCounts,
  DashboardEnrollment,
  DashboardGroup,
  LearningDashboard,
  LearningStatus,
} from '@lms/contracts';

/** At most this many deadlines, like the backend's dashboard. */
const DEADLINE_LIMIT = 5;

const round2 = (value: number): number => Math.round(value * 100) / 100;

const statusOf = (card: CourseCard): LearningStatus =>
  (card.learningStatus as LearningStatus | null | undefined) ?? 'not_started';

/** The backend's rules (`docs/api/LEARNING.md` §16): 0 when empty, two decimals. */
function counts(cards: readonly CourseCard[]): DashboardCounts {
  const completed = cards.filter((c) => statusOf(c) === 'completed').length;
  const progress = cards.reduce((sum, c) => sum + (c.progressPercent ?? 0), 0);
  return {
    enrollments: cards.length,
    learners: cards.length ? 1 : 0,
    courses: cards.length,
    assigned: cards.filter((c) => c.assigned).length,
    mandatory: cards.filter((c) => c.requirement === 'mandatory').length,
    completed,
    inProgress: cards.filter((c) => statusOf(c) === 'in_progress').length,
    notStarted: cards.filter((c) => statusOf(c) === 'not_started').length,
    overdue: cards.filter((c) => c.overdue).length,
    averageProgress: cards.length ? round2(progress / cards.length) : 0,
    completionRate: cards.length ? round2((completed / cards.length) * 100) : 0,
  };
}

function deadline(card: CourseCard, userId: string): DashboardEnrollment {
  return {
    id: card.enrollmentId ?? 0,
    userId,
    courseId: card.courseId,
    courseCode: card.code,
    courseTitle: card.title ?? card.code,
    revisionId: card.revisionId ?? 0,
    programId: card.programId ?? null,
    programName: card.programName ?? null,
    orgId: null,
    teamId: null,
    status: statusOf(card),
    progressPercent: card.progressPercent ?? 0,
    assigned: !!card.assigned,
    mandatory: card.requirement === 'mandatory',
    enrolledAt: null,
    startedAt: card.startedAt ?? null,
    lastAccessAt: card.lastAccessAt ?? null,
    completedAt: card.completedAt ?? null,
    dueAt: card.dueAt ?? null,
    overdue: !!card.overdue,
    canStudy: true,
  };
}

/**
 * `GET /me/learning/dashboard` over the caller's own cards: the counts by the backend's rules, the
 * course last opened as the next action, and the five nearest deadlines of unfinished courses.
 */
export function dashboardOf(
  cards: readonly CourseCard[],
  userId: string,
  now: string,
): LearningDashboard {
  const resume = cards
    .filter((c) => statusOf(c) === 'in_progress')
    .sort((a, b) =>
      (b.lastAccessAt ?? '').localeCompare(a.lastAccessAt ?? ''),
    )[0];
  return {
    dataAsOf: now,
    timeZone: 'Asia/Ho_Chi_Minh',
    learning: {
      counts: counts(cards),
      nextAction: resume?.enrollmentId
        ? {
            enrollmentId: resume.enrollmentId,
            courseId: resume.courseId,
            courseTitle: resume.title ?? resume.code,
            lessonId: resume.lastLessonId ?? null,
            blockId: resume.lastBlockId ?? null,
            blockType: null,
            quizId: null,
            assetId: resume.mediaAssetId ?? null,
            lastPdfPage: resume.lastPdfPage ?? null,
            lastVideoPositionSeconds: resume.lastVideoPositionSeconds ?? null,
          }
        : null,
      deadlines: cards
        .filter((c) => c.dueAt && statusOf(c) !== 'completed')
        .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
        .slice(0, DEADLINE_LIMIT)
        .map((c) => deadline(c, userId)),
    },
    assessment: null,
  };
}

/**
 * `GET /me/learning/dashboard/programs`: one group per programme the caller has a course in, in the
 * order of the programme id.
 */
export function programGroupsOf(
  cards: readonly CourseCard[],
): DashboardGroup[] {
  const byProgram = new Map<number, CourseCard[]>();
  for (const card of cards) {
    if (card.programId == null) continue;
    byProgram.set(card.programId, [
      ...(byProgram.get(card.programId) ?? []),
      card,
    ]);
  }
  return [...byProgram.entries()]
    .sort(([a], [b]) => a - b)
    .map(([id, group]) => {
      const { assigned: _a, mandatory: _m, ...rest } = counts(group);
      return {
        id: String(id),
        name: group[0].programName ?? `Chương trình ${id}`,
        ...rest,
      };
    });
}
