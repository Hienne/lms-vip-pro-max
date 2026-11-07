/**
 * Responses as the backend sends them (the `data` of the envelope), copied from the integration tests of
 * `LearningGamificationConfigController`. The endpoint spec parses them with the schemas.
 */
const ladder = [
  { level: 1, name: 'Giao dịch viên tập sự', minXp: 0 },
  { level: 2, name: 'Giao dịch viên', minXp: 200 },
  { level: 3, name: 'Chuyên viên', minXp: 600 },
  { level: 4, name: 'Chuyên viên chính', minXp: 1500 },
  { level: 5, name: 'Chuyên gia nghiệp vụ', minXp: 3500 },
  { level: 6, name: 'Chuyên gia Core Banking', minXp: 7000 },
];

export const capturedGamification = {
  /** `GET /gamification/config`: the version in force, saved by an admin. */
  config: {
    versionNo: 2,
    lessonXp: 8,
    quizPassXp: 40,
    firstTryBonusXp: 25,
    firstTryThresholdPercent: 80,
    communityXp: 12,
    communityDailyCap: 36,
    levels: ladder,
    createdBy: '000002',
    createdAt: '2026-11-07T10:35:48.941095Z',
    current: true,
  },
  /** `GET /gamification/config/versions`: newest first; version 1 was seeded, so it has no author. */
  versions: [
    {
      versionNo: 2,
      lessonXp: 8,
      quizPassXp: 40,
      firstTryBonusXp: 25,
      firstTryThresholdPercent: 80,
      communityXp: 12,
      communityDailyCap: 36,
      levels: ladder,
      createdBy: '000002',
      createdAt: '2026-11-07T10:35:48.941095Z',
      current: true,
    },
    {
      versionNo: 1,
      lessonXp: 5,
      quizPassXp: 30,
      firstTryBonusXp: 20,
      firstTryThresholdPercent: 90,
      communityXp: 10,
      communityDailyCap: 30,
      levels: ladder,
      createdBy: null,
      createdAt: '2026-11-07T02:15:03.120331Z',
      current: false,
    },
  ],
  /** `GET /working-calendar/2026`: exception days only, oldest first. */
  calendar: [
    { date: '2026-01-01', type: 'HOLIDAY', note: 'Tết Dương lịch' },
    { date: '2026-02-14', type: 'MAKEUP_WORKDAY', note: null },
    { date: '2026-04-30', type: 'HOLIDAY', note: 'Ngày Giải phóng miền Nam' },
  ],
  /** `GET /badges`: a held badge is locked; a fresh one is still being awarded in the background. */
  badges: [
    {
      badgeId: 7,
      code: 'FIRST_COURSE',
      name: 'Khóa học đầu tiên',
      description: 'Hoàn thành khóa học đầu tiên của bạn.',
      icon: 'graduation-cap',
      ruleType: 'COURSES_COMPLETED',
      paramN: 1,
      paramProgramId: null,
      programName: null,
      condition: 'Hoàn thành khóa học đầu tiên',
      status: 'active',
      locked: true,
      holders: 42,
      backfillStatus: 'DONE',
      backfillTotal: 42,
      backfillDone: 42,
    },
    {
      badgeId: 12,
      code: 'CUSTOM_3F9A1C0B7D2E',
      name: 'Thạo nghiệp vụ',
      description: 'Hoàn thành chương trình Nghiệp vụ.',
      icon: 'route',
      ruleType: 'PROGRAM_COMPLETED',
      paramN: null,
      paramProgramId: 3,
      programName: 'Nghiệp vụ',
      condition: 'Hoàn thành mọi khóa học của chương trình Nghiệp vụ',
      status: 'active',
      locked: false,
      holders: 0,
      backfillStatus: 'RUNNING',
      backfillTotal: 120,
      backfillDone: 40,
    },
  ],
  /** `GET /reports/learning/gamification-impact`: aggregates only. */
  impact: {
    from: '2026-10-11',
    to: '2026-11-07',
    launchedAt: '2026-11-07T02:15:03.120331Z',
    learners: 48,
    weeklyActive: [
      { weekStart: '2026-10-05', learners: 12 },
      { weekStart: '2026-10-12', learners: 15 },
      { weekStart: '2026-10-19', learners: 19 },
      { weekStart: '2026-10-26', learners: 24 },
      { weekStart: '2026-11-02', learners: 27 },
    ],
    assigned: {
      assigned: 120,
      completed: 84,
      completedOnTime: 66,
      completionRatePercent: 70,
      onTimeRatePercent: 55,
    },
    comparison: {
      launchedAt: '2026-11-07T02:15:03.120331Z',
      windowDays: 28,
      before: {
        from: '2026-10-10',
        to: '2026-11-06',
        weeklyActiveLearners: 14.5,
        assigned: {
          assigned: 90,
          completed: 54,
          completedOnTime: 40,
          completionRatePercent: 60,
          onTimeRatePercent: 44.4,
        },
      },
      after: null,
    },
    xpBySource: [
      { source: 'LESSON', xp: 1800, learners: 40 },
      { source: 'QUIZ_PASS', xp: 900, learners: 31 },
      { source: 'QUIZ_FIRST_TRY_BONUS', xp: 300, learners: 15 },
      { source: 'COURSE', xp: 640, learners: 22 },
      { source: 'COMMUNITY', xp: 120, learners: 9 },
    ],
    badges: [
      { badgeId: 1, name: 'Khóa học đầu tiên', awarded: 30 },
      { badgeId: 2, name: 'Mười khóa học', awarded: 0 },
    ],
    levels: [
      { level: 1, name: 'Giao dịch viên tập sự', learners: 20 },
      { level: 2, name: 'Giao dịch viên', learners: 18 },
      { level: 3, name: 'Chuyên viên', learners: 10 },
    ],
    optOut: { hidden: 4, learners: 48, ratePercent: 8.3 },
  },
};
